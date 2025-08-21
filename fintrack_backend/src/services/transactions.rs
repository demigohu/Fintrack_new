use candid::{CandidType, Nat, Principal};
use ic_cdk::api::call::call;
use std::collections::HashMap;
use std::cell::RefCell;
use serde_bytes::ByteBuf;
use serde::Deserialize;
use num_traits::cast::ToPrimitive;
use num::BigUint;
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, http_request as mgmt_http_request,
};
use serde_json::json;
use candid::{encode_one, decode_one};
use ic_stable_structures::{
    memory_manager::{MemoryManager, MemoryId, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use ic_stable_structures::storable::{Storable, BoundedStorable};
use std::borrow::Cow;

// Transaction types matching the Candid interface
#[derive(CandidType, candid::Deserialize, Clone, Debug)]
pub struct TransactionId {
    pub chain: String,
    pub tx_hash: String,
    pub timestamp: u64,
}

#[derive(CandidType, candid::Deserialize, Clone, Debug)]
pub struct IcpTransaction {
    pub block_index: u64,
    pub from: Principal,
    pub to: Principal,
    pub amount: Nat,
    pub fee: Nat,
    pub timestamp: u64,
    pub operation: String,
    pub token: String,
}

#[derive(CandidType, candid::Deserialize, Clone, Debug)]
pub struct BitcoinTransaction {
    pub txid: String,
    pub block_height: u32,
    pub confirmations: u32,
    pub amount: u64,
    pub fee: u64,
    pub timestamp: u64,
    pub address: String,
    pub operation: String,
}

#[derive(CandidType, candid::Deserialize, Clone, Debug)]
pub struct EthereumTransaction {
    pub tx_hash: String,
    pub block_number: u64,
    pub confirmations: u32,
    pub amount: Nat,
    pub gas_used: u64,
    pub gas_price: Nat,
    pub timestamp: u64,
    pub address: String,
    pub operation: String,
}

#[derive(CandidType, candid::Deserialize, Clone, Debug)]
pub struct Transaction {
    pub id: TransactionId,
    pub icp_tx: Option<IcpTransaction>,
    pub btc_tx: Option<BitcoinTransaction>,
    pub eth_tx: Option<EthereumTransaction>,
    pub status: String,
    pub description: String,
}

#[derive(CandidType, candid::Deserialize, Clone, Debug)]
pub struct UserBalances {
    pub ckbtc_balance: Nat,
    pub cketh_balance: Nat,
    pub btc_native_balance: Nat,
    pub eth_native_balance: Nat,
    pub last_updated: u64,
}

// Index canister response structures
#[derive(CandidType, Deserialize, Debug)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<ByteBuf>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Burn {
    pub from: Account,
    pub memo: Option<ByteBuf>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
    pub spender: Option<Account>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Mint {
    pub to: Account,
    pub memo: Option<ByteBuf>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Approve {
    pub fee: Option<Nat>,
    pub from: Account,
    pub memo: Option<ByteBuf>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
    pub expected_allowance: Option<Nat>,
    pub expires_at: Option<u64>,
    pub spender: Account,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct IndexTransaction {
    pub burn: Option<Burn>,
    pub kind: String,
    pub mint: Option<Mint>,
    pub approve: Option<Approve>,
    pub timestamp: u64,
    pub transfer: Option<()>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TransactionRecord {
    pub id: Nat,
    pub transaction: IndexTransaction,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct GetAccountTransactionsResponse {
    pub balance: Nat,
    pub transactions: Vec<TransactionRecord>,
    pub oldest_tx_id: Option<Nat>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum GetAccountTransactionsResult {
    Ok(GetAccountTransactionsResponse),
    Err(String),
}

#[derive(CandidType)]
pub struct GetAccountTransactionsArgs {
    pub account: Account,
    pub start: Option<u64>,
    pub max_results: Nat,
}

// Simple in-memory balance caching
thread_local! {
    static USER_BALANCES: RefCell<HashMap<Principal, UserBalances>> = RefCell::new(HashMap::new());
}

// Cache sederhana untuk transaksi native (gabungan BTC/ETH) per user
type VMem = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
}

#[derive(Clone, Eq, PartialEq, Ord, PartialOrd)]
struct StablePrincipal(Principal);

impl Storable for StablePrincipal {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(self.0.as_slice().to_vec())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        StablePrincipal(Principal::from_slice(&bytes))
    }
}

impl BoundedStorable for StablePrincipal {
    const MAX_SIZE: u32 = 29; // principal max 29 bytes
    const IS_FIXED_SIZE: bool = false;
}

#[derive(Clone)]
struct BoundedBytes(Vec<u8>);

impl Storable for BoundedBytes {
    fn to_bytes(&self) -> Cow<[u8]> { Cow::Owned(self.0.clone()) }
    fn from_bytes(bytes: Cow<[u8]>) -> Self { BoundedBytes(bytes.into_owned()) }
}

impl BoundedStorable for BoundedBytes {
    const MAX_SIZE: u32 = 1_000_000; // up to ~1MB per user history blob
    const IS_FIXED_SIZE: bool = false;
}

thread_local! {
    // Stable map: key = principal (bounded), value = candid-encoded Vec<Transaction> (bounded bytes)
    static NATIVE_TXS_MAP: RefCell<StableBTreeMap<StablePrincipal, BoundedBytes, VMem>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(10))))
    );
}

fn store_native_txs(user: Principal, txs: &Vec<Transaction>) -> Result<(), String> {
    let key = StablePrincipal(user);
    let bytes = encode_one(txs).map_err(|e| format!("encode candid txs failed: {}", e))?;
    NATIVE_TXS_MAP.with(|map| {
        map.borrow_mut().insert(key, BoundedBytes(bytes));
    });
    Ok(())
}

fn load_native_txs(user: Principal) -> Option<Vec<Transaction>> {
    let key = StablePrincipal(user);
    NATIVE_TXS_MAP.with(|map| map.borrow().get(&key)).and_then(|bb| decode_one::<Vec<Transaction>>(&bb.0).ok())
}

// Canister principals
fn ckbtc_ledger_principal() -> Principal {
    Principal::from_text("mc6ru-gyaaa-aaaar-qaaaq-cai").expect("invalid ckbtc_ledger principal")
}

fn cketh_ledger_principal() -> Principal {
    Principal::from_text("apia6-jaaaa-aaaar-qabma-cai").expect("invalid cketh_ledger principal")
}

fn ckbtc_index_principal() -> Principal {
    Principal::from_text("mm444-5iaaa-aaaar-qaabq-cai").expect("invalid ckbtc_index principal")
}

fn cketh_index_principal() -> Principal {
    Principal::from_text("sh5u2-cqaaa-aaaar-qacna-cai").expect("invalid cketh_index principal")
}

// Konfigurasi HTTP Outcall
const ALCHEMY_SEPOLIA_URL: &str = "https://eth-sepolia.g.alchemy.com/v2/8RsCj6scFdYCuefJkjXAekpSrh07JhyV";
// Jika ingin pakai BlockCypher mainnet (contoh), isi token di sini. Untuk regtest -> tidak digunakan.
const BLOCKCYPHER_TOKEN: &str = "dce63e3270ec49cfbc91eff20cbece20";

async fn http_post_json(url: &str, body: String, max_response_bytes: u64) -> Result<String, String> {
    let headers = vec![
        HttpHeader { name: "Content-Type".into(), value: "application/json".into() },
        HttpHeader { name: "Accept".into(), value: "application/json".into() },
    ];
    let arg = CanisterHttpRequestArgument {
        url: url.into(),
        method: HttpMethod::POST,
        body: Some(body.into_bytes()),
        max_response_bytes: Some(max_response_bytes),
        transform: None,
        headers,
    };
    let (resp,): (ic_cdk::api::management_canister::http_request::HttpResponse,) = mgmt_http_request(arg, 2_500_000_000).await
        .map_err(|e| format!("HTTP outcall failed: {:?}", e))?;
    String::from_utf8(resp.body).map_err(|_| "Failed to decode response body".to_string())
}

fn parse_eth_decimal_to_wei(value: &str) -> Nat {
    // value bisa berupa desimal dengan titik. Konversi ke wei (10^18)
    let parts: Vec<&str> = value.split('.').collect();
    let integer_part = parts.get(0).copied().unwrap_or("0");
    let frac_part = parts.get(1).copied().unwrap_or("");

    let mut wei = BigUint::from(0u32);
    let ten_18 = BigUint::parse_bytes(b"1000000000000000000", 10).unwrap();
    // integer_part * 10^18
    if let Some(int_val) = BigUint::parse_bytes(integer_part.as_bytes(), 10) { wei += int_val * &ten_18; }
    // fractional padded to 18
    let mut frac_str = frac_part.to_string();
    if frac_str.len() < 18 { frac_str.extend(std::iter::repeat('0').take(18 - frac_str.len())); }
    if frac_str.len() > 18 { frac_str.truncate(18); }
    if !frac_str.is_empty() {
        if let Some(frac_val) = BigUint::parse_bytes(frac_str.as_bytes(), 10) { wei += frac_val; }
    }
    Nat(wei)
}

// Core transaction functions
pub async fn get_user_transaction_history(
    user: Principal,
    limit: Option<u32>,
    offset: Option<u32>
) -> Result<Vec<Transaction>, String> {
    let max_results = limit.unwrap_or(50);
    
    // Get ckBTC transactions
    let ckbtc_txs = get_ckbtc_transactions(user, max_results).await?;
    
    // Get ckETH transactions
    let cketh_txs = get_cketh_transactions(user, max_results).await?;
    
    // Get native ETH transactions via Alchemy (HTTP outcall)
    let native_txs = get_native_transactions(user, max_results).await?;
    
    // Combine and sort all transactions
    let mut all_transactions = Vec::new();
    
    // Add ckBTC transactions
    for tx in ckbtc_txs {
        all_transactions.push(tx);
    }
    
    // Add ckETH transactions
    for tx in cketh_txs {
        all_transactions.push(tx);
    }
    
    // Add native transactions (currently ETH only; BTC skipped on regtest)
    for tx in native_txs {
        all_transactions.push(tx);
    }
    
    // Sort by timestamp (newest first)
    all_transactions.sort_by(|a, b| b.id.timestamp.cmp(&a.id.timestamp));
    
    // Apply offset if specified
    if let Some(offset) = offset {
        let start = offset as usize;
        if start < all_transactions.len() {
            all_transactions = all_transactions[start..].to_vec();
        } else {
            all_transactions = Vec::new();
        }
    }
    
    Ok(all_transactions)
}

// Get ckBTC transactions from index
async fn get_ckbtc_transactions(user: Principal, max_results: u32) -> Result<Vec<Transaction>, String> {
    let index = ckbtc_index_principal();
    
    let arg = (GetAccountTransactionsArgs {
        account: Account { owner: user, subaccount: None },
        start: None,
        max_results: Nat::from(max_results as u64),
    },);
    
    let (result,): (GetAccountTransactionsResult,) = call(index, "get_account_transactions", arg)
        .await
        .map_err(|e| format!("ckBTC index query failed: {:?}", e))?;
    
    match result {
        GetAccountTransactionsResult::Ok(response) => {
            let mut transactions = Vec::new();
            
            for tx_record in response.transactions {
                if let Some(transaction) = convert_index_transaction_to_transaction(
                    tx_record,
                    "ckBTC",
                    "Bitcoin"
                ) {
                    transactions.push(transaction);
                }
            }
            
            Ok(transactions)
        },
        GetAccountTransactionsResult::Err(e) => {
            Err(format!("ckBTC index error: {}", e))
        }
    }
}

// Get ckETH transactions from index
async fn get_cketh_transactions(user: Principal, max_results: u32) -> Result<Vec<Transaction>, String> {
    let index = cketh_index_principal();
    
    let arg = (GetAccountTransactionsArgs {
        account: Account { owner: user, subaccount: None },
        start: None,
        max_results: Nat::from(max_results as u64),
    },);
    
    let (result,): (GetAccountTransactionsResult,) = call(index, "get_account_transactions", arg)
        .await
        .map_err(|e| format!("ckETH index query failed: {:?}", e))?;
    
    match result {
        GetAccountTransactionsResult::Ok(response) => {
            let mut transactions = Vec::new();
            
            for tx_record in response.transactions {
                if let Some(transaction) = convert_index_transaction_to_transaction(
                    tx_record,
                    "ckETH",
                    "Ethereum"
                ) {
                    transactions.push(transaction);
                }
            }
            
            Ok(transactions)
        },
        GetAccountTransactionsResult::Err(e) => {
            Err(format!("ckETH index error: {}", e))
        }
    }
}

// =============================
// Native transactions (ETH)
// =============================

async fn get_native_transactions(user: Principal, max_results: u32) -> Result<Vec<Transaction>, String> {
    // Ambil ETH address user (alamat native)
    let eth_address = crate::services::address::get_eth_address(Some(user)).await
        .map_err(|e| format!("gagal ambil alamat ETH user: {}", e))?;

    // Ambil transaksi dari Alchemy (both incoming/outgoing)
    match fetch_eth_transfers_for_address(&eth_address, max_results).await {
        Ok(mut txs) => {
            // Simpan ke stable map (overwrite)
            let _ = store_native_txs(user, &txs);
            Ok(txs)
        }
        Err(e) => {
            // Fallback ke data tersimpan
            if let Some(mut txs) = load_native_txs(user) {
                txs.sort_by(|a, b| b.id.timestamp.cmp(&a.id.timestamp));
                txs.truncate(max_results as usize);
                Ok(txs)
            } else {
                Err(e)
            }
        }
    }
}

async fn fetch_eth_transfers_for_address(address: &str, max_results: u32) -> Result<Vec<Transaction>, String> {
    let max_count_hex = format!("0x{:x}", max_results.max(1));

    // Panggil dua kali: transaksi keluar (fromAddress) dan masuk (toAddress)
    let body_out = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "alchemy_getAssetTransfers",
        "params": [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "fromAddress": address,
            "category": ["external", "internal"],
            "withMetadata": true,
            "excludeZeroValue": false,
            "maxCount": max_count_hex,
            "order": "desc"
        }]
    }).to_string();

    let body_in = json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "alchemy_getAssetTransfers",
        "params": [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "toAddress": address,
            "category": ["external", "internal"],
            "withMetadata": true,
            "excludeZeroValue": false,
            "maxCount": max_count_hex,
            "order": "desc"
        }]
    }).to_string();

    let max_bytes = 100_000;
    let resp_out = http_post_json(ALCHEMY_SEPOLIA_URL, body_out, max_bytes).await?;
    let resp_in = http_post_json(ALCHEMY_SEPOLIA_URL, body_in, max_bytes).await?;

    let mut txs: Vec<Transaction> = Vec::new();

    // Parse OUTGOING
    txs.extend(parse_alchemy_transfers_json(&resp_out, address, false)?);
    // Parse INCOMING
    txs.extend(parse_alchemy_transfers_json(&resp_in, address, true)?);

    // Batasi jumlah akhir
    txs.sort_by(|a, b| b.id.timestamp.cmp(&a.id.timestamp));
    txs.truncate(max_results as usize);
    Ok(txs)
}

