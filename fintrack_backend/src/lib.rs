mod services;

use candid::{Nat, Principal};
use ic_cdk::{
    bitcoin_canister::{bitcoin_get_utxos, GetUtxosRequest, GetUtxosResponse},
    update,
};

// -------------------------
// BTC service endpoints
// -------------------------

#[ic_cdk::update]
async fn btc_get_deposit_address(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<String, String> {
    services::btc::get_deposit_address(owner, subaccount).await
}

#[ic_cdk::update]
async fn btc_refresh_balance(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<(), String> {
    services::btc::refresh_balance(owner, subaccount).await
}

#[ic_cdk::update]
async fn btc_get_balance(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    services::btc::get_balance(owner, subaccount).await
}

/// Returns the UTXOs of the given Bitcoin address with simplified response (hash and confirmations only)
#[ic_cdk::update]
async fn btc_get_utxos(address: String) -> Result<Vec<services::btc::SimplifiedUtxo>, String> {
    services::btc::get_utxos(address).await
}

// -------------------------
// ETH service endpoints
// -------------------------

#[ic_cdk::update]
async fn eth_get_deposit_address(subaccount: Option<Vec<u8>>) -> Result<String, String> {
    services::eth::get_deposit_address(subaccount).await
}

#[ic_cdk::update]
async fn eth_refresh_balance(subaccount: Option<Vec<u8>>) -> Result<(), String> {
    services::eth::refresh_balance(subaccount).await
}

#[ic_cdk::update]
async fn eth_get_balance(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    services::eth::get_balance(owner, subaccount).await
}

// eth_withdraw_with_approval removed: user calls minter directly after approve

// Additional ckETH helper endpoints

#[ic_cdk::query]
async fn eth_get_minter_address() -> Result<String, String> {
    services::eth::get_minter_address().await
}

#[ic_cdk::query]
async fn eth_get_minter_info() -> Result<String, String> {
    services::eth::get_minter_info().await
}

#[ic_cdk::query]
async fn eth_estimate_withdrawal_fee() -> Result<String, String> {
    services::eth::estimate_withdrawal_fee().await
}

// Principal to bytes32 conversion endpoint
#[ic_cdk::query]
fn principal_to_bytes32(principal_text: String) -> Result<String, String> {
    services::utils::principal_to_bytes32(principal_text)
}

// -------------------------
// Transaction service endpoints
// -------------------------

#[ic_cdk::update]
async fn get_transaction_history(
    user: Principal,
    limit: Option<u32>,
    offset: Option<u32>
) -> Result<Vec<services::transactions::Transaction>, String> {
    services::transactions::get_user_transaction_history(user, limit, offset).await
}

#[ic_cdk::query]
async fn get_user_balances(user: Principal) -> Result<services::transactions::UserBalances, String> {
    services::transactions::get_user_balances(user).await
}

#[ic_cdk::query]
async fn get_transaction_count(user: Principal) -> u32 {
    services::transactions::get_transaction_count(user)
}

#[ic_cdk::update]
async fn clear_user_transactions(user: Principal) {
    services::transactions::clear_user_transactions(user);
}

ic_cdk::export_candid!();