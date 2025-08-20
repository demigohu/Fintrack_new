use candid::{CandidType, Nat, Principal};
use ic_cdk::api::call::call;
use std::collections::HashMap;
use std::cell::RefCell;
use serde_bytes::ByteBuf;
use serde::Deserialize;
use num_traits::cast::ToPrimitive;

// Transaction types matching the Candid interface
#[derive(CandidType, Clone, Debug)]
pub struct TransactionId {
    pub chain: String,
    pub tx_hash: String,
    pub timestamp: u64,
}

#[derive(CandidType, Clone, Debug)]
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

#[derive(CandidType, Clone, Debug)]
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

#[derive(CandidType, Clone, Debug)]
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

#[derive(CandidType, Clone, Debug)]
pub struct Transaction {
    pub id: TransactionId,
    pub icp_tx: Option<IcpTransaction>,
    pub btc_tx: Option<BitcoinTransaction>,
    pub eth_tx: Option<EthereumTransaction>,
    pub status: String,
    pub description: String,
}

#[derive(CandidType, Clone, Debug)]
pub struct UserBalances {
    pub ckbtc_balance: Nat,
    pub cketh_balance: Nat,
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
    
    let balances = UserBalances {
        ckbtc_balance,
        cketh_balance,
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
