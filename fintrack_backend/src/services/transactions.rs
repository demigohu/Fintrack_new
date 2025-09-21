use candid::{CandidType, Nat, Principal};
use ic_cdk::api::call::call_with_payment128;
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
    pub usdc_balance: Nat,
    pub weth_balance: Nat,
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
    pub transfer: Option<Transfer>,
}
#[derive(CandidType, candid::Deserialize, Debug)]
pub struct Transfer {
    pub to: Account,
    pub fee: Option<Nat>,
    pub from: Account,
    pub memo: Option<ByteBuf>,
    pub created_at_time: Option<u64>,
    pub amount: Nat,
    pub spender: Option<Account>,
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
    Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").expect("invalid ckbtc_ledger principal")
}

fn cketh_ledger_principal() -> Principal {
    Principal::from_text("ss2fx-dyaaa-aaaar-qacoq-cai").expect("invalid cketh_ledger principal")
}

fn ckbtc_index_principal() -> Principal {
    Principal::from_text("n5wcd-faaaa-aaaar-qaaea-cai").expect("invalid ckbtc_index principal")
}

fn cketh_index_principal() -> Principal {
    Principal::from_text("s3zol-vqaaa-aaaar-qacpa-cai").expect("invalid cketh_index principal")
}

// Konfigurasi HTTP Outcall - Mainnet
const ETHERSCAN_MAINNET_URL: &str = "https://api.etherscan.io/api";
const ETHERSCAN_API_KEY: &str = "69RXZDXVXTN3QDQ2BTXCT57BECUXQ9CJHQ";
const BLOCKCYPHER_MAINNET_URL: &str = "https://api.blockcypher.com/v1/btc/main";
const BLOCKCYPHER_TOKEN: &str = "dce63e3270ec49cfbc91eff20cbece20";

// ERC20 Token addresses on Ethereum mainnet
const USDC_CONTRACT_ADDRESS: &str = "0xA0b86a33E6441b8c4C8C0E4A8e4A8e4A8e4A8e4A8"; // Mainnet USDC - Update with correct address
const WETH_CONTRACT_ADDRESS: &str = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Mainnet WETH

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