fn parse_alchemy_transfers_json(body: &str, user_address: &str, incoming: bool) -> Result<Vec<Transaction>, String> {
    let v: serde_json::Value = serde_json::from_str(body).map_err(|e| format!("gagal parse JSON Alchemy: {}", e))?;
    let transfers = v.get("result").and_then(|r| r.get("transfers")).and_then(|t| t.as_array()).cloned().unwrap_or_default();
    let mut out = Vec::new();
    for item in transfers {
        let tx_hash = item.get("hash").and_then(|x| x.as_str()).unwrap_or("").to_string();
        if tx_hash.is_empty() { continue; }
        let block_num_hex = item.get("blockNum").and_then(|x| x.as_str()).unwrap_or("0x0");
        let block_number = hex_to_u64(block_num_hex).unwrap_or(0);
        
        // Parse amount - try different possible fields
        let amount_wei = if let Some(value) = item.get("value") {
            if let Some(value_str) = value.as_str() {
                // If it's a string, parse as decimal ETH
                parse_eth_decimal_to_wei(value_str)
            } else if let Some(value_num) = value.as_f64() {
                // If it's a number, convert to wei
                let wei = (value_num * 1e18) as u64;
                Nat::from(wei)
            } else {
                Nat::from(0u64)
            }
        } else if let Some(raw_value) = item.get("rawValue") {
            // Try rawValue field (hex string)
            if let Some(raw_str) = raw_value.as_str() {
                if let Some(wei) = hex_to_u64(raw_str) {
                    Nat::from(wei)
                } else {
                    Nat::from(0u64)
                }
            } else {
                Nat::from(0u64)
            }
        } else if let Some(amount) = item.get("amount") {
            // Try amount field
            if let Some(amount_str) = amount.as_str() {
                if amount_str.starts_with("0x") {
                    // Hex amount
                    if let Some(wei) = hex_to_u64(amount_str) {
                        Nat::from(wei)
                    } else {
                        Nat::from(0u64)
                    }
                } else {
                    // Decimal amount
                    parse_eth_decimal_to_wei(amount_str)
                }
            } else if let Some(amount_num) = amount.as_f64() {
                // Numeric amount
                let wei = (amount_num * 1e18) as u64;
                Nat::from(wei)
            } else {
                Nat::from(0u64)
            }
        } else {
            Nat::from(0u64)
        };
        
        let metadata_ts = item.get("metadata").and_then(|m| m.get("blockTimestamp")).and_then(|x| x.as_str()).unwrap_or("");
        let ts = parse_iso8601_to_unix(metadata_ts).unwrap_or(0);

        let operation = if incoming { "NATIVE_TRANSFER_IN" } else { "NATIVE_TRANSFER_OUT" };

        // Calculate confirmations based on block number
        // If block_number > 0, assume it's confirmed (at least 1 confirmation)
        let confirmations = if block_number > 0 { 1 } else { 0 };
        
        // Calculate status based on confirmations
        let status = if confirmations > 0 { "CONFIRMED" } else { "PENDING" };

        out.push(Transaction {
            id: TransactionId { chain: "Ethereum".to_string(), tx_hash: tx_hash.clone(), timestamp: ts },
            icp_tx: None,
            btc_tx: None,
            eth_tx: Some(EthereumTransaction {
                tx_hash,
                block_number,
                confirmations,
                amount: amount_wei,
                gas_used: 0,
                gas_price: Nat::from(0u64), // Keep 0 for now since Alchemy doesn't provide gas price in transfers
                timestamp: ts,
                address: user_address.to_string(),
                operation: operation.to_string(),
            }),
            status: status.to_string(),
            description: "Native ETH transfer".to_string(),
        });
    }
    Ok(out)
}

