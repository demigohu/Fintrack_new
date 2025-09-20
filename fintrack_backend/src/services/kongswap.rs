use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::call::call_with_payment128;
use serde::Deserialize as SerdeDeserialize;
use num_traits::ToPrimitive;

// KongSwap Canister ID
const KONGSWAP_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";

// Token identifiers for ckBTC and ckETH
const CKBTC_SYMBOL: &str = "ckBTC";
const CKETH_SYMBOL: &str = "ckETH";

// Helper function to get KongSwap canister principal
fn get_kongswap_canister() -> Principal {
    Principal::from_text(KONGSWAP_CANISTER_ID).unwrap()
}

// ============================================================================
// KongSwap API Types (based on the candid file)
// ============================================================================

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct SwapArgs {
    pub pay_token: String,
    pub pay_amount: Nat,
    pub pay_tx_id: Option<TxId>,
    pub receive_token: String,
    pub receive_amount: Option<Nat>,
    pub receive_address: Option<String>,
    pub max_slippage: Option<f64>,
    pub referred_by: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TxId {
    #[serde(rename = "BlockIndex")]
    pub block_index: Option<Nat>,
    #[serde(rename = "TransactionId")]
    pub transaction_id: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct SwapAmountsReply {
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_address: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_address: String,
    pub receive_amount: Nat,
    pub price: f64,
    pub mid_price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapAmountsTxReply>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct SwapAmountsTxReply {
    pub pool_symbol: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_address: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_address: String,
    pub receive_amount: Nat,
    pub price: f64,
    pub lp_fee: Nat,
    pub gas_fee: Nat,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct SwapReply {
    pub tx_id: u64,
    pub request_id: u64,
    pub status: String,
    pub pay_chain: String,
    pub pay_address: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_address: String,
    pub receive_symbol: String,
    pub receive_amount: Nat,
    pub mid_price: f64,
    pub price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapTxReply>,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct SwapTxReply {
    pub pool_symbol: String,
    pub pay_chain: String,
    pub pay_address: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_address: String,
    pub receive_symbol: String,
    pub receive_amount: Nat,
    pub price: f64,
    pub lp_fee: Nat,
    pub gas_fee: Nat,
    pub ts: u64,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TransferIdReply {
    pub transfer_id: u64,
    pub transfer: TransferReply,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TransferReply {
    #[serde(rename = "IC")]
    pub ic: ICTransferReply,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct ICTransferReply {
    pub chain: String,
    pub symbol: String,
    pub is_send: bool,
    pub amount: Nat,
    pub canister_id: String,
    pub block_index: Nat,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TokenReply {
    #[serde(rename = "IC")]
    pub ic: ICTokenReply,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct ICTokenReply {
    pub token_id: u32,
    pub chain: String,
    pub canister_id: String,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: Nat,
    pub icrc1: bool,
    pub icrc2: bool,
    pub icrc3: bool,
    pub is_removed: bool,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct PoolReply {
    pub pool_id: u32,
    pub name: String,
    pub symbol: String,
    pub chain_0: String,
    pub symbol_0: String,
    pub address_0: String,
    pub balance_0: Nat,
    pub lp_fee_0: Nat,
    pub chain_1: String,
    pub symbol_1: String,
    pub address_1: String,
    pub balance_1: Nat,
    pub lp_fee_1: Nat,
    pub price: f64,
    pub lp_fee_bps: u8,
    pub lp_token_symbol: String,
    pub is_removed: bool,
}

// Result types
#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct SwapAmountsResult {
    #[serde(rename = "Ok")]
    pub ok: Option<SwapAmountsReply>,
    #[serde(rename = "Err")]
    pub err: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct SwapResult {
    #[serde(rename = "Ok")]
    pub ok: Option<SwapReply>,
    #[serde(rename = "Err")]
    pub err: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct TokensResult {
    #[serde(rename = "Ok")]
    pub ok: Option<Vec<TokenReply>>,
    #[serde(rename = "Err")]
    pub err: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct PoolsResult {
    #[serde(rename = "Ok")]
    pub ok: Option<Vec<PoolReply>>,
    #[serde(rename = "Err")]
    pub err: Option<String>,
}

// ============================================================================
// Frontend-facing types
// ============================================================================

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct KongSwapRequest {
    pub from_token: String,        // "ckBTC" or "ckETH"
    pub to_token: String,          // "ckBTC" or "ckETH"
    pub amount: Nat,               // Amount to swap (in smallest unit)
    pub max_slippage: Option<f64>, // Optional slippage tolerance (e.g., 0.01 for 1%)
    pub referred_by: Option<String>, // Optional referral code
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct KongSwapResponse {
    pub success: bool,
    pub tx_id: Option<u64>,
    pub request_id: Option<u64>,
    pub status: Option<String>,
    pub from_amount: Option<Nat>,
    pub to_amount: Option<Nat>,
    pub price: Option<f64>,
    pub slippage: Option<f64>,
    pub error: Option<String>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct KongSwapPreview {
    pub from_token: String,
    pub to_token: String,
    pub from_amount: Nat,
    pub to_amount: Nat,
    pub price: f64,
    pub mid_price: f64,
    pub slippage: f64,
    pub lp_fee: Nat,
    pub gas_fee: Nat,
}

// ============================================================================
// KongSwap Service Functions
// ============================================================================

/// Get available tokens from KongSwap
pub async fn get_tokens() -> Result<Vec<TokenReply>, String> {
    let canister = get_kongswap_canister();
    let cycles = 1_000_000_000_u128; // 1B cycles for query

    let (result,): (TokensResult,) = ic_cdk::call(canister, "tokens", (None::<String>,))
        .await
        .map_err(|e| format!("Failed to call tokens: {:?}", e))?;

    match result {
        TokensResult { ok: Some(tokens), err: None } => Ok(tokens),
        TokensResult { ok: None, err: Some(error) } => Err(format!("KongSwap error: {}", error)),
        _ => Err("Unexpected response from KongSwap".to_string()),
    }
}

/// Get available pools from KongSwap
pub async fn get_pools() -> Result<Vec<PoolReply>, String> {
    let canister = get_kongswap_canister();
    let cycles = 1_000_000_000_u128; // 1B cycles for query

    let (result,): (PoolsResult,) = ic_cdk::call(canister, "pools", (None::<String>,))
        .await
        .map_err(|e| format!("Failed to call pools: {:?}", e))?;

    match result {
        PoolsResult { ok: Some(pools), err: None } => Ok(pools),
        PoolsResult { ok: None, err: Some(error) } => Err(format!("KongSwap error: {}", error)),
        _ => Err("Unexpected response from KongSwap".to_string()),
    }
}

/// Get swap amounts preview (how much you'll receive)
pub async fn get_swap_amounts(
    pay_token: String,
    pay_amount: Nat,
    receive_token: String,
) -> Result<SwapAmountsReply, String> {
    let canister = get_kongswap_canister();
    let cycles = 1_000_000_000_u128; // 1B cycles for query

    let (result,): (SwapAmountsResult,) = ic_cdk::call(
        canister,
        "swap_amounts",
        (pay_token, pay_amount, receive_token),
    )
    .await
    .map_err(|e| format!("Failed to call swap_amounts: {:?}", e))?;

    match result {
        SwapAmountsResult { ok: Some(amounts), err: None } => Ok(amounts),
        SwapAmountsResult { ok: None, err: Some(error) } => Err(format!("KongSwap error: {}", error)),
        _ => Err("Unexpected response from KongSwap".to_string()),
    }
}

/// Execute a swap transaction
pub async fn execute_swap(args: SwapArgs) -> Result<SwapReply, String> {
    let canister = get_kongswap_canister();
    let cycles = 10_000_000_000_u128; // 10B cycles for update call

    let (result,): (SwapResult,) = ic_cdk::call(canister, "swap", (args,))
        .await
        .map_err(|e| format!("Failed to call swap: {:?}", e))?;

    match result {
        SwapResult { ok: Some(swap_reply), err: None } => Ok(swap_reply),
        SwapResult { ok: None, err: Some(error) } => Err(format!("KongSwap error: {}", error)),
        _ => Err("Unexpected response from KongSwap".to_string()),
    }
}

/// Execute a swap asynchronously (returns request_id for polling)
pub async fn execute_swap_async(args: SwapArgs) -> Result<u64, String> {
    let canister = get_kongswap_canister();
    let cycles = 10_000_000_000_u128; // 10B cycles for update call

    let (result,): (Result<u64, String>,) = ic_cdk::call(canister, "swap_async", (args,))
        .await
        .map_err(|e| format!("Failed to call swap_async: {:?}", e))?;

    result.map_err(|e| format!("KongSwap async error: {}", e))
}

// ============================================================================
// High-level KongSwap Functions
// ============================================================================

/// Preview a swap between ckBTC and ckETH
pub async fn preview_swap(request: KongSwapRequest) -> Result<KongSwapPreview, String> {
    // Validate tokens
    if !is_valid_token(&request.from_token) || !is_valid_token(&request.to_token) {
        return Err("Invalid token. Only ckBTC and ckETH are supported.".to_string());
    }

    if request.from_token == request.to_token {
        return Err("Cannot swap token to itself".to_string());
    }

    // Get swap amounts from KongSwap
    let amounts = get_swap_amounts(
        request.from_token.clone(),
        request.amount.clone(),
        request.to_token.clone(),
    ).await?;

    Ok(KongSwapPreview {
        from_token: request.from_token,
        to_token: request.to_token,
        from_amount: request.amount,
        to_amount: amounts.receive_amount,
        price: amounts.price,
        mid_price: amounts.mid_price,
        slippage: amounts.slippage,
        lp_fee: amounts.txs.first().map(|tx| tx.lp_fee.clone()).unwrap_or(Nat::from(0u64)),
        gas_fee: amounts.txs.first().map(|tx| tx.gas_fee.clone()).unwrap_or(Nat::from(0u64)),
    })
}

/// Execute a swap between ckBTC and ckETH
pub async fn swap_tokens(request: KongSwapRequest) -> Result<KongSwapResponse, String> {
    // Validate tokens
    if !is_valid_token(&request.from_token) || !is_valid_token(&request.to_token) {
        return Err("Invalid token. Only ckBTC and ckETH are supported.".to_string());
    }

    if request.from_token == request.to_token {
        return Err("Cannot swap token to itself".to_string());
    }

    // Build swap arguments
    let swap_args = SwapArgs {
        pay_token: request.from_token.clone(),
        pay_amount: request.amount.clone(),
        pay_tx_id: None, // Will be set by user via ICRC transfer
        receive_token: request.to_token.clone(),
        receive_amount: None, // Let KongSwap calculate
        receive_address: None, // Use caller's address
        max_slippage: request.max_slippage,
        referred_by: request.referred_by,
    };

    // Execute swap
    match execute_swap(swap_args).await {
        Ok(swap_reply) => Ok(KongSwapResponse {
            success: true,
            tx_id: Some(swap_reply.tx_id),
            request_id: Some(swap_reply.request_id),
            status: Some(swap_reply.status),
            from_amount: Some(swap_reply.pay_amount),
            to_amount: Some(swap_reply.receive_amount),
            price: Some(swap_reply.price),
            slippage: Some(swap_reply.slippage),
            error: None,
        }),
        Err(error) => Ok(KongSwapResponse {
            success: false,
            tx_id: None,
            request_id: None,
            status: None,
            from_amount: None,
            to_amount: None,
            price: None,
            slippage: None,
            error: Some(error),
        }),
    }
}

/// Execute a swap asynchronously (for polling status)
pub async fn swap_tokens_async(request: KongSwapRequest) -> Result<u64, String> {
    // Validate tokens
    if !is_valid_token(&request.from_token) || !is_valid_token(&request.to_token) {
        return Err("Invalid token. Only ckBTC and ckETH are supported.".to_string());
    }

    if request.from_token == request.to_token {
        return Err("Cannot swap token to itself".to_string());
    }

    // Build swap arguments
    let swap_args = SwapArgs {
        pay_token: request.from_token.clone(),
        pay_amount: request.amount.clone(),
        pay_tx_id: None, // Will be set by user via ICRC transfer
        receive_token: request.to_token.clone(),
        receive_amount: None, // Let KongSwap calculate
        receive_address: None, // Use caller's address
        max_slippage: request.max_slippage,
        referred_by: request.referred_by,
    };

    // Execute swap asynchronously
    execute_swap_async(swap_args).await
}

/// Get available ckBTC/ckETH pools
pub async fn get_ckbtc_cketh_pools() -> Result<Vec<PoolReply>, String> {
    let pools = get_pools().await?;
    
    // Filter for ckBTC/ckETH pools
    let ckbtc_cketh_pools: Vec<PoolReply> = pools
        .into_iter()
        .filter(|pool| {
            (pool.symbol_0 == CKBTC_SYMBOL && pool.symbol_1 == CKETH_SYMBOL) ||
            (pool.symbol_0 == CKETH_SYMBOL && pool.symbol_1 == CKBTC_SYMBOL)
        })
        .collect();

    Ok(ckbtc_cketh_pools)
}

/// Get ckBTC and ckETH token information
pub async fn get_ckbtc_cketh_tokens() -> Result<Vec<ICTokenReply>, String> {
    let tokens = get_tokens().await?;
    
    // Filter for ckBTC and ckETH tokens
    let ckbtc_cketh_tokens: Vec<ICTokenReply> = tokens
        .into_iter()
        .filter_map(|token| match token {
            TokenReply { ic } if ic.symbol == CKBTC_SYMBOL || ic.symbol == CKETH_SYMBOL => Some(ic),
            _ => None,
        })
        .collect();

    Ok(ckbtc_cketh_tokens)
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Validate if token is supported (ckBTC or ckETH)
fn is_valid_token(token: &str) -> bool {
    token == CKBTC_SYMBOL || token == CKETH_SYMBOL
}

/// Convert amount to proper decimal places based on token
pub fn format_token_amount(amount: Nat, token: &str) -> String {
    let decimals = match token {
        CKBTC_SYMBOL => 8,  // ckBTC has 8 decimals
        CKETH_SYMBOL => 18, // ckETH has 18 decimals
        _ => 8, // Default to 8 decimals
    };

    // Convert to f64 for formatting
    let amount_f64 = amount.0.to_f64().unwrap_or(0.0);
    let divisor = 10_f64.powi(decimals as i32);
    let formatted = amount_f64 / divisor;
    
    format!("{:.8}", formatted)
}

/// Parse token amount from decimal string
pub fn parse_token_amount(amount_str: &str, token: &str) -> Result<Nat, String> {
    let decimals = match token {
        CKBTC_SYMBOL => 8,  // ckBTC has 8 decimals
        CKETH_SYMBOL => 18, // ckETH has 18 decimals
        _ => 8, // Default to 8 decimals
    };

    let amount_f64: f64 = amount_str.parse()
        .map_err(|e| format!("Invalid amount format: {}", e))?;

    let multiplier = 10_f64.powi(decimals as i32);
    let amount_u64 = (amount_f64 * multiplier) as u64;
    
    Ok(Nat::from(amount_u64))
}

/// Get current price between ckBTC and ckETH
pub async fn get_current_price() -> Result<f64, String> {
    // Use a small amount to get current price
    let small_amount = Nat::from(1000u64); // 0.00001 ckBTC or 0.000000000000001 ckETH
    
    let amounts = get_swap_amounts(
        CKBTC_SYMBOL.to_string(),
        small_amount,
        CKETH_SYMBOL.to_string(),
    ).await?;

    Ok(amounts.price)
}

/// Check if KongSwap service is available
pub async fn is_service_available() -> Result<bool, String> {
    match get_tokens().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