async fn http_get_json(url: &str, max_response_bytes: u64) -> Result<String, String> {
    let headers = vec![
        HttpHeader { name: "Accept".into(), value: "application/json".into() },
    ];
    let arg = CanisterHttpRequestArgument {
        url: url.into(),
        method: HttpMethod::GET,
        body: None,
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
    
    // Get ckBTC transactions (with error handling)
    let ckbtc_txs = match get_ckbtc_transactions(user, max_results).await {
        Ok(txs) => txs,
        Err(e) => {
            ic_cdk::println!("Warning: Failed to load ckBTC transactions: {}", e);
            Vec::new()
        }
    };
    
    // Get ckETH transactions (with error handling)
    let cketh_txs = match get_cketh_transactions(user, max_results).await {
        Ok(txs) => txs,
        Err(e) => {
            ic_cdk::println!("Warning: Failed to load ckETH transactions: {}", e);
            Vec::new()
        }
    };
    
    // Get native ETH transactions via Alchemy (HTTP outcall)
    let native_txs = match get_native_transactions(user, max_results).await {
        Ok(txs) => txs,
        Err(e) => {
            ic_cdk::println!("Warning: Failed to load native transactions: {}", e);
            Vec::new()
        }
    };
    
    // Store lengths before moving the vectors
    let ckbtc_count = ckbtc_txs.len();
    let cketh_count = cketh_txs.len();
    let native_count = native_txs.len();
    
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
    
    ic_cdk::println!("Transaction summary for user {}: ckBTC={}, ckETH={}, native={}, total={}", 
        user, ckbtc_count, cketh_count, native_count, all_transactions.len());
    
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
    
    let (result,): (GetAccountTransactionsResult,) = call_with_payment128(index, "get_account_transactions", arg, 5_000_000)
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
    
    let (result,): (GetAccountTransactionsResult,) = call_with_payment128(index, "get_account_transactions", arg, 5_000_000)
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
    // Get user's ETH address (native address)
    let eth_address = match crate::services::address::get_eth_address(Some(user)).await {
        Ok(addr) => addr,
        Err(_) => {
            // If no ETH address, return empty list instead of error
            return Ok(Vec::new());
        }
    };

    // Get transactions from Etherscan (both incoming/outgoing)
    match fetch_eth_transfers_for_address(&eth_address, max_results).await {
        Ok(mut txs) => {
            // Store in stable map (overwrite)
            let _ = store_native_txs(user, &txs);
            Ok(txs)
        }
        Err(_) => {
            // Fallback to stored data
            if let Some(mut txs) = load_native_txs(user) {
                txs.sort_by(|a, b| b.id.timestamp.cmp(&a.id.timestamp));
                txs.truncate(max_results as usize);
                Ok(txs)
            } else {
                // If no stored data and API fails, return empty list instead of error
                Ok(Vec::new())
            }
        }
    }
}

async fn fetch_eth_transfers_for_address(address: &str, max_results: u32) -> Result<Vec<Transaction>, String> {
    // Build Etherscan API URL
    let url = format!(
        "{}?module=account&action=txlist&address={}&startblock=0&endblock=99999999&sort=desc&apikey={}",
        ETHERSCAN_MAINNET_URL, address, ETHERSCAN_API_KEY
    );

    // Make HTTP GET request to Etherscan
    let max_bytes = 100_000;
    let response = http_get_json(&url, max_bytes).await?;

    // Parse Etherscan response
    let txs = parse_etherscan_transactions_json(&response, address)?;

    // Batasi jumlah akhir
    let mut sorted_txs = txs;
    sorted_txs.sort_by(|a, b| b.id.timestamp.cmp(&a.id.timestamp));
    sorted_txs.truncate(max_results as usize);
    Ok(sorted_txs)
}

fn parse_etherscan_transactions_json(body: &str, user_address: &str) -> Result<Vec<Transaction>, String> {
    let v: serde_json::Value = serde_json::from_str(body).map_err(|e| format!("Failed to parse Etherscan JSON: {}", e))?;
    
    // Check if API call was successful
    let status = v.get("status").and_then(|s| s.as_str()).unwrap_or("");
    if status != "1" {
        let message = v.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
        return Err(format!("Etherscan API error: {}", message));
    }
    
    let transactions = v.get("result").and_then(|r| r.as_array()).cloned().unwrap_or_default();
    let mut out = Vec::new();
    
    for item in transactions {
        let tx_hash = item.get("hash").and_then(|x| x.as_str()).unwrap_or("").to_string();
        if tx_hash.is_empty() { continue; }
        
        let block_number = item.get("blockNumber").and_then(|x| x.as_str()).unwrap_or("0");
        let block_number_u64 = block_number.parse::<u64>().unwrap_or(0);
        
        let timestamp_str = item.get("timeStamp").and_then(|x| x.as_str()).unwrap_or("0");
        let timestamp = timestamp_str.parse::<u64>().unwrap_or(0);
        
        let from_address = item.get("from").and_then(|x| x.as_str()).unwrap_or("");
        let to_address = item.get("to").and_then(|x| x.as_str()).unwrap_or("");
        
        let value_str = item.get("value").and_then(|x| x.as_str()).unwrap_or("0");
        let amount_wei = if value_str.starts_with("0x") {
            // Hex value
            if let Some(wei) = hex_to_u64(value_str) {
                Nat::from(wei)
            } else {
                Nat::from(0u64)
            }
        } else {
            // Decimal value (should be in wei)
            if let Some(wei) = value_str.parse::<u64>().ok() {
                Nat::from(wei)
            } else {
                Nat::from(0u64)
            }
        };
        
        let gas_used_str = item.get("gasUsed").and_then(|x| x.as_str()).unwrap_or("0");
        let gas_used = gas_used_str.parse::<u64>().unwrap_or(0);
        
        let gas_price_str = item.get("gasPrice").and_then(|x| x.as_str()).unwrap_or("0");
        let gas_price = if gas_price_str.starts_with("0x") {
            if let Some(price) = hex_to_u64(gas_price_str) {
                Nat::from(price)
            } else {
                Nat::from(0u64)
            }
        } else {
            if let Some(price) = gas_price_str.parse::<u64>().ok() {
                Nat::from(price)
            } else {
                Nat::from(0u64)
            }
        };
        
        // Determine operation type based on addresses
        let operation = if from_address.to_lowercase() == user_address.to_lowercase() {
            "NATIVE_TRANSFER_OUT"
        } else if to_address.to_lowercase() == user_address.to_lowercase() {
            "NATIVE_TRANSFER_IN"
        } else {
            "NATIVE_TRANSFER_UNKNOWN"
        };
        
        // Skip contract creation and other non-transfer transactions
        if item.get("contractAddress").and_then(|x| x.as_str()).unwrap_or("") != "" {
            continue;
        }
        
        // Skip transactions with 0 value (contract interactions)
        if amount_wei == Nat::from(0u64) {
            continue;
        }
        
        // Calculate confirmations (assuming current block is latest)
        let confirmations = if block_number_u64 > 0 { 1 } else { 0 };
        
        // Calculate status based on confirmations
        let status = if confirmations > 0 { "CONFIRMED" } else { "PENDING" };
        
        // Convert timestamp to nanoseconds (Etherscan returns seconds)
        let timestamp_ns = timestamp * 1_000_000_000;
        
        out.push(Transaction {
            id: TransactionId { 
                chain: "Ethereum".to_string(), 
                tx_hash: tx_hash.clone(), 
                timestamp: timestamp_ns 
            },
            icp_tx: None,
            btc_tx: None,
            eth_tx: Some(EthereumTransaction {
                tx_hash,
                block_number: block_number_u64,
                confirmations,
                amount: amount_wei,
                gas_used,
                gas_price,
                timestamp: timestamp_ns,
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

// Get ERC20 token balance using Etherscan API
async fn get_erc20_balance(
    user_address: &str,
    contract_address: &str,
    token_name: &str
) -> Result<Nat, String> {
    let url = format!(
        "{}?module=account&action=tokenbalance&contractaddress={}&address={}&tag=latest&apikey={}",
        ETHERSCAN_MAINNET_URL, contract_address, user_address, ETHERSCAN_API_KEY
    );

    let max_bytes = 10_000;
    let response = http_get_json(&url, max_bytes).await?;
    
    ic_cdk::println!("Debug: Etherscan API response for {}: {}", token_name, response);

    // Parse Etherscan response
    let v: serde_json::Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse Etherscan JSON: {}", e))?;

    // Check if API call was successful
    let status = v.get("status").and_then(|s| s.as_str()).unwrap_or("");
    if status != "1" {
        let message = v.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
        ic_cdk::println!("Debug: Etherscan API error for {}: status={}, message={}", token_name, status, message);
        return Err(format!("Etherscan API error for {}: {}", token_name, message));
    }

    let balance_hex = v.get("result")
        .and_then(|r| r.as_str())
        .ok_or(format!("No result in {} response", token_name))?;

    // Convert hex to u64
    let balance_u64 = if balance_hex.starts_with("0x") {
        hex_to_u64(balance_hex).unwrap_or(0)
    } else {
        balance_hex.parse::<u64>().unwrap_or(0)
    };

    Ok(Nat::from(balance_u64))
}

// Get USDC balance
async fn get_usdc_balance(user_address: &str) -> Result<Nat, String> {
    get_erc20_balance(user_address, USDC_CONTRACT_ADDRESS, "USDC").await
}

// Get WETH balance
async fn get_weth_balance(user_address: &str) -> Result<Nat, String> {
    get_erc20_balance(user_address, WETH_CONTRACT_ADDRESS, "WETH").await
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
        "transfer" => {
            if let Some(tr) = &tx.transfer {
                // Determine direction relative to user (based on indices: we only have user principal by context in caller
                // Here, we cannot access the user directly; infer via description using accounts. We'll keep both from/to.
                // Detect budgeting and goals by memo
                let memo_text = tr.memo.as_ref().and_then(|b| String::from_utf8(b.clone().into_vec()).ok()).unwrap_or_default();
                let operation = if memo_text == "budget_monthly_lock" {
                    "BUDGET_LOCK"
                } else if memo_text == "budget_user_withdraw" {
                    "BUDGET_WITHDRAW"
                } else if memo_text == "goals_initial_lock" {
                    "GOALS_INITIAL_LOCK"
                } else if memo_text == "goals_add_funds" {
                    "GOALS_ADD_FUNDS"
                } else if memo_text == "goals_user_withdraw" {
                    "GOALS_WITHDRAW"
                } else {
                    "TRANSFER"
                };

                let description = if operation == "BUDGET_LOCK" {
                    format!("Budget lock {} {}", format_nat_as_token(&tr.amount, token), token)
                } else if operation == "BUDGET_WITHDRAW" {
                    format!("Budget withdraw {} {}", format_nat_as_token(&tr.amount, token), token)
                } else if operation == "GOALS_INITIAL_LOCK" {
                    format!("Goals initial lock {} {}", format_nat_as_token(&tr.amount, token), token)
                } else if operation == "GOALS_ADD_FUNDS" {
                    format!("Goals add funds {} {}", format_nat_as_token(&tr.amount, token), token)
                } else if operation == "GOALS_WITHDRAW" {
                    format!("Goals withdraw {} {}", format_nat_as_token(&tr.amount, token), token)
                } else {
                    format!("Transfer {} {}", format_nat_as_token(&tr.amount, token), token)
                };

                Some(Transaction {
                    id: TransactionId {
                        chain: chain.to_string(),
                        tx_hash: tx_record.id.0.to_string(),
                        timestamp: tx.timestamp,
                    },
                    icp_tx: Some(IcpTransaction {
                        block_index: tx_record.id.0.to_u64().unwrap_or(0),
                        from: tr.from.owner,
                        to: tr.to.owner,
                        amount: tr.amount.clone(),
                        fee: tr.fee.clone().unwrap_or_else(|| Nat::from(0u64)),
                        timestamp: tx.timestamp,
                        operation: operation.to_string(),
                        token: token.to_string(),
                    }),
                    btc_tx: None,
                    eth_tx: None,
                    status: "CONFIRMED".to_string(),
                    description,
                })
            } else { None }
        }
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
        // Check if data is fresh (less than 2 minutes old)
        let current_time = ic_cdk::api::time();
        if current_time - balances.last_updated < 120_000_000_000 { // 2 minutes in nanoseconds
            ic_cdk::println!("Debug: Using cached balances for user: {}", user);
            return Ok(balances);
        }
    }
    
    // Fetch fresh balances from ledgers
    let ckbtc_balance = get_ckbtc_balance(user, None).await?;
    let cketh_balance = get_cketh_balance(user, None).await?;

    // Fetch native balances
    // ETH native via backend ethtransfer using user's derived ETH address
    let eth_address = match crate::services::address::get_eth_address(Some(user)).await {
        Ok(addr) => addr,
        Err(_e) => {
            ic_cdk::println!("Warning: Failed to get ETH address for user: {}", user);
            "".to_string()
        }
    };
    
    let eth_native_balance = if !eth_address.is_empty() {
        match crate::services::ethtransfer::get_native_eth_balance(Some(eth_address.clone())).await {
            Ok(n) => n,
            Err(_e) => Nat::from(0u32),
        }
    } else {
        Nat::from(0u32)
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

    // Get ERC20 balances (USDC and WETH) with rate limiting and retry
    let usdc_balance = if !eth_address.is_empty() {
        // Retry USDC balance up to 3 times
        let mut retry_count = 0;
        let max_retries = 3;
        
        loop {
            match get_usdc_balance(&eth_address).await {
                Ok(balance) => {
                    ic_cdk::println!("Debug: USDC balance for {}: {}", eth_address, balance);
                    break balance;
                },
                Err(e) => {
                    retry_count += 1;
                    ic_cdk::println!("Warning: Failed to get USDC balance (attempt {}/{}): {}", retry_count, max_retries, e);
                    
                    if retry_count >= max_retries {
                        ic_cdk::println!("Error: Max retries reached for USDC balance, using 0");
                        break Nat::from(0u64);
                    }
                    
                    // Wait before retry
                    for _ in 0..200 {
                        ic_cdk::api::time();
                    }
                }
            }
        }
    } else {
        ic_cdk::println!("Debug: ETH address is empty, skipping USDC balance check");
        Nat::from(0u64)
    };

    // Rate limiting: Wait 5 seconds before fetching WETH balance
    ic_cdk::println!("Debug: Waiting 5 seconds before fetching WETH balance...");
    
    // More substantial delay to avoid rate limiting
    for _ in 0..500 {
        ic_cdk::api::time();
    }

    let weth_balance = if !eth_address.is_empty() {
        // Retry WETH balance up to 3 times
        let mut retry_count = 0;
        let max_retries = 3;
        
        loop {
            match get_weth_balance(&eth_address).await {
                Ok(balance) => {
                    ic_cdk::println!("Debug: WETH balance for {}: {}", eth_address, balance);
                    break balance;
                },
                Err(e) => {
                    retry_count += 1;
                    ic_cdk::println!("Warning: Failed to get WETH balance (attempt {}/{}): {}", retry_count, max_retries, e);
                    
                    if retry_count >= max_retries {
                        ic_cdk::println!("Error: Max retries reached for WETH balance, using 0");
                        break Nat::from(0u64);
                    }
                    
                    // Wait before retry
                    for _ in 0..200 {
                        ic_cdk::api::time();
                    }
                }
            }
        }
    } else {
        ic_cdk::println!("Debug: ETH address is empty, skipping WETH balance check");
        Nat::from(0u64)
    };
    
    let balances = UserBalances {
        ckbtc_balance,
        cketh_balance,
        btc_native_balance,
        eth_native_balance,
        usdc_balance,
        weth_balance,
        last_updated: ic_cdk::api::time(),
    };
    
    // Store in cache
    USER_BALANCES.with(|map| {
        map.borrow_mut().insert(user, balances.clone());
    });
    
    ic_cdk::println!("Debug: User balances: {:?}", balances);
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
    let (balance,): (Nat,) = call_with_payment128(ledger, "icrc1_balance_of", arg, 1_000_000)
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
    let (balance,): (Nat,) = call_with_payment128(ledger, "icrc1_balance_of", arg, 1_000_000)
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
