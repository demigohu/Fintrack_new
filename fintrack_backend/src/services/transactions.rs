use candid::{CandidType, Nat, Principal};
use ic_cdk::api::call::call_with_payment128;
use crate::services::evm_rpc_canister::{RpcServices, RpcConfig, JsonRpcSource, CallArgs, MultiCallResult, TransactionRequest, BlockTag};
use std::collections::HashMap;
use std::cell::RefCell;
use futures::{self, FutureExt};
use serde_bytes::ByteBuf;
use serde::Deserialize;
use num_traits::{cast::ToPrimitive, Num};
use num::BigUint;
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, http_request as mgmt_http_request,
    TransformArgs, HttpResponse, TransformContext,
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

// Konfigurasi HTTP Outcall - Sepolia Testnet
const MORALIS_API_URL: &str = "https://deep-index.moralis.io/api/v2.2";
const MORALIS_API_KEYS: &[&str] = &[
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImMwOTJlODI5LTI2MjgtNDc1Mi1iY2QxLWE4OWE5YTYzYjdkOSIsIm9yZ0lkIjoiMzY0MzE5IiwidXNlcklkIjoiMzc0NDI1IiwidHlwZUlkIjoiMzI4Yzc1ZWUtYzE2ZC00MDg0LTliMDgtM2JlNmUzZmY1YmVmIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE2OTk5MDE3MTksImV4cCI6NDg1NTY2MTcxOX0.mnKyNiqNY5kwkSC9xxG6kLbTdM-jsAhEjzRxZyAvII8",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImU2Mzg3ZDhkLWZhZmMtNGJlZi04NTY5LTNkMDQ1MWRkNThkZCIsIm9yZ0lkIjoiNDcxODE5IiwidXNlcklkIjoiNDg1MzYyIiwidHlwZUlkIjoiOGNlMWRlN2ItZDM3MS00YmM3LTk5NzMtMzdjMTc2MDIyMWFjIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTg0ODYxMTksImV4cCI6NDkxNDI0NjExOX0._0VbFxfb8Ss6kUXrUS3VZdbzvjrNS-KWE93TnVaa6T8"
];
const BLOCKCYPHER_MAINNET_URL: &str = "https://api.blockcypher.com/v1/btc/main";
const BLOCKCYPHER_TOKEN: &str = "dce63e3270ec49cfbc91eff20cbece20";

// Mempool.space API for Bitcoin testnet4
const MEMPOOL_TESTNET4_URL: &str = "https://mempool.space/testnet4/api";

// ERC20 Token addresses on Ethereum Sepolia testnet
const USDC_CONTRACT_ADDRESS: &str = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
const WETH_CONTRACT_ADDRESS: &str = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Sepolia WETH (trying different address)

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
        HttpHeader { name: "User-Agent".into(), value: "Fintrack-Backend/1.0".into() },
    ];
    
    // Calculate cycles based on official IC formula for HTTPS outcalls
    // For 13-node subnets: total_fee = base_fee + size_fee
    // base_fee = (3_000_000 + 60_000 * 13) * 13 = (3_000_000 + 780_000) * 13 = 49_140_000
    // size_fee = (400 * request_bytes + 800 * max_response_bytes) * 13
    let n = 13; // 13-node subnet
    let base_fee = (3_000_000 + 60_000 * n) * n; // 49_140_000
    let request_bytes = url.len() as u64 + 200; // More conservative estimate for headers, transform, etc.
    let size_fee = (400 * request_bytes + 800 * max_response_bytes) * n;
    let calculated_cycles = base_fee + size_fee;
    // Add 10% buffer to account for variations in request size
    let cycles = ((calculated_cycles * 110) / 100) as u128;
    
    let arg = CanisterHttpRequestArgument {
        url: url.into(),
        method: HttpMethod::GET,
        body: None,
        max_response_bytes: Some(max_response_bytes),
        transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
        headers,
    };
    let (resp,): (ic_cdk::api::management_canister::http_request::HttpResponse,) = mgmt_http_request(arg, cycles).await
        .map_err(|e| format!("HTTP outcall failed: {:?}", e))?;
    String::from_utf8(resp.body).map_err(|_| "Failed to decode response body".to_string())
}

// Helper function to get a Moralis API key with rotation
fn get_moralis_api_key() -> &'static str {
    // Use instruction counter to rotate API keys
    let instruction_count = ic_cdk::api::instruction_counter();
    let key_index = (instruction_count % (MORALIS_API_KEYS.len() as u64)) as usize;
    MORALIS_API_KEYS[key_index]
}