fn hex_to_u64(h: &str) -> Option<u64> {
    let s = h.trim_start_matches("0x");
    u64::from_str_radix(s, 16).ok()
}

fn parse_iso8601_to_unix(s: &str) -> Option<u64> {
    // Parse ISO8601 timestamp dari Alchemy API
    // Format: "2024-01-15T10:30:45.123Z"
    if s.is_empty() {
        return None;
    }
    
    // Simple parsing - extract year, month, day, hour, minute, second
    let binding = s.replace('T', " ").replace('Z', "");
    let parts: Vec<&str> = binding.split(&['-', ' ', ':', '.'][..]).collect();
    if parts.len() < 6 {
        return None;
    }
    
    let year: i32 = parts[0].parse().ok()?;
    let month: u32 = parts[1].parse().ok()?;
    let day: u32 = parts[2].parse().ok()?;
    let hour: u32 = parts[3].parse().ok()?;
    let minute: u32 = parts[4].parse().ok()?;
    let second: u32 = parts[5].parse().ok()?;
    
    // Simple epoch calculation (approximate)
    // Days since 1970-01-01
    let days_since_epoch = (year - 1970) * 365 + (year - 1969) / 4 - (year - 1901) / 100 + (year - 1601) / 400;
    let month_days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let total_days = days_since_epoch + month_days.get((month - 1) as usize).copied().unwrap_or(0) as i32 + (day - 1) as i32;
    
    let total_seconds = total_days as u64 * 86400 + hour as u64 * 3600 + minute as u64 * 60 + second as u64;
    Some(total_seconds * 1_000_000_000) // Convert to nanoseconds
}

