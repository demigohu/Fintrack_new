use candid::{CandidType, Nat, Principal};
use ic_cdk::api::call::call;

// Helper: read ckETH minter and ledger principals from dfx.json (baked-in for now)
fn cketh_minter_principal() -> Principal {
    // From dfx.json -> cketh_minter.specified_id
    Principal::from_text("jzenf-aiaaa-aaaar-qaa7q-cai").expect("invalid cketh_minter principal")
}

fn cketh_ledger_principal() -> Principal {
    // From dfx.json -> cketh_ledger.specified_id
    Principal::from_text("apia6-jaaaa-aaaar-qabma-cai").expect("invalid cketh_ledger principal")
}

// NOTE: For now, these are stubs to be wired to ckETH minter/ledger.

pub async fn get_deposit_address(_subaccount: Option<Vec<u8>>) -> Result<String, String> {
    let minter = cketh_minter_principal();
    // smart_contract_address returns the helper contract address for ETH deposits
    let (contract_address,): (String,) = call(minter, "smart_contract_address", ())
        .await
        .map_err(|e| format!("smart_contract_address failed: {:?}", e))?;
    
    if contract_address == "N/A" {
        return Err("Helper contract not configured".to_string());
    }
    
    Ok(contract_address)
}

pub async fn refresh_balance(_subaccount: Option<Vec<u8>>) -> Result<(), String> {
    // ckETH minter automatically scrapes Ethereum for deposits
    // No manual refresh needed, just return success
    Ok(())
}

pub async fn get_balance(owner: Option<Principal>, subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    let ledger = cketh_ledger_principal();
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

// Additional helper functions for ckETH

pub async fn get_minter_address() -> Result<String, String> {
    let minter = cketh_minter_principal();
    let (address,): (String,) = call(minter, "minter_address", ())
        .await
        .map_err(|e| format!("minter_address failed: {:?}", e))?;
    Ok(address)
}

pub async fn get_minter_info() -> Result<String, String> {
    let minter = cketh_minter_principal();
    let (info,): (String,) = call(minter, "get_minter_info", ())
        .await
        .map_err(|e| format!("get_minter_info failed: {:?}", e))?;
    Ok(info)
}

pub async fn estimate_withdrawal_fee() -> Result<String, String> {
    let minter = cketh_minter_principal();
    // eip_1559_transaction_price takes Option<Eip1559TransactionPriceArg> where None means ETH withdrawal
    let (fee_info,): (String,) = call(minter, "eip_1559_transaction_price", (None::<Option<()>>,))
        .await
        .map_err(|e| format!("eip_1559_transaction_price failed: {:?}", e))?;
    Ok(fee_info)
}


