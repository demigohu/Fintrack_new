mod services;

use candid::{Nat, Principal};
use ic_cdk::api::management_canister::http_request::{TransformArgs, HttpResponse};
use crate::services::evm_rpc_canister::BlockTag;
use crate::services::ethtransfer::InitArg;

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

/// Returns the 100 fee percentiles measured in millisatoshi/byte for Bitcoin network
#[ic_cdk::update]
async fn btc_get_current_fee_percentiles() -> Result<Vec<u64>, String> {
    services::btc::get_current_fee_percentiles().await
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

// ckETH balance (ledger)
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

/// Returns the historical fee data to estimate gas prices for Ethereum transactions
#[ic_cdk::query]
async fn eth_fee_history() -> Result<String, String> {
    services::eth::fee_history().await
}

// Principal to bytes32 conversion endpoint
#[ic_cdk::query]
fn principal_to_bytes32(principal_text: String) -> Result<String, String> {
    services::utils::principal_to_bytes32(principal_text)
}

// -------------------------
// Address derivation (EVM/BTC) via ECDSA
// -------------------------

#[ic_cdk::update]
async fn evm_derive_address(owner: Option<Principal>) -> Result<String, String> {
    services::address::get_eth_address(owner).await
}



#[ic_cdk::update]
async fn eth_get_native_balance(address: Option<String>) -> Result<Nat, String> {
    services::ethtransfer::get_native_eth_balance(address).await
}

#[ic_cdk::query]
async fn eth_get_transaction_count(owner: Option<Principal>, block: Option<String>) -> Result<u64, String> {
    let block_tag = match block.as_deref() {
        Some("latest") => Some(BlockTag::Latest),
        Some("finalized") => Some(BlockTag::Finalized),
        Some("earliest") => Some(BlockTag::Earliest),
        Some("pending") => Some(BlockTag::Pending),
        Some(_) => None,
        None => None,
    };
    Ok(services::ethtransfer::get_transaction_count(owner, block_tag).await)
}

#[ic_cdk::update]
async fn btc_derive_address(owner: Option<Principal>) -> Result<String, String> {
    services::address::get_btc_address(owner).await
}

// -------------------------
// Transfer services
// -------------------------

#[ic_cdk::update]
async fn btc_transfer(request: services::btctransfer::BtcTransferRequest) -> Result<services::btctransfer::BtcTransferResponse, String> {
    services::btctransfer::transfer_btc(request).await
}

#[ic_cdk::update]
async fn eth_transfer(request: services::ethtransfer::EthTransferRequest) -> Result<services::ethtransfer::EthTransferResponse, String> {
    services::ethtransfer::transfer_eth(request).await
}

#[ic_cdk::update]
async fn btc_get_utxos_for_address(address: String) -> Result<Vec<ic_cdk::bitcoin_canister::Utxo>, String> {
    services::btctransfer::get_utxos_for_address(address).await
}

#[ic_cdk::update]
async fn btc_get_fee_percentiles() -> Result<Vec<ic_cdk::bitcoin_canister::MillisatoshiPerByte>, String> {
    services::btctransfer::get_current_fee_percentiles().await
}

#[ic_cdk::update]
async fn btc_get_native_balance(address: String) -> Result<u64, String> {
    services::btctransfer::get_native_btc_balance(address).await
}

// -------------------------
// Fee Preview endpoints
// -------------------------

#[ic_cdk::update]
async fn eth_preview_fee(
    destination_address: String,
    amount: Nat,
    gas_limit: Option<u128>
) -> Result<services::ethtransfer::EthFeePreview, String> {
    services::ethtransfer::preview_eth_fee(destination_address, amount, gas_limit).await
}

#[ic_cdk::update]
async fn btc_preview_fee(
    destination_address: String,
    amount_in_satoshi: u64,
    owner: Option<Principal>
) -> Result<services::btctransfer::BtcFeePreview, String> {
    services::btctransfer::preview_btc_fee(destination_address, amount_in_satoshi, owner).await
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

#[ic_cdk::update]
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

// -------------------------
// Rates service endpoints (HTTP outcalls)
// -------------------------

#[ic_cdk::update]
async fn get_crypto_usd_rate(crypto_id: String) -> Result<f64, String> {
    services::rates::get_crypto_usd_rate(&crypto_id).await
}

#[ic_cdk::update]
async fn get_rates_summary() -> Result<services::rates::CryptoRates, String> {
    services::rates::get_rates_summary().await
}

ic_cdk::export_candid!();