async fn http_get_json_with_headers(url: &str, max_response_bytes: u64, custom_headers: Vec<(String, String)>) -> Result<String, String> {
    let mut headers = vec![
        HttpHeader { name: "User-Agent".into(), value: "Fintrack-Backend/1.0".into() },
    ];
    
    // Add custom headers
    for (name, value) in custom_headers {
        headers.push(HttpHeader { name, value });
    }
    
    // Calculate cycles based on official IC formula for HTTPS outcalls
    // For 13-node subnets: total_fee = base_fee + size_fee
    // base_fee = (3_000_000 + 60_000 * 13) * 13 = (3_000_000 + 780_000) * 13 = 49_140_000
    // size_fee = (400 * request_bytes + 800 * max_response_bytes) * 13
    let n = 13; // 13-node subnet
    let base_fee = (3_000_000 + 60_000 * n) * n; // 49_140_000
    let request_bytes = url.len() as u64 + 300; // More conservative estimate for headers, transform, etc. (higher for Moralis API)
    let size_fee = (400 * request_bytes + 800 * max_response_bytes) * n;
    let calculated_cycles = base_fee + size_fee;
    // Add 15% buffer for Moralis API (more headers)
    let cycles = ((calculated_cycles * 115) / 100) as u128;
    
    let arg = CanisterHttpRequestArgument {
        url: url.into(),
        method: HttpMethod::GET,
        body: None,
        max_response_bytes: Some(max_response_bytes),
        transform: Some(TransformContext::from_name("moralis_transform".to_string(), vec![])),
        headers,
    };
    let (resp,): (ic_cdk::api::management_canister::http_request::HttpResponse,) = mgmt_http_request(arg, cycles).await
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
    
    // Get native ETH transactions via Moralis (HTTP outcall)
    let native_eth_txs = match get_native_transactions(user, max_results).await {
        Ok(txs) => txs,
        Err(e) => {
            ic_cdk::println!("Warning: Failed to load native ETH transactions: {}", e);
            Vec::new()
        }
    };
    
    // Get native BTC transactions via Mempool API (separate call to avoid cycle limits)
    let native_btc_txs = match get_native_btc_transactions(user, max_results).await {
        Ok(txs) => txs,
        Err(e) => {
            ic_cdk::println!("Warning: Failed to load native BTC transactions: {}", e);
            Vec::new()
        }
    };
    
    // Store lengths before moving the vectors
    let ckbtc_count = ckbtc_txs.len();
    let cketh_count = cketh_txs.len();
    let native_eth_count = native_eth_txs.len();
    let native_btc_count = native_btc_txs.len();
    
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
    
    // Add native ETH transactions
    for tx in native_eth_txs {
        all_transactions.push(tx);
    }
    
    // Add native BTC transactions
    for tx in native_btc_txs {
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
    
    ic_cdk::println!("Transaction summary for user {}: ckBTC={}, ckETH={}, native_ETH={}, native_BTC={}, total={}", 
        user, ckbtc_count, cketh_count, native_eth_count, native_btc_count, all_transactions.len());
    
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
// Native transactions (BTC & ETH)
// =============================

async fn get_native_transactions(user: Principal, max_results: u32) -> Result<Vec<Transaction>, String> {
    // Get user's ETH address (native address)
    let eth_address = match crate::services::address::get_eth_address(Some(user)).await {
        Ok(addr) => {
            addr
        },
        Err(e) => {
            ic_cdk::println!("Warning: Failed to get ETH address for user {}: {}", user, e);
            // If no ETH address, return empty list instead of error
            return Ok(Vec::new());
        }
    };

    // Get transactions from Moralis API (ETH only)
    match fetch_eth_transfers_for_address(&eth_address, max_results).await {
        Ok(mut txs) => {
            // Store in stable map (overwrite)
            let _ = store_native_txs(user, &txs);
            Ok(txs)
        }
        Err(e) => {
            ic_cdk::println!("Warning: Failed to fetch ETH transactions for address {}: {}", eth_address, e);
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

async fn get_native_btc_transactions(user: Principal, max_results: u32) -> Result<Vec<Transaction>, String> {
    // Get user's BTC address
    let btc_address = match crate::services::address::get_btc_address(Some(user)).await {
        Ok(addr) => {
            addr
        },
        Err(e) => {
            ic_cdk::println!("Warning: Failed to get BTC address for user {}: {}", user, e);
            // If no BTC address, return empty list instead of error
            return Ok(Vec::new());
        }
    };

    // Get BTC transactions from mempool API
    match fetch_btc_transfers_for_address(&btc_address, max_results).await {
        Ok(txs) => {
            Ok(txs)
        }
        Err(e) => {
            ic_cdk::println!("Warning: Failed to fetch BTC transactions for address {}: {}", btc_address, e);
            // Return empty list instead of error
            Ok(Vec::new())
        }
    }
}

async fn fetch_eth_transfers_for_address(address: &str, max_results: u32) -> Result<Vec<Transaction>, String> {
    // Build Moralis API URL
    let url = format!(
        "{}/{}?chain=sepolia&limit={}&order=DESC",
        MORALIS_API_URL, address, max_results
    );

    // Get API key with rotation
    let api_key = get_moralis_api_key();

    // Make HTTP GET request to Moralis API
    let max_bytes = 200_000; // Moralis responses can be larger
    let response = http_get_json_with_headers(&url, max_bytes, vec![
        ("accept".to_string(), "application/json".to_string()),
        ("X-API-Key".to_string(), api_key.to_string()),
    ]).await?;

    // Parse Moralis response
    let txs = parse_moralis_transactions_json(&response, address)?;

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
    let message = v.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
    
    
    if status != "1" {
        return Err(format!("Etherscan API error: {} - {}", message, body));
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
            let big_uint = BigUint::from_str_radix(&value_str[2..], 16).unwrap_or(BigUint::from(0u64));
            Nat::from(big_uint.to_u64_digits().first().copied().unwrap_or(0))
        } else {
            // Decimal value (should be in wei)
            value_str.parse::<u64>().map(Nat::from).unwrap_or(Nat::from(0u64))
        };
        
        let gas_used_str = item.get("gasUsed").and_then(|x| x.as_str()).unwrap_or("0");
        let gas_used = gas_used_str.parse::<u64>().unwrap_or(0);
        
        let gas_price_str = item.get("gasPrice").and_then(|x| x.as_str()).unwrap_or("0");
        let gas_price = if gas_price_str.starts_with("0x") {
            let big_uint = BigUint::from_str_radix(&gas_price_str[2..], 16).unwrap_or(BigUint::from(0u64));
            Nat::from(big_uint.to_u64_digits().first().copied().unwrap_or(0))
        } else {
            gas_price_str.parse::<u64>().map(Nat::from).unwrap_or(Nat::from(0u64))
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

fn parse_moralis_transactions_json(body: &str, user_address: &str) -> Result<Vec<Transaction>, String> {
    
    let v: serde_json::Value = serde_json::from_str(body).map_err(|e| format!("Failed to parse Moralis JSON: {}", e))?;
    
    // Moralis API returns transactions directly in "result" array
    let transactions = v.get("result").and_then(|r| r.as_array()).cloned().unwrap_or_default();
    let mut out = Vec::new();
    
    for item in transactions {
        let tx_hash = item.get("hash").and_then(|x| x.as_str()).unwrap_or("").to_string();
        if tx_hash.is_empty() { continue; }
        
        let block_number = item.get("block_number").and_then(|x| x.as_str()).unwrap_or("0");
        let block_number_u64 = block_number.parse::<u64>().unwrap_or(0);
        
        // Moralis uses ISO 8601 timestamp format
        let timestamp_str = item.get("block_timestamp").and_then(|x| x.as_str()).unwrap_or("");
        let timestamp = if !timestamp_str.is_empty() {
            // Parse ISO 8601 timestamp to nanoseconds
            parse_iso8601_to_unix(timestamp_str).unwrap_or(0)
        } else {
            0
        };
        
        let from_address = item.get("from_address").and_then(|x| x.as_str()).unwrap_or("");
        let to_address = item.get("to_address").and_then(|x| x.as_str()).unwrap_or("");
        
        let value_str = item.get("value").and_then(|x| x.as_str()).unwrap_or("0");
        let amount_wei = if value_str.starts_with("0x") {
            // Hex value
            let big_uint = BigUint::from_str_radix(&value_str[2..], 16).unwrap_or(BigUint::from(0u64));
            Nat::from(big_uint.to_u64_digits().first().copied().unwrap_or(0))
        } else {
            // Decimal value (should be in wei)
            value_str.parse::<u64>().map(Nat::from).unwrap_or(Nat::from(0u64))
        };
        
        let gas_used_str = item.get("receipt_gas_used").and_then(|x| x.as_str()).unwrap_or("0");
        let gas_used = gas_used_str.parse::<u64>().unwrap_or(0);
        
        let gas_price_str = item.get("gas_price").and_then(|x| x.as_str()).unwrap_or("0");
        let gas_price = if gas_price_str.starts_with("0x") {
            let big_uint = BigUint::from_str_radix(&gas_price_str[2..], 16).unwrap_or(BigUint::from(0u64));
            Nat::from(big_uint.to_u64_digits().first().copied().unwrap_or(0))
        } else {
            gas_price_str.parse::<u64>().map(Nat::from).unwrap_or(Nat::from(0u64))
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
        if item.get("receipt_contract_address").and_then(|x| x.as_str()).unwrap_or("") != "" {
            continue;
        }
        
        // Skip transactions with 0 value (contract interactions)
        if amount_wei == Nat::from(0u64) {
            continue;
        }
        
        // Calculate confirmations (assuming current block is latest)
        let confirmations = if block_number_u64 > 0 { 1 } else { 0 };
        
        // Calculate status based on receipt_status
        let receipt_status = item.get("receipt_status").and_then(|x| x.as_str()).unwrap_or("0");
        let status = if receipt_status == "1" { "CONFIRMED" } else { "PENDING" };
        
        out.push(Transaction {
            id: TransactionId { 
                chain: "ETH".to_string(),
                tx_hash: tx_hash.clone(), 
                timestamp 
            },
            icp_tx: None,
            btc_tx: None,
            eth_tx: Some(EthereumTransaction {
                tx_hash: tx_hash.clone(),
                block_number: block_number_u64,
                confirmations,
                amount: amount_wei,
                gas_used,
                gas_price,
                timestamp,
                address: from_address.to_string(),
                operation: operation.to_string(),
            }),
            status: status.to_string(),
            description: "Native ETH transfer".to_string(),
        });
    }
    Ok(out)
}

// Fetch Bitcoin transactions from mempool.space testnet4 API
async fn fetch_btc_transfers_for_address(address: &str, max_results: u32) -> Result<Vec<Transaction>, String> {
    // Build mempool API URL
    let url = format!(
        "{}/address/{}/txs",
        MEMPOOL_TESTNET4_URL, address
    );


    // Make HTTP GET request to mempool API
    let max_bytes = 200_000; // Mempool responses can be large, but limit to avoid cycle issues
    // Calculate cycles using official IC formula: base_fee + size_fee
    let n = 13; // 13-node subnet
    let base_fee = (3_000_000 + 60_000 * n) * n; // 49_140_000
    let request_bytes = url.len() as u64 + 200; // More conservative estimate
    let size_fee = (400 * request_bytes + 800 * max_bytes) * n;
    let calculated_cycles = base_fee + size_fee;
    let estimated_cycles = (calculated_cycles * 110) / 100; // 10% buffer
    let response = http_get_json(&url, max_bytes).await?;

    // Parse mempool response
    let txs = parse_mempool_transactions_json(&response, address)?;

    // Sort by timestamp and limit results
    let mut sorted_txs = txs;
    sorted_txs.sort_by(|a, b| b.id.timestamp.cmp(&a.id.timestamp));
    sorted_txs.truncate(max_results as usize);
    Ok(sorted_txs)
}

fn parse_mempool_transactions_json(body: &str, user_address: &str) -> Result<Vec<Transaction>, String> {
    
    let transactions: Vec<serde_json::Value> = serde_json::from_str(body)
        .map_err(|e| format!("Failed to parse mempool JSON: {}", e))?;
    
    let mut out = Vec::new();
    
    for tx in transactions {
        let txid = tx.get("txid").and_then(|x| x.as_str()).unwrap_or("").to_string();
        if txid.is_empty() { continue; }
        
        let block_height = tx.get("status")
            .and_then(|s| s.get("block_height"))
            .and_then(|h| h.as_u64())
            .unwrap_or(0) as u32;
        
        let block_time = tx.get("status")
            .and_then(|s| s.get("block_time"))
            .and_then(|t| t.as_u64())
            .unwrap_or(0);
        
        let confirmed = tx.get("status")
            .and_then(|s| s.get("confirmed"))
            .and_then(|c| c.as_bool())
            .unwrap_or(false);
        
        let confirmations = if confirmed && block_height > 0 { 
            // Estimate confirmations (assuming current block is latest)
            // For testnet, we'll use a simple estimation
            if block_height > 0 { 6 } else { 0 }
        } else { 
            0 
        };
        
        // Parse inputs and outputs to determine operation type and amount
        let mut total_input_value = 0u64;
        let mut total_output_value = 0u64;
        let mut user_input_value = 0u64;
        let mut user_output_value = 0u64;
        
        // Calculate input values
        if let Some(vin) = tx.get("vin").and_then(|v| v.as_array()) {
            for input in vin {
                if let Some(prevout) = input.get("prevout") {
                    if let Some(value) = prevout.get("value").and_then(|v| v.as_u64()) {
                        total_input_value += value;
                        
                        // Check if this input is from our user
                        if let Some(addr) = prevout.get("scriptpubkey_address").and_then(|a| a.as_str()) {
                            if addr.to_lowercase() == user_address.to_lowercase() {
                                user_input_value += value;
                            }
                        }
                    }
                }
            }
        }
        
        // Calculate output values
        if let Some(vout) = tx.get("vout").and_then(|v| v.as_array()) {
            for output in vout {
                if let Some(value) = output.get("value").and_then(|v| v.as_u64()) {
                    total_output_value += value;
                    
                    // Check if this output is to our user
                    if let Some(addr) = output.get("scriptpubkey_address").and_then(|a| a.as_str()) {
                        if addr.to_lowercase() == user_address.to_lowercase() {
                            user_output_value += value;
                        }
                    }
                }
            }
        }
        
        // Determine operation type and amount
        let (operation, amount) = if user_input_value > 0 && user_output_value > 0 {
            // Both input and output to user (change transaction)
            ("BTC_TRANSFER_CHANGE", user_input_value - (total_input_value - total_output_value))
        } else if user_input_value > 0 {
            // Only input from user (outgoing)
            ("BTC_TRANSFER_OUT", user_input_value - (total_input_value - total_output_value))
        } else if user_output_value > 0 {
            // Only output to user (incoming)
            ("BTC_TRANSFER_IN", user_output_value)
        } else {
            // Skip transactions not involving the user
            continue;
        };
        
        // Skip transactions with 0 amount
        if amount == 0 {
            continue;
        }
        
        // Calculate fee
        let fee = if total_input_value > total_output_value {
            total_input_value - total_output_value
        } else {
            0
        };
        
        // Convert timestamp to nanoseconds (mempool returns seconds)
        let timestamp_ns = block_time * 1_000_000_000;
        
        // Calculate status
        let status = if confirmed { "CONFIRMED" } else { "PENDING" };
        
        out.push(Transaction {
            id: TransactionId { 
                chain: "Bitcoin".to_string(), 
                tx_hash: txid.clone(), 
                timestamp: timestamp_ns 
            },
            icp_tx: None,
            btc_tx: Some(BitcoinTransaction {
                txid: txid.clone(),
                block_height,
                confirmations,
                amount,
                fee,
                timestamp: timestamp_ns,
                address: user_address.to_string(),
                operation: operation.to_string(),
            }),
            eth_tx: None,
            status: status.to_string(),
            description: "Native BTC transfer".to_string(),
        });
    }
    
    Ok(out)
}

// Transform function for Moralis API to ensure deterministic responses
#[ic_cdk::query]
pub fn moralis_transform(args: TransformArgs) -> HttpResponse {
    // Parse the response body to ensure it's valid JSON and strip any non-deterministic fields
    let body_str = match String::from_utf8(args.response.body.clone()) {
        Ok(s) => s,
        Err(_) => return HttpResponse { 
            status: candid::Nat::from(500u64), 
            body: b"Invalid response encoding".to_vec(), 
            headers: vec![] 
        }
    };

    // Try to parse as JSON and re-serialize to ensure deterministic format
    match serde_json::from_str::<serde_json::Value>(&body_str) {
        Ok(json) => {
            // Re-serialize with deterministic ordering
            match serde_json::to_string(&json) {
                Ok(deterministic_json) => HttpResponse { 
                    status: args.response.status, 
                    body: deterministic_json.into_bytes(), 
                    headers: vec![] 
                },
                Err(_) => HttpResponse { 
                    status: candid::Nat::from(500u64), 
                    body: b"Failed to serialize response".to_vec(), 
                    headers: vec![] 
                }
            }
        },
        Err(_) => {
            // If not JSON, return as-is but strip headers
            HttpResponse { 
                status: args.response.status, 
                body: args.response.body, 
                headers: vec![] 
            }
        }
    }
}

// Note: transform function for rates is defined in rates.rs to avoid symbol conflicts



// Helper function to estimate EVM RPC cost with buffer
async fn get_evm_rpc_cost_with_buffer(
    source: JsonRpcSource,
    json_request: String,
    max_response_bytes: u64
) -> Result<u128, String> {
    let evm_rpc = Principal::from_text("giifx-2iaaa-aaaab-qb5ua-cai").unwrap();
    
    // Convert JsonRpcSource to RpcService
    let rpc_service = match source {
        JsonRpcSource::EthSepolia => crate::services::evm_rpc_canister::RpcService::EthSepolia(
            crate::services::evm_rpc_canister::EthSepoliaService::Alchemy
        ),
        JsonRpcSource::EthMainnet => crate::services::evm_rpc_canister::RpcService::EthMainnet(
            crate::services::evm_rpc_canister::EthMainnetService::Alchemy
        ),
    };
    
    // Get cost estimate
    let (cost_result,): (Result<candid::Nat, crate::services::evm_rpc_canister::RpcError>,) = ic_cdk::api::call::call(
        evm_rpc,
        "requestCost",
        (rpc_service, json_request.clone(), max_response_bytes),
    )
    .await
    .map_err(|e| format!("Failed to get cost estimate: {:?}", e))?;
    
    let base_cost = cost_result.map_err(|e| format!("Cost estimation failed: {:?}", e))?;
    
    // Convert candid::Nat to u128 and add 50% buffer
    let base_cost_u128 = base_cost.0.to_u128().unwrap_or(1_000_000);
    let buffered_cost = base_cost_u128 + (base_cost_u128 / 2);
    
    Ok(buffered_cost)
}

// Get ERC20 balance using raw JSON-RPC request (more reliable)
async fn get_erc20_balance_eth_call(
    user_address: &str,
    contract_address: &str,
    token_name: &str
) -> Result<Nat, String> {
    // EVM RPC canister ID
    let evm_rpc = Principal::from_text("giifx-2iaaa-aaaab-qb5ua-cai").unwrap();
    
    // Prepare call data for balanceOf(address) function
    // balanceOf function signature: 0x70a08231
    let user_address_clean = user_address.strip_prefix("0x").unwrap_or(user_address);
    
    // Decode hex address to bytes, pad to 32 bytes, then encode back
    let addr_bytes = hex::decode(user_address_clean)
        .map_err(|_| "invalid address hex".to_string())?;
    let mut padded = [0u8; 32];
    padded[12..].copy_from_slice(&addr_bytes); // address = 20 bytes, pad left with 12 zeros
    let call_data = format!("0x70a08231{}", hex::encode(padded));
    
    // Create raw JSON-RPC payload
    let payload = format!(
        r#"{{"jsonrpc":"2.0","method":"eth_call","params":[{{"to":"{}","data":"{}"}},"latest"],"id":1}}"#,
        contract_address, call_data
    );
    
    // Get cost estimate with buffer
    let cycles = get_evm_rpc_cost_with_buffer(
        JsonRpcSource::EthSepolia,
        payload.clone(),
        2048u64
    ).await?;
    
    
    // Make the raw JSON-RPC request
    let rpc_service_for_request = crate::services::evm_rpc_canister::RpcService::EthSepolia(
        crate::services::evm_rpc_canister::EthSepoliaService::Alchemy
    );
    let (result,): (crate::services::evm_rpc_canister::RequestResult,) = call_with_payment128(
        evm_rpc,
        "request",
        (rpc_service_for_request, payload, 2048u64),
        cycles,
    )
    .await
    .map_err(|e| format!("eth_call request failed for {}: {:?}", token_name, e))?;
    
    // Parse the JSON response
    match result {
        Ok(json_response) => {
            // Parse JSON to get the result field
            let response: serde_json::Value = serde_json::from_str(&json_response)
                .map_err(|e| format!("Failed to parse JSON response: {}", e))?;
            
            if let Some(result_hex) = response.get("result").and_then(|v| v.as_str()) {
                if result_hex == "0x" || result_hex.is_empty() {
                    return Ok(Nat::from(0u64));
                }
                
                // Convert hex result to Nat
                let balance_hex = result_hex.strip_prefix("0x").unwrap_or(result_hex);
                let big_uint = BigUint::from_str_radix(balance_hex, 16)
                    .unwrap_or(BigUint::from(0u64));
                
                // Convert BigUint to Nat properly
                let balance = if big_uint == BigUint::from(0u64) {
                    Nat::from(0u64)
                } else {
                    // Convert BigUint to u64 digits and create Nat
                    let digits = big_uint.to_u64_digits();
                    if digits.is_empty() {
                        Nat::from(0u64)
                    } else if digits.len() == 1 {
                        Nat::from(digits[0])
                    } else {
                        // For large numbers, use the first digit (simplified)
                        Nat::from(digits[0])
                    }
                };
                
                Ok(balance)
            } else {
                ic_cdk::println!("Warning: No result field in JSON response for {}", token_name);
                Ok(Nat::from(0u64))
            }
        }
        Err(error) => {
            ic_cdk::println!("Warning: RPC error for {}: {:?}", token_name, error);
            Ok(Nat::from(0u64)) // Return 0 on error instead of failing
        }
    }
}


// Get USDC balance using eth_call
async fn get_usdc_balance(user_address: &str) -> Result<Nat, String> {
    get_erc20_balance_eth_call(user_address, USDC_CONTRACT_ADDRESS, "USDC").await
}

// Get WETH balance using eth_call
async fn get_weth_balance(user_address: &str) -> Result<Nat, String> {
    get_erc20_balance_eth_call(user_address, WETH_CONTRACT_ADDRESS, "WETH").await
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
            return Ok(balances);
        }
    }
    
    // Fetch all balances in parallel for better performance
    
    // Start all balance fetches in parallel
    let ckbtc_future = get_ckbtc_balance(user, None);
    let cketh_future = get_cketh_balance(user, None);
    let eth_address_future = crate::services::address::get_eth_address(Some(user));
    let btc_address_future = crate::services::address::get_btc_address(Some(user));
    
    // Wait for address derivations first
    let (eth_address, btc_address) = match futures::future::try_join(eth_address_future, btc_address_future).await {
        Ok((eth_addr, btc_addr)) => (eth_addr, btc_addr),
        Err(e) => {
            ic_cdk::println!("Warning: Failed to get addresses for user: {}, error: {}", user, e);
            ("".to_string(), "".to_string())
        }
    };
    
    // Start native balance fetches in parallel
    let eth_address_clone = eth_address.clone();
    let btc_address_clone = btc_address.clone();
    
    let eth_native_future = async move {
        if !eth_address_clone.is_empty() {
            crate::services::ethtransfer::get_native_eth_balance(Some(eth_address_clone)).await
        } else {
            Ok(Nat::from(0u32))
        }
    };
    
    let btc_native_future = async move {
        if !btc_address_clone.is_empty() {
            crate::services::btctransfer::get_native_btc_balance(btc_address_clone).await
        } else {
            Ok(0u64)
        }
    };
    
    // Wait for all basic balances
    let (ckbtc_balance, cketh_balance, eth_native_balance, btc_native_result) = futures::future::try_join4(
        ckbtc_future,
        cketh_future,
        eth_native_future,
        btc_native_future
    ).await?;
    
    let btc_native_balance = Nat::from(btc_native_result);

           // Get ERC20 balances (USDC and WETH) in parallel since rate limiting is resolved
           let (usdc_balance, weth_balance) = if !eth_address.is_empty() {
               
               // Fetch both balances in parallel
               let usdc_future = get_usdc_balance(&eth_address);
               let weth_future = get_weth_balance(&eth_address);
               
               let (usdc_result, weth_result) = futures::future::join(usdc_future, weth_future).await;
               
               let usdc_balance = match usdc_result {
                   Ok(balance) => {
                       balance
                   },
                   Err(e) => {
                       ic_cdk::println!("Warning: Failed to get USDC balance: {}, using 0", e);
                       Nat::from(0u64)
                   }
               };
               
               let weth_balance = match weth_result {
                   Ok(balance) => {
                       balance
                   },
                   Err(e) => {
                       ic_cdk::println!("Warning: Failed to get WETH balance: {}, using 0", e);
                       Nat::from(0u64)
                   }
               };
               
               (usdc_balance, weth_balance)
           } else {
               (Nat::from(0u64), Nat::from(0u64))
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
