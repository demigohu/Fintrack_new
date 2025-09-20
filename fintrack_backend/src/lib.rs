mod services;

use candid::{Nat, Principal};
use ic_cdk::api::management_canister::http_request::{TransformArgs, HttpResponse};
use crate::services::evm_rpc_canister::BlockTag;
use crate::services::ethtransfer::InitArg;
use services::budget as budget;
use services::goals as goals;
use services::kongswap as kongswap;

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

#[ic_cdk::update]
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

// -------------------------
// Uniswap service endpoints
// -------------------------

#[ic_cdk::update]
async fn uniswap_send_tx(request: services::uniswap::TxRequest) -> Result<String, String> {
    services::uniswap::send_uniswap_tx(request).await
}

#[ic_cdk::update]
async fn uniswap_send_tx_with_response(request: services::uniswap::TxRequest) -> Result<services::uniswap::UniswapTxResponse, String> {
    services::uniswap::send_uniswap_tx_with_response(request).await
}

#[ic_cdk::update]
async fn uniswap_get_gas_price() -> Result<u128, String> {
    services::uniswap::get_current_gas_price().await
}

#[ic_cdk::update]
async fn uniswap_send_approval_tx(request: services::uniswap::TxRequest) -> Result<String, String> {
    services::uniswap::send_approval_tx(request).await
}