// Convert index transaction to our Transaction format
fn convert_index_transaction_to_transaction(
    tx_record: TransactionRecord, 
    token: &str, 
    chain: &str
) -> Option<Transaction> {
    let tx = &tx_record.transaction;
    
    match tx.kind.as_str() {
        "mint" => {
            if let Some(mint) = &tx.mint {
                let operation = "DEPOSIT";
                let source_token = if token == "ckBTC" { "BTC" } else { "ETH" };
                let description = format!("Deposited {} {} to {}", 
                    format_nat_as_token(&mint.amount, token), 
                    source_token, 
                    token
                );
                
                Some(Transaction {
                    id: TransactionId {
                        chain: chain.to_string(),
                        tx_hash: tx_record.id.0.to_string(),
                        timestamp: tx.timestamp,
                    },
                    icp_tx: Some(IcpTransaction {
                        block_index: tx_record.id.0.to_u64().unwrap_or(0),
                        from: Principal::anonymous(), // Mint comes from minter
                        to: mint.to.owner,
                        amount: mint.amount.clone(),
                        fee: Nat::from(0u64),
                        timestamp: tx.timestamp,
                        operation: operation.to_string(),
                        token: token.to_string(),
                    }),
                    btc_tx: None,
                    eth_tx: None,
                    status: "CONFIRMED".to_string(),
                    description,
                })
            } else {
                None
            }
        },
        "burn" => {
            if let Some(burn) = &tx.burn {
                let operation = "WITHDRAW";
                let description = format!("Withdraw {} {} to {}", 
                    format_nat_as_token(&burn.amount, token), 
                    token, 
                    if token == "ckBTC" { "BTC" } else { "ETH" }
                );
                
                Some(Transaction {
                    id: TransactionId {
                        chain: chain.to_string(),
                        tx_hash: tx_record.id.0.to_string(),
                        timestamp: tx.timestamp,
                    },
                    icp_tx: Some(IcpTransaction {
                        block_index: tx_record.id.0.to_u64().unwrap_or(0),
                        from: burn.from.owner,
                        to: Principal::anonymous(), // Burn goes to external
                        amount: burn.amount.clone(),
                        fee: Nat::from(0u64),
                        timestamp: tx.timestamp,
                        operation: operation.to_string(),
                        token: token.to_string(),
                    }),
                    btc_tx: None,
                    eth_tx: None,
                    status: "CONFIRMED".to_string(),
                    description,
                })
            } else {
                None
            }
        },
        "approve" => {
            // Skip approve transactions for now as they're not deposits/withdrawals
            None
        },
        _ => None
    }
}

// Format Nat as token amount with proper decimals
fn format_nat_as_token(amount: &Nat, token: &str) -> String {
    let decimals = if token == "ckBTC" { 8 } else { 18 };
    let value = amount.0.to_string();
    let len = value.len();
    
    if len <= decimals {
        format!("0.{}", "0".repeat(decimals - len) + &value)
    } else {
        let (integer, decimal) = value.split_at(len - decimals);
        let trimmed_decimal = decimal.trim_end_matches('0');
        if trimmed_decimal.is_empty() {
            integer.to_string()
        } else {
            format!("{}.{}", integer, trimmed_decimal)
        }
    }
}

pub async fn get_user_balances(user: Principal) -> Result<UserBalances, String> {
    // Try to get from cache first
    if let Some(balances) = USER_BALANCES.with(|map| map.borrow().get(&user).cloned()) {
        // Check if data is fresh (less than 5 minutes old)
        let current_time = ic_cdk::api::time();
        if current_time - balances.last_updated < 300_000_000_000 { // 5 minutes in nanoseconds
            return Ok(balances);
        }
    }
    
    // Fetch fresh balances from ledgers
    let ckbtc_balance = get_ckbtc_balance(user, None).await?;
    let cketh_balance = get_cketh_balance(user, None).await?;

    // Fetch native balances
    // ETH native via backend ethtransfer using user's derived ETH address
    let eth_native_balance = match crate::services::address::get_eth_address(Some(user)).await {
        Ok(addr) => match crate::services::ethtransfer::get_native_eth_balance(Some(addr)).await {
            Ok(n) => n,
            Err(_e) => Nat::from(0u32),
        },
        Err(_e) => Nat::from(0u32),
    };

    // BTC native via bitcoin canister balance
    // Derive BTC address from principal and query native balance
    let btc_native_balance = match crate::services::address::get_btc_address(Some(user)).await {
        Ok(addr) => {
            match crate::services::btctransfer::get_native_btc_balance(addr).await {
                Ok(sats) => Nat::from(sats),
                Err(_e) => Nat::from(0u32),
            }
        },
        Err(_e) => Nat::from(0u32),
    };
    
    let balances = UserBalances {
        ckbtc_balance,
        cketh_balance,
        btc_native_balance,
        eth_native_balance,
        last_updated: ic_cdk::api::time(),
    };
    
    // Store in cache
    USER_BALANCES.with(|map| {
        map.borrow_mut().insert(user, balances.clone());
    });
    
    Ok(balances)
}

// ICP Transaction functions
async fn get_ckbtc_balance(user: Principal, subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    let ledger = ckbtc_ledger_principal();
    #[derive(CandidType)]
    struct AccountArg {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }
    let arg = (AccountArg { owner: user, subaccount },);
    let (balance,): (Nat,) = call(ledger, "icrc1_balance_of", arg)
        .await
        .map_err(|e| format!("ckBTC balance query failed: {:?}", e))?;
    Ok(balance)
}

async fn get_cketh_balance(user: Principal, subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    let ledger = cketh_ledger_principal();
    #[derive(CandidType)]
    struct AccountArg {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }
    let arg = (AccountArg { owner: user, subaccount },);
    let (balance,): (Nat,) = call(ledger, "icrc1_balance_of", arg)
        .await
        .map_err(|e| format!("ckETH balance query failed: {:?}", e))?;
    Ok(balance)
}

// Utility functions
pub fn get_transaction_count(_user: Principal) -> u32 {
    // This will need to be implemented by querying the index
    // For now, return placeholder
    0
}

pub fn clear_user_transactions(user: Principal) {
    // Clear balance cache
    USER_BALANCES.with(|map| {
        map.borrow_mut().remove(&user);
    });
}
