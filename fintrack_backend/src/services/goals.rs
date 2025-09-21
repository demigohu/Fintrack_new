use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::{caller, api::time};
use std::collections::BTreeMap;
use num_traits::ToPrimitive;

// Goals: nabung dengan hard-lock ke escrow subaccount canister.
// Satu kali lock, unlock cliff di akhir periode. Tidak ada vesting linear.

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum GoalStatus { Active, Completed, Failed, Archived }

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum AssetKind { CkBtc, CkEth }

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GoalCreateRequest {
    pub asset_canister: Principal,
    pub asset_kind: AssetKind,
    pub name: String,
    pub amount_to_lock: Nat,
    pub start_ns: u64,
    pub end_ns: u64, // unlock cliff at end
    pub initial_amount: Option<Nat>, // optional: transfer langsung saat create
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GoalInfo {
    pub id: String,
    pub owner: Principal,
    pub asset_canister: Principal,
    pub name: String,
    pub amount_to_lock: Nat,
    pub locked_balance: Nat,
    pub available_to_withdraw: Nat,
    pub decimals: u32,
    pub start_ns: u64,
    pub end_ns: u64,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
    pub status: GoalStatus,
}

#[derive(Clone, Debug)]
struct GoalInternal { info: GoalInfo }

thread_local! { static GOALS: std::cell::RefCell<BTreeMap<String, GoalInternal>> = std::cell::RefCell::new(BTreeMap::new()); }

// -------- History events --------
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum GoalEventKind {
    InitialLock,
    AddFunds,
    Withdraw,
    CliffUnlocked,
    TargetReached,
    Failed,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GoalEvent {
    pub at_time_ns: u64,
    pub kind: GoalEventKind,
    pub amount: Option<Nat>,
    pub note: Option<String>,
}

thread_local! {
    static GOAL_EVENTS: std::cell::RefCell<BTreeMap<String, Vec<GoalEvent>>> = std::cell::RefCell::new(BTreeMap::new());
}

fn push_goal_event(id: &str, ev: GoalEvent) {
    GOAL_EVENTS.with(|e| {
        let mut map = e.borrow_mut();
        map.entry(id.to_string()).or_default().push(ev);
    });
}

fn decimals_for_asset(kind: &AssetKind) -> u32 { match kind { AssetKind::CkBtc => 8, AssetKind::CkEth => 18 } }

// Reuse budget escrow derivation
fn escrow_subaccount(owner: &Principal, goal_id: &str) -> [u8; 32] {
    use sha3::{Digest, Keccak256};
    let mut hasher = Keccak256::new();
    hasher.update(owner.as_slice());
    hasher.update(goal_id.as_bytes());
    let hash = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&hash[..32]);
    out
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Account { pub owner: Principal, pub subaccount: Option<Vec<u8>> }

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransferFromArg {
    pub from: Account,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
    pub spender_subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransferArg {
    pub from_subaccount: Option<Vec<u8>>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

async fn icrc2_transfer_from(token: Principal, arg: TransferFromArg) -> Result<Nat, String> {
    ic_cdk::call::<_, (Result<Nat, String>,)>(token, "icrc2_transfer_from", (arg,))
        .await.map_err(|e| format!("call failed: {:?}", e)).and_then(|(r,)| r.map_err(|e| e))
}

async fn icrc1_transfer(token: Principal, arg: TransferArg) -> Result<Nat, String> {
    ic_cdk::call::<_, (Result<Nat, String>,)>(token, "icrc1_transfer", (arg,))
        .await.map_err(|e| format!("call failed: {:?}", e)).and_then(|(r,)| r.map_err(|e| e))
}

async fn icrc1_fee(token: Principal) -> Result<Nat, String> {
    let (fee,): (Nat,) = ic_cdk::api::call::call_with_payment128(token, "icrc1_fee", (), 1_000_000).await
        .map_err(|e| format!("call failed: {:?}", e))?;
    Ok(fee)
}

fn principal_account(owner: Principal) -> Account { Account { owner, subaccount: None } }
fn canister_escrow_account(sub: [u8; 32]) -> Account { Account { owner: ic_cdk::id(), subaccount: Some(sub.to_vec()) } }

pub async fn goals_create_and_lock(req: GoalCreateRequest) -> Result<GoalInfo, String> {
    if req.name.trim().is_empty() { return Err("name tidak boleh kosong".to_string()); }
    if req.amount_to_lock.0 == num::BigUint::from(0u32) { return Err("amount_to_lock harus > 0".to_string()); }
    if req.end_ns <= req.start_ns { return Err("end_ns harus > start_ns".to_string()); }

    let owner = caller();
    let created = time();
    let id = format!("goal-{}-{}-{}", owner, req.asset_canister, created);
    
    // Mulai dengan locked_balance = 0, atau initial_amount jika ada
    let initial_locked = req.initial_amount.as_ref().unwrap_or(&Nat(num::BigUint::from(0u32))).clone();
    
    let info = GoalInfo {
        id: id.clone(),
        owner,
        asset_canister: req.asset_canister,
        name: req.name,
        amount_to_lock: req.amount_to_lock.clone(), // ini target
        locked_balance: initial_locked.clone(),
        available_to_withdraw: Nat(num::BigUint::from(0u32)),
        decimals: decimals_for_asset(&req.asset_kind),
        start_ns: req.start_ns,
        end_ns: req.end_ns,
        created_at_ns: created,
        updated_at_ns: created,
        status: GoalStatus::Active,
    };

    // Simpan goal dulu
    GOALS.with(|g| g.borrow_mut().insert(id.clone(), GoalInternal { info: info.clone() }));

    // Jika ada initial_amount, transfer langsung
    if let Some(initial) = req.initial_amount {
        if initial.0 > num::BigUint::from(0u32) {
            let from = principal_account(owner);
            let to = canister_escrow_account(escrow_subaccount(&owner, &id));
            let arg = TransferFromArg { 
                from, 
                to, 
                amount: initial.clone(), 
                fee: None, 
                memo: Some(b"goals_initial_lock".to_vec()), 
                created_at_time: Some(created), 
                spender_subaccount: None 
            };
            
            match icrc2_transfer_from(req.asset_canister, arg).await {
                Ok(_h) => {
                    // Update locked_balance setelah transfer berhasil
                    GOALS.with(|g| {
                        if let Some(gi) = g.borrow_mut().get_mut(&id) {
                            gi.info.locked_balance = initial.clone();
                            gi.info.updated_at_ns = time();
                        }
                    });
                    // Log event
                    push_goal_event(&id, GoalEvent {
                        at_time_ns: time(),
                        kind: GoalEventKind::InitialLock,
                        amount: Some(initial),
                        note: None,
                    });
                }
                Err(e) => {
                    // Jika transfer gagal, hapus goal yang sudah dibuat
                    GOALS.with(|g| g.borrow_mut().remove(&id));
                    return Err(e);
                }
            }
        }
    }

    Ok(info)
}

pub fn goals_get(id: String) -> Option<GoalInfo> { 
    // Update all goals status first
    update_all_goals_status();
    
    GOALS.with(|g| g.borrow().get(&id).map(|gi| gi.info.clone())) 
}
pub fn goals_list(owner: Option<Principal>) -> Vec<GoalInfo> {
    // Update all goals status first
    update_all_goals_status();
    
    let who = owner.unwrap_or_else(caller);
    GOALS.with(|g| g.borrow().values().filter(|gi| gi.info.owner == who).map(|gi| gi.info.clone()).collect())
}

// Cek progress goal (berapa persen target yang sudah tercapai)
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub struct GoalProgress {
    pub goal_id: String,
    pub target_amount: Nat,
    pub current_locked: Nat,
    pub progress_percentage: f64, // 0.0 - 100.0
    pub is_target_reached: bool,
}

pub fn goals_get_progress(id: String) -> Result<GoalProgress, String> {
    GOALS.with(|g| {
        let map = g.borrow();
        let gi = map.get(&id).ok_or_else(|| "goal not found".to_string())?;
        if gi.info.owner != caller() { return Err("unauthorized".to_string()); }
        
        let target = &gi.info.amount_to_lock.0;
        let current = &gi.info.locked_balance.0;
        
        let progress = if target > &num::BigUint::from(0u32) {
            (current.to_f64().unwrap_or(0.0) / target.to_f64().unwrap_or(1.0)) * 100.0
        } else {
            0.0
        };
        
        Ok(GoalProgress {
            goal_id: id,
            target_amount: gi.info.amount_to_lock.clone(),
            current_locked: gi.info.locked_balance.clone(),
            progress_percentage: progress,
            is_target_reached: current >= target,
        })
    })
}

// Unlock cliff: hanya setelah end_ns tercapai, seluruh locked dipindahkan ke available.
pub fn goals_refresh(id: String) -> Result<GoalInfo, String> {
    GOALS.with(|g| {
        let mut map = g.borrow_mut();
        let gi = map.get_mut(&id).ok_or_else(|| "goal not found".to_string())?;
        let now = time();
        if now >= gi.info.end_ns && gi.info.locked_balance.0 > num::BigUint::from(0u32) {
            let amt = gi.info.locked_balance.clone();
            gi.info.locked_balance = Nat(num::BigUint::from(0u32));
            gi.info.available_to_withdraw = Nat(&gi.info.available_to_withdraw.0 + &amt.0);
            gi.info.status = GoalStatus::Completed;
            gi.info.updated_at_ns = now;
            
            // Log cliff unlock event
            push_goal_event(&id, GoalEvent {
                at_time_ns: now,
                kind: GoalEventKind::CliffUnlocked,
                amount: Some(amt),
                note: Some("Cliff period ended, funds unlocked!".to_string()),
            });
        }
        Ok(gi.info.clone())
    })
}

// Add funds to existing goal (cicilan)
pub async fn goals_add_funds(id: String, amount: Nat) -> Result<GoalInfo, String> {
    if amount.0 == num::BigUint::from(0u32) { return Err("amount harus > 0".to_string()); }
    
    // Update all goals status first
    update_all_goals_status();
    
    let (asset, owner, current_locked, escrow) = GOALS.with(|g| {
        let map = g.borrow();
        let gi = map.get(&id).ok_or_else(|| "goal not found".to_string())?;
        if gi.info.owner != caller() { return Err("unauthorized".to_string()); }
        if gi.info.status != GoalStatus::Active { return Err("goal tidak aktif".to_string()); }
        Ok((gi.info.asset_canister, gi.info.owner, gi.info.locked_balance.clone(), canister_escrow_account(escrow_subaccount(&gi.info.owner, &gi.info.id))))
    })?;

    // Transfer dari user ke escrow
    let from = principal_account(owner);
    let to = escrow;
    let arg = TransferFromArg { 
        from, 
        to, 
        amount: amount.clone(), 
        fee: None, 
        memo: Some(b"goals_add_funds".to_vec()), 
        created_at_time: Some(time()), 
        spender_subaccount: None 
    };
    
    match icrc2_transfer_from(asset, arg).await {
        Ok(_h) => {
            GOALS.with(|g| {
                if let Some(gi) = g.borrow_mut().get_mut(&id) {
                    gi.info.locked_balance = Nat(&gi.info.locked_balance.0 + &amount.0);
                    gi.info.updated_at_ns = time();
                    
                    // Cek apakah target sudah tercapai
                    if gi.info.locked_balance.0 >= gi.info.amount_to_lock.0 {
                        gi.info.status = GoalStatus::Completed;
                        push_goal_event(&id, GoalEvent {
                            at_time_ns: time(),
                            kind: GoalEventKind::TargetReached,
                            amount: Some(gi.info.amount_to_lock.clone()),
                            note: Some("Target amount reached!".to_string()),
                        });
                    }
                }
            });
            // Log add funds event
            push_goal_event(&id, GoalEvent {
                at_time_ns: time(),
                kind: GoalEventKind::AddFunds,
                amount: Some(amount),
                note: None,
            });
            goals_get(id).ok_or_else(|| "goal not found after update".to_string())
        }
        Err(e) => Err(e)
    }
}

pub async fn goals_withdraw(id: String, amount: Nat) -> Result<Nat, String> {
    if amount.0 == num::BigUint::from(0u32) { return Err("amount harus > 0".into()); }
    let (asset, owner, available, escrow) = GOALS.with(|g| {
        let map = g.borrow();
        let gi = map.get(&id).ok_or_else(|| "goal not found".to_string())?;
        if gi.info.owner != caller() { return Err("unauthorized".to_string()); }
        Ok((gi.info.asset_canister, gi.info.owner, gi.info.available_to_withdraw.clone(), canister_escrow_account(escrow_subaccount(&gi.info.owner, &gi.info.id))))
    })?;
    if amount.0 > available.0 { return Err("amount > available".to_string()); }

    // Ambil fee ledger dan kirim net = amount - fee. State mengurangi amount penuh.
    let fee = icrc1_fee(asset).await?;
    if amount.0 <= fee.0 { return Err("amount harus > fee ledger".to_string()); }
    let net = Nat(&amount.0 - &fee.0);

    // Transfer balik ke user dengan net amount
    let arg = TransferArg { from_subaccount: escrow.subaccount.clone(), to: principal_account(owner), amount: net.clone(), fee: None, memo: Some(b"goals_user_withdraw".to_vec()), created_at_time: Some(time()) };
    let res = icrc1_transfer(asset, arg).await?;
    GOALS.with(|g| if let Some(gi) = g.borrow_mut().get_mut(&id) { gi.info.available_to_withdraw = Nat(&gi.info.available_to_withdraw.0 - &amount.0); gi.info.updated_at_ns = time(); });
    
    // Log withdraw event
    push_goal_event(&id, GoalEvent {
        at_time_ns: time(),
        kind: GoalEventKind::Withdraw,
        amount: Some(amount),
        note: Some(format!("fee_deducted:{}", fee.0)),
    });
    
    Ok(res)
}

// List events untuk goal
pub fn goals_list_events(id: String, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<GoalEvent>, String> {
    let off = offset.unwrap_or(0) as usize;
    let lim = limit.unwrap_or(50) as usize;
    GOAL_EVENTS.with(|e| {
        let map = e.borrow();
        let v = map.get(&id).cloned().unwrap_or_default();
        let end = (off + lim).min(v.len());
        if off >= v.len() { Ok(vec![]) } else { Ok(v[off..end].to_vec()) }
    })
}

// Helper function to check and update goal status based on time and target
fn check_and_update_goal_status(goal: &mut GoalInfo) {
    let now = time();
    
    // Check if period has ended
    if now >= goal.end_ns {
        if goal.locked_balance.0 >= goal.amount_to_lock.0 {
            // Target reached and period ended - Completed
            goal.status = GoalStatus::Completed;
        } else {
            // Period ended but target not reached - Failed
            goal.status = GoalStatus::Failed;
        }
        goal.updated_at_ns = now;
    } else if goal.locked_balance.0 >= goal.amount_to_lock.0 {
        // Target reached before period ended - Completed
        goal.status = GoalStatus::Completed;
        goal.updated_at_ns = now;
    }
    // If period hasn't ended and target not reached, keep as Active
}

// Update all goals status based on current time
pub fn update_all_goals_status() {
    GOALS.with(|g| {
        let mut map = g.borrow_mut();
        for (_, goal_internal) in map.iter_mut() {
            check_and_update_goal_status(&mut goal_internal.info);
        }
    });
}