#[ic_cdk::update]
async fn uniswap_get_fresh_nonce(owner: Option<Principal>) -> Result<u64, String> {
    services::uniswap::get_fresh_nonce(owner).await
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

#[ic_cdk::update]
async fn get_market_chart(coin_id: String, vs_currency: String, days: u32) -> Result<services::rates::MarketChartData, String> {
    services::rates::get_market_chart(&coin_id, &vs_currency, days).await
}

#[ic_cdk::update]
async fn get_24h_change(coin_id: String) -> Result<f64, String> {
    services::rates::get_24h_change(&coin_id).await
}

#[ic_cdk::update]
async fn get_historical_prices(coin_id: String, vs_currency: String, days: u32) -> Result<Vec<services::rates::PriceData>, String> {
    services::rates::get_historical_prices(&coin_id, &vs_currency, days).await
}

// -------------------------
// Network info endpoints (pollable)
// -------------------------

#[ic_cdk::update]
async fn btc_get_network_info(address: Option<String>) -> Result<services::btc::BtcNetworkInfo, String> {
    services::btc::get_network_info(address).await
}



// -------------------------
// Budgeting endpoints
// -------------------------

#[ic_cdk::update]
async fn budget_create(req: budget::BudgetCreateRequest) -> Result<budget::BudgetInfo, String> {
    budget::create_budget(req).await
}

#[ic_cdk::query]
fn budget_list(owner: Option<Principal>) -> Vec<budget::BudgetInfo> {
    budget::list_budgets(owner)
}

#[ic_cdk::query]
fn budget_list_by_asset(owner: Option<Principal>, asset: Principal) -> Vec<budget::BudgetInfo> {
    budget::list_budgets_by_asset(owner, asset)
}

#[ic_cdk::query]
fn budget_get(id: String) -> Option<budget::BudgetInfo> {
    budget::get_budget(id)
}

#[ic_cdk::query]
fn budget_list_events(id: String, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<budget::BudgetEvent>, String> {
    budget::budget_list_events(id, limit, offset)
}

#[ic_cdk::query]
fn budget_preview_accrual(id: String) -> Result<budget::BudgetAccrualPreview, String> {
    budget::budget_preview_accrual(id)
}

#[ic_cdk::update]
async fn budget_refresh_accrual_step(id: String, max_delta: Option<Nat>) -> Result<budget::BudgetInfo, String> {
    budget::budget_refresh_accrual_step(id, max_delta)
}

#[ic_cdk::update]
async fn budget_refresh_accrual(id: String) -> Result<budget::BudgetInfo, String> {
    budget::budget_refresh_accrual(id)
}

#[ic_cdk::query]
fn budget_get_escrow_account(id: String) -> Result<budget::Account, String> {
    budget::get_escrow_account(id)
}

#[ic_cdk::update]
fn budget_pause(id: String) -> Result<(), String> {
    budget::pause_budget(id)
}

#[ic_cdk::update]
fn budget_resume(id: String) -> Result<(), String> {
    budget::resume_budget(id)
}

#[ic_cdk::update]
async fn budget_delete(id: String) -> Result<(), String> {
    budget::delete_budget(id).await
}

#[ic_cdk::update]
async fn budget_update(id: String, upd: budget::BudgetUpdateRequest) -> Result<budget::BudgetInfo, String> {
    // pure state mutation, no await inside
    budget::update_budget(id, upd)
}

#[ic_cdk::update]
async fn budget_trigger_lock_now(id: String) -> Result<(), String> {
    budget::trigger_lock_now(id).await
}

// removed budget_trigger_unlock_now: linear vesting accrues on write

#[ic_cdk::query]
fn budget_preview_schedule(id: String) -> Result<Vec<budget::BudgetSchedulePreviewItem>, String> {
    budget::budget_preview_schedule(id)
}

#[ic_cdk::query]
fn budget_required_allowance(id: String) -> Result<Nat, String> {
    budget::budget_required_allowance(id)
}

#[ic_cdk::update]
async fn budget_required_amounts(id: String) -> Result<budget::BudgetAmountRequirements, String> {
    budget::budget_required_amounts(id).await
}

#[ic_cdk::update]
async fn budget_preview_requirements(
    asset_canister: Principal,
    asset_kind: budget::AssetKind,
    amount_to_lock: Nat,
) -> Result<budget::BudgetAmountRequirements, String> {
    budget::budget_preview_requirements(asset_canister, asset_kind, amount_to_lock).await
}

#[ic_cdk::update]
async fn budget_create_and_lock(req: budget::BudgetCreateRequest) -> Result<budget::BudgetInfo, String> {
    budget::budget_create_and_lock(req).await
}

#[ic_cdk::update]
async fn budget_withdraw(id: String, amount: Nat, to_subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    budget::budget_withdraw(id, amount, to_subaccount).await
}

#[ic_cdk::pre_upgrade]
fn pre_upgrade() {
    budget::pre_upgrade();
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    budget::post_upgrade();
}



// -------------------------
// Goals endpoints
// -------------------------

#[ic_cdk::update]
async fn goals_create_and_lock(req: goals::GoalCreateRequest) -> Result<goals::GoalInfo, String> {
    goals::goals_create_and_lock(req).await
}

#[ic_cdk::query]
fn goals_get(id: String) -> Option<goals::GoalInfo> { goals::goals_get(id) }

#[ic_cdk::query]
fn goals_list(owner: Option<Principal>) -> Vec<goals::GoalInfo> { goals::goals_list(owner) }

#[ic_cdk::query]
fn goals_get_progress(id: String) -> Result<goals::GoalProgress, String> { goals::goals_get_progress(id) }

#[ic_cdk::update]
fn goals_refresh(id: String) -> Result<goals::GoalInfo, String> { goals::goals_refresh(id) }

#[ic_cdk::update]
async fn goals_add_funds(id: String, amount: Nat) -> Result<goals::GoalInfo, String> { goals::goals_add_funds(id, amount).await }

#[ic_cdk::update]
async fn goals_withdraw(id: String, amount: Nat) -> Result<Nat, String> { goals::goals_withdraw(id, amount).await }

#[ic_cdk::query]
fn goals_list_events(id: String, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<goals::GoalEvent>, String> { goals::goals_list_events(id, limit, offset) }

// -------------------------
// KongSwap service endpoints
// -------------------------

#[ic_cdk::update]
async fn kongswap_preview_swap(request: kongswap::KongSwapRequest) -> Result<kongswap::KongSwapPreview, String> {
    kongswap::preview_swap(request).await
}

#[ic_cdk::update]
async fn kongswap_swap_tokens_async(request: kongswap::KongSwapRequest) -> Result<u64, String> {
    kongswap::swap_tokens_async(request).await
}

#[ic_cdk::query]
async fn kongswap_get_current_price() -> Result<f64, String> {
    kongswap::get_current_price().await
}

#[ic_cdk::query]
async fn kongswap_is_service_available() -> Result<bool, String> {
    kongswap::is_service_available().await
}

#[ic_cdk::query]
fn kongswap_format_token_amount(amount: Nat, token: String) -> String {
    kongswap::format_token_amount(amount, &token)
}

#[ic_cdk::query]
fn kongswap_parse_token_amount(amount_str: String, token: String) -> Result<Nat, String> {
    kongswap::parse_token_amount(&amount_str, &token)
}

// KongSwap multi-hop swap endpoints
#[ic_cdk::query]
async fn kongswap_get_request(request_id: u64) -> Result<kongswap::RequestsReply, String> {
    kongswap::get_request(request_id).await
}

#[ic_cdk::query]
async fn kongswap_poll_swap_status(request_id: u64) -> Result<kongswap::KongSwapResponse, String> {
    kongswap::poll_swap_status(request_id).await
}

#[ic_cdk::query]
async fn kongswap_get_swap_amounts(pay_token: String, pay_amount: Nat, receive_token: String) -> Result<kongswap::SwapAmountsReply, String> {
    kongswap::get_swap_amounts(pay_token, pay_amount, receive_token).await
}


ic_cdk::export_candid!();