use candid::{CandidType, Nat, Principal};
use ic_cdk::api::call::call;
use ic_cdk::{
    bitcoin_canister::{bitcoin_get_utxos, bitcoin_get_current_fee_percentiles, GetUtxosRequest, GetUtxosResponse, GetCurrentFeePercentilesRequest},
};

// Simplified UTXO structure for frontend consumption - only hash and confirmations
#[derive(CandidType, serde::Deserialize, Clone, Debug)]
pub struct SimplifiedUtxo {
    pub hash: String,           // Transaction hash
    pub confirmations: u32,     // Number of confirmations
}

// Helper: read ckBTC minter and ledger principals from dfx.json (baked-in for now)
// In production, consider storing in stable state or ENV via build-time feature.
fn ckbtc_minter_principal() -> Principal {
    // From dfx.json -> ckbtc_minter.specified_id
    Principal::from_text("ml52i-qqaaa-aaaar-qaaba-cai").expect("invalid ckbtc_minter principal")
}

fn ckbtc_ledger_principal() -> Principal {
    // From dfx.json -> ckbtc_ledger.specified_id
    Principal::from_text("mc6ru-gyaaa-aaaar-qaaaq-cai").expect("invalid ckbtc_ledger principal")
}

// NOTE: For now, these are stubs to be wired to ckBTC minter/ledger.

pub async fn get_deposit_address(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<String, String> {
    let minter = ckbtc_minter_principal();
    #[derive(candid::CandidType)]
    struct AddressArg {
        owner: Option<Principal>,
        subaccount: Option<Vec<u8>>,
    }
    let arg = (AddressArg { owner, subaccount },);
    let (address,): (String,) = call(minter, "get_btc_address", arg)
        .await
        .map_err(|e| format!("get_btc_address failed: {:?}", e))?;
    Ok(address)
}

pub async fn refresh_balance(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<(), String> {
    let minter = ckbtc_minter_principal();
    // update_balance returns variant { Ok : vec UtxoStatus; Err : UpdateBalanceError }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    struct Outpoint {
        txid: Vec<u8>,
        vout: u32,
    }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    struct Utxo {
        outpoint: Outpoint,
        value: u64,
        height: u32,
    }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    struct PendingUtxo {
        outpoint: Outpoint,
        value: u64,
        confirmations: u32,
    }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    enum SuspendedReason { ValueTooSmall, Quarantined }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    struct SuspendedUtxo {
        utxo: Utxo,
        reason: SuspendedReason,
        earliest_retry: u64,
    }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    enum UtxoStatus {
        ValueTooSmall(Utxo),
        Tainted(Utxo),
        Checked(Utxo),
        Minted { block_index: u64, minted_amount: u64, utxo: Utxo },
    }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    enum UpdateBalanceError {
        NoNewUtxos {
            current_confirmations: Option<u32>,
            required_confirmations: u32,
            pending_utxos: Option<Vec<PendingUtxo>>,
            suspended_utxos: Option<Vec<SuspendedUtxo>>,
        },
        AlreadyProcessing,
        TemporarilyUnavailable(String),
        GenericError { error_message: String, error_code: u64 },
    }

    #[derive(CandidType, serde::Deserialize, Clone, Debug)]
    enum UpdateResult {
        Ok(Vec<UtxoStatus>),
        Err(UpdateBalanceError),
    }

    // Build record
    #[derive(CandidType)]
    struct UpdateArg {
        owner: Option<Principal>,
        subaccount: Option<Vec<u8>>,
    }

    let arg = (UpdateArg { owner, subaccount },);
    // We don't need detailed structure, just success/failure mapping via candid.
    let (res,): (UpdateResult,) = call(minter, "update_balance", arg)
        .await
        .map_err(|e| format!("update_balance failed: {:?}", e))?;
    match res {
        UpdateResult::Ok(_) => Ok(()),
        UpdateResult::Err(e) => Err(format!("update_balance returned Err: {:?}", e)),
    }
}

pub async fn get_balance(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    let ledger = ckbtc_ledger_principal();
    #[derive(CandidType)]
    struct AccountArg {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }
    let caller = ic_cdk::caller();
    let resolved_owner = owner.unwrap_or(caller);
    let arg = (AccountArg { owner: resolved_owner, subaccount },);
    let (balance,): (Nat,) = call(ledger, "icrc1_balance_of", arg)
        .await
        .map_err(|e| format!("icrc1_balance_of failed: {:?}", e))?;
    Ok(balance)
}

// withdraw_with_approval removed: user should call minter directly from frontend after approving.

/// Get UTXOs for a Bitcoin address using the Bitcoin canister
pub async fn get_utxos(address: String) -> Result<Vec<SimplifiedUtxo>, String> {
    // For local development, use Regtest network
    let network = ic_cdk::bitcoin_canister::Network::Regtest;
    
    let request = GetUtxosRequest {
        address: address.clone(),
        network,
        filter: None,
    };
    
    let response: GetUtxosResponse = bitcoin_get_utxos(&request)
        .await
        .map_err(|e| format!("Failed to get UTXOs: {:?}", e))?;
    
    // Convert to simplified format - only hash and confirmations
    let simplified_utxos: Vec<SimplifiedUtxo> = response
        .utxos
        .into_iter()
        .map(|utxo| SimplifiedUtxo {
            hash: hex::encode(utxo.outpoint.txid),
            confirmations: utxo.height,
        })
        .collect();
    
    Ok(simplified_utxos)
}

/// Get current Bitcoin fee percentiles in millisatoshi/byte
pub async fn get_current_fee_percentiles() -> Result<Vec<u64>, String> {
    // For local development, use Regtest network
    let network = ic_cdk::bitcoin_canister::Network::Regtest;
    
    let request = GetCurrentFeePercentilesRequest {
        network,
    };
    
    let fee_percentiles = bitcoin_get_current_fee_percentiles(&request)
        .await
        .map_err(|e| format!("Failed to get fee percentiles: {:?}", e))?;
    
    // Convert MillisatoshiPerByte to u64 for easier handling
    let fees: Vec<u64> = fee_percentiles
        .into_iter()
        .map(|fee| fee.into())
        .collect();
    
    Ok(fees)
}


