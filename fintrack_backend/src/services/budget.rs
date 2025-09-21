use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::{caller};
use ic_cdk::api::time;
use ic_cdk_timers::{clear_timer, TimerId};
use std::collections::BTreeMap;
use super::timers;

// Budgeting with hard-lock (escrow under canister principal) and daily unlock based on calendar days in month.

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum BudgetStatus {
    Active,
    Paused,
    Archived,
    Completed,
    Failed,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BudgetCreateRequest {
    pub asset_canister: Principal, // ICRC-1/2 token canister id
    pub asset_kind: AssetKind, // praktis: ckbtc/cketh menentukan decimals
    pub name: String,
    pub amount_to_lock: Nat, // jumlah dana yang dikunci untuk periode (base units)
    pub period_start_ns: u64, // awal periode vesting (dan jadwal lock terjadi)
    pub period_end_ns: u64,   // akhir periode vesting
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BudgetUpdateRequest {
    pub name: Option<String>,
    pub amount_to_lock: Option<Nat>,
    pub status: Option<BudgetStatus>,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BudgetInfo {
    pub id: String,
    pub owner: Principal,
    pub asset_canister: Principal,
    pub name: String,
    pub amount_to_lock: Nat,
    pub locked_balance: Nat,
    pub decimals: u32,
    pub available_to_withdraw: Nat,
    pub status: BudgetStatus,
    pub next_lock_at_ns: u64,
    pub next_unlock_at_ns: u64,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
    // Accrual pro-rata
    pub period_start_ns: u64,
    pub period_end_ns: u64,
    pub period_locked: Nat,
    pub unlocked_so_far: Nat,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum AssetKind {
    CkBtc,
    CkEth,
}

#[derive(Clone, Debug)]
struct BudgetInternal {
    info: BudgetInfo,
    lock_timer: Option<TimerId>,
    unlock_timer: Option<TimerId>,
}

thread_local! {
    static BUDGETS: std::cell::RefCell<BTreeMap<String, BudgetInternal>> = std::cell::RefCell::new(BTreeMap::new());
}

// -------- History events --------
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum BudgetEventKind {
    LockSucceeded,
    LockFailed,
    Withdraw,
    PeriodCompleted,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BudgetEvent {
    pub at_time_ns: u64,
    pub kind: BudgetEventKind,
    pub amount: Option<Nat>,
    pub note: Option<String>,
}

thread_local! {
    static EVENTS: std::cell::RefCell<BTreeMap<String, Vec<BudgetEvent>>> = std::cell::RefCell::new(BTreeMap::new());
}

fn push_event(id: &str, ev: BudgetEvent) {
    EVENTS.with(|e| {
        let mut map = e.borrow_mut();
        map.entry(id.to_string()).or_default().push(ev);
    });
}

// daily unlock computation no longer used (linear vesting)

fn budget_key(owner: &Principal, id: &str) -> String {
    format!("{}::{}", owner, id)
}

fn escrow_subaccount(owner: &Principal, budget_id: &str) -> [u8; 32] {
    use sha3::{Digest, Keccak256};
    let mut hasher = Keccak256::new();
    hasher.update(owner.as_slice());
    hasher.update(budget_id.as_bytes());
    let hash = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&hash[..32]);
    out
}

// ICRC-1/2 minimal interfaces we need
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransferArg {
    pub from_subaccount: Option<Vec<u8>>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

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

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<Vec<u8>>, // 32 bytes if present
}

async fn icrc2_transfer_from(token: Principal, arg: TransferFromArg) -> Result<Nat, String> {
    ic_cdk::call::<_, (Result<Nat, String>,)>(token, "icrc2_transfer_from", (arg,))
        .await
        .map_err(|e| format!("call failed: {:?}", e))
        .and_then(|(res,)| res.map_err(|e| e))
}

// Tidak perlu ambil dari canister; praktis: mapping statik
fn decimals_for_asset(kind: &AssetKind) -> u32 {
    match kind {
        AssetKind::CkBtc => 8,
        AssetKind::CkEth => 18,
    }
}

async fn icrc1_transfer(token: Principal, arg: TransferArg) -> Result<Nat, String> {
    ic_cdk::call::<_, (Result<Nat, String>,)>(token, "icrc1_transfer", (arg,))
        .await
        .map_err(|e| format!("call failed: {:?}", e))
        .and_then(|(res,)| res.map_err(|e| e))
}

async fn icrc1_fee(token: Principal) -> Result<Nat, String> {
    let (fee,): (Nat,) = ic_cdk::api::call::call_with_payment128(token, "icrc1_fee", (), 1_000_000).await
        .map_err(|e| format!("call failed: {:?}", e))?;
    Ok(fee)
}

fn principal_account(owner: Principal) -> Account {
    Account { owner, subaccount: None }
}

fn canister_escrow_account(sub: [u8; 32]) -> Account {
    Account { owner: ic_cdk::id(), subaccount: Some(sub.to_vec()) }
}

fn schedule_lock_timer_at(budget_id: String, at_ns: u64) -> TimerId {
    timers::schedule_at(at_ns, move || {
        ic_cdk::futures::spawn(async move { handle_period_lock(budget_id.clone()).await; });
    })
}

// Removed unlock timer for linear vesting

async fn handle_period_lock(budget_id: String) {
    // Take old timer id (single-shot); next_lock_at_ns tidak dipakai lagi
    let old_timer = BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        if let Some(bi) = map.get_mut(&budget_id) {
            bi.lock_timer.take()
        } else { None }
    });

    let (owner, asset, amount, escrow) = BUDGETS.with(|b| {
        let map = b.borrow();
        let bi = map.get(&budget_id).expect("budget not found");
        (
            bi.info.owner,
            bi.info.asset_canister,
            bi.info.amount_to_lock.clone(),
            canister_escrow_account(escrow_subaccount(&bi.info.owner, &bi.info.id)),
        )
    });

    let from = principal_account(owner);
    let to = escrow;

    let arg = TransferFromArg {
        from, to, amount: amount.clone(),
        fee: None,
        memo: Some(b"budget_monthly_lock".to_vec()),
        created_at_time: Some(time()),
        spender_subaccount: None,
    };

    match icrc2_transfer_from(asset, arg).await {
        Ok(_block) => {
            if let Some(tid) = old_timer { let _ = clear_timer(tid); }
            BUDGETS.with(|b| {
                let mut map = b.borrow_mut();
                if let Some(bi) = map.get_mut(&budget_id) {
                    let added = bi.info.amount_to_lock.clone();
                    bi.info.locked_balance = Nat(&bi.info.locked_balance.0 + &added.0);
                    bi.info.period_locked = added;
                    bi.info.unlocked_so_far = Nat(num::BigUint::from(0u32));
                    // gunakan period_start_ns / period_end_ns yang sudah disediakan saat create
                    bi.info.updated_at_ns = time();
                    bi.lock_timer = None;
                    bi.info.status = BudgetStatus::Active;
                }
            });
            push_event(&budget_id, BudgetEvent { at_time_ns: time(), kind: BudgetEventKind::LockSucceeded, amount: Some(amount.clone()), note: None });
        }
        Err(e) => {
            ic_cdk::println!("monthly lock failed: {}", e);
            if let Some(tid) = old_timer { let _ = clear_timer(tid); }
            BUDGETS.with(|b| {
                let mut map = b.borrow_mut();
                if let Some(bi) = map.get_mut(&budget_id) {
                    bi.info.status = BudgetStatus::Failed;
                    bi.info.updated_at_ns = time();
                }
            });
            push_event(&budget_id, BudgetEvent { at_time_ns: time(), kind: BudgetEventKind::LockFailed, amount: Some(amount.clone()), note: Some(e) });
        }
    }
}


pub async fn create_budget(req: BudgetCreateRequest) -> Result<BudgetInfo, String> {
    let owner = caller();
    // Validasi input dasar
    if req.name.trim().is_empty() { return Err("name tidak boleh kosong".to_string()); }
    if req.amount_to_lock.0 == num::BigUint::from(0u32) { return Err("amount_to_lock harus > 0".to_string()); }
    let created = time();
    let id = format!("{}-{}-{}", owner, req.asset_canister, created);
    let next_lock = req.period_start_ns;
    let next_unlock = req.period_end_ns;
    let decimals = decimals_for_asset(&req.asset_kind);

    let info = BudgetInfo {
        id: id.clone(),
        owner,
        asset_canister: req.asset_canister,
        name: req.name,
        amount_to_lock: req.amount_to_lock,
        locked_balance: Nat(num::BigUint::from(0u32)),
        available_to_withdraw: Nat(num::BigUint::from(0u32)),
        decimals,
        status: BudgetStatus::Active,
        next_lock_at_ns: next_lock,
        next_unlock_at_ns: next_unlock,
        created_at_ns: created,
        updated_at_ns: created,
        period_start_ns: next_lock,
        period_end_ns: next_unlock,
        period_locked: Nat(num::BigUint::from(0u32)),
        unlocked_so_far: Nat(num::BigUint::from(0u32)),
    };

    let lock_tid = schedule_lock_timer_at(id.clone(), next_lock);
    let unlock_tid = None;

    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        map.insert(id.clone(), BudgetInternal { info: info.clone(), lock_timer: Some(lock_tid), unlock_timer: unlock_tid });
    });

    Ok(info)
}

pub fn list_budgets(owner: Option<Principal>) -> Vec<BudgetInfo> {
    let who = owner.unwrap_or_else(caller);
    BUDGETS.with(|b| {
        b.borrow().values()
            .filter(|bi| bi.info.owner == who)
            .map(|bi| bi.info.clone())
            .collect()
    })
}

pub fn get_budget(id: String) -> Option<BudgetInfo> {
    BUDGETS.with(|b| b.borrow().get(&id).map(|bi| bi.info.clone()))
}

pub fn budget_refresh_accrual(id: String) -> Result<BudgetInfo, String> {
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        let bi = map.get_mut(&id).ok_or("budget not found")?;
        let now = time();
        let start = bi.info.period_start_ns;
        let end = bi.info.period_end_ns.max(start + 1);
        let duration = end - start;
        let clamped = if now < start { start } else if now > end { end } else { now };
        let elapsed = clamped - start;
        let target = if duration == 0 { bi.info.period_locked.0.clone() } else { (&bi.info.period_locked.0 * elapsed) / duration };
        if target > bi.info.unlocked_so_far.0 {
            let mut newly = &target - &bi.info.unlocked_so_far.0;
            if newly > bi.info.locked_balance.0 { newly = bi.info.locked_balance.0.clone(); }
            bi.info.unlocked_so_far = Nat(&bi.info.unlocked_so_far.0 + &newly);
            bi.info.locked_balance = Nat(&bi.info.locked_balance.0 - &newly);
            bi.info.available_to_withdraw = Nat(&bi.info.available_to_withdraw.0 + &newly);
            bi.info.updated_at_ns = now;
            if bi.info.unlocked_so_far.0 >= bi.info.period_locked.0 && bi.info.status != BudgetStatus::Completed {
                bi.info.status = BudgetStatus::Completed;
                push_event(&id, BudgetEvent { at_time_ns: now, kind: BudgetEventKind::PeriodCompleted, amount: Some(bi.info.period_locked.clone()), note: None });
            }
        }
        Ok(bi.info.clone())
    })
}

// ---------- Accrual preview (read-only, no state change) ----------
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BudgetAccrualPreview {
    pub now_ns: u64,
    pub period_start_ns: u64,
    pub period_end_ns: u64,
    pub projected_unlocked: Nat,
    pub projected_available: Nat,
    pub projected_locked_balance: Nat,
}

pub fn budget_preview_accrual(id: String) -> Result<BudgetAccrualPreview, String> {
    BUDGETS.with(|b| {
        let map = b.borrow();
        let bi = map.get(&id).ok_or("budget not found")?;
        let now = time();
        let start = bi.info.period_start_ns;
        let end = bi.info.period_end_ns.max(start + 1);
        let duration = end - start;
        let clamped = if now < start { start } else if now > end { end } else { now };
        let elapsed = clamped - start;
        let target = if duration == 0 { bi.info.period_locked.0.clone() } else { (&bi.info.period_locked.0 * elapsed) / duration };
        let projected_unlocked = Nat(target.clone());
        // derive projected balances relative to current state
        let additional = if target > bi.info.unlocked_so_far.0 { &target - &bi.info.unlocked_so_far.0 } else { num::BigUint::from(0u32) };
        let projected_available = Nat(&bi.info.available_to_withdraw.0 + &additional);
        let projected_locked_balance = Nat(&bi.info.locked_balance.0 - &additional);
        Ok(BudgetAccrualPreview { now_ns: now, period_start_ns: start, period_end_ns: end, projected_unlocked, projected_available, projected_locked_balance })
    })
}

// ---------- Accrual step (bounded) ----------
pub fn budget_refresh_accrual_step(id: String, max_delta: Option<Nat>) -> Result<BudgetInfo, String> {
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        let bi = map.get_mut(&id).ok_or("budget not found")?;
        let now = time();
        let start = bi.info.period_start_ns;
        let end = bi.info.period_end_ns.max(start + 1);
        let duration = end - start;
        let clamped = if now < start { start } else if now > end { end } else { now };
        let elapsed = clamped - start;
        let target = if duration == 0 { bi.info.period_locked.0.clone() } else { (&bi.info.period_locked.0 * elapsed) / duration };
        if target > bi.info.unlocked_so_far.0 {
            let mut newly = &target - &bi.info.unlocked_so_far.0;
            if let Some(md) = max_delta.as_ref() {
                if newly > md.0 { newly = md.0.clone(); }
            }
            if newly > bi.info.locked_balance.0 { newly = bi.info.locked_balance.0.clone(); }
            bi.info.unlocked_so_far = Nat(&bi.info.unlocked_so_far.0 + &newly);
            bi.info.locked_balance = Nat(&bi.info.locked_balance.0 - &newly);
            bi.info.available_to_withdraw = Nat(&bi.info.available_to_withdraw.0 + &newly);
            bi.info.updated_at_ns = now;
            if bi.info.unlocked_so_far.0 >= bi.info.period_locked.0 && bi.info.status != BudgetStatus::Completed {
                bi.info.status = BudgetStatus::Completed;
                push_event(&id, BudgetEvent { at_time_ns: now, kind: BudgetEventKind::PeriodCompleted, amount: Some(bi.info.period_locked.clone()), note: None });
            }
        }
        Ok(bi.info.clone())
    })
}

pub fn list_budgets_by_asset(owner: Option<Principal>, asset: Principal) -> Vec<BudgetInfo> {
    let who = owner.unwrap_or_else(caller);
    BUDGETS.with(|b| {
        b.borrow().values()
            .filter(|bi| bi.info.owner == who && bi.info.asset_canister == asset)
            .map(|bi| bi.info.clone())
            .collect()
    })
}

pub fn get_escrow_account(id: String) -> Result<Account, String> {
    BUDGETS.with(|b| {
        let map = b.borrow();
        let bi = map.get(&id).ok_or("budget not found")?;
        if bi.info.owner != caller() { return Err("unauthorized".to_string()); }
        Ok(canister_escrow_account(escrow_subaccount(&bi.info.owner, &bi.info.id)))
    })
}

pub async fn budget_withdraw(id: String, amount: Nat, to_subaccount: Option<Vec<u8>>) -> Result<Nat, String> {
    if amount.0 == num::BigUint::from(0u32) { return Err("amount harus > 0".to_string()); }
    let (asset, owner, available, escrow, start, end, period_locked, unlocked_so_far) = BUDGETS.with(|b| {
        let map = b.borrow();
        let bi = map.get(&id).ok_or("budget not found")?;
        if bi.info.owner != caller() { return Err("unauthorized".to_string()); }
        Ok((
            bi.info.asset_canister, bi.info.owner,
            bi.info.available_to_withdraw.clone(),
            canister_escrow_account(escrow_subaccount(&bi.info.owner, &bi.info.id)),
            bi.info.period_start_ns, bi.info.period_end_ns,
            bi.info.period_locked.clone(), bi.info.unlocked_so_far.clone(),
        ))
    })?;

    // Accrual up to now before withdrawing
    let now = time();
    let duration = (end.max(start + 1)) - start;
    let clamped_now = if now < start { start } else if now > end { end } else { now };
    let elapsed = clamped_now - start;
    let target_unlocked = if duration == 0 { period_locked.0.clone() } else { (&period_locked.0 * elapsed) / duration };
    let mut newly = if target_unlocked > unlocked_so_far.0 { &target_unlocked - &unlocked_so_far.0 } else { num::BigUint::from(0u32) };
    // apply accrual to state
    let mut just_completed = false;
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        if let Some(bi) = map.get_mut(&id) {
            if newly > bi.info.locked_balance.0 { newly = bi.info.locked_balance.0.clone(); }
            bi.info.unlocked_so_far = Nat(&bi.info.unlocked_so_far.0 + &newly);
            bi.info.locked_balance = Nat(&bi.info.locked_balance.0 - &newly);
            bi.info.available_to_withdraw = Nat(&bi.info.available_to_withdraw.0 + &newly);
            bi.info.updated_at_ns = time();
            if bi.info.unlocked_so_far.0 >= bi.info.period_locked.0 && bi.info.status != BudgetStatus::Completed {
                bi.info.status = BudgetStatus::Completed;
                just_completed = true;
            }
        }
    });

    if just_completed { push_event(&id, BudgetEvent { at_time_ns: time(), kind: BudgetEventKind::PeriodCompleted, amount: Some(period_locked.clone()), note: None }); }

    // Re-check available after accrual
    let avail_after = BUDGETS.with(|b| {
        let map = b.borrow();
        map.get(&id).map(|bi| bi.info.available_to_withdraw.clone()).ok_or("budget not found".to_string())
    })?;
    if amount.0 > avail_after.0 { return Err("amount > available_to_withdraw".to_string()); }

    // Ambil fee ledger dan kurangi dari jumlah yang dikirim, sehingga total dipotong dari available adalah `amount` (net + fee)
    let fee = icrc1_fee(asset).await?;
    if amount.0 <= fee.0 { return Err("amount harus > fee ledger".to_string()); }
    let net = Nat(&amount.0 - &fee.0);

    // Transfer dari escrow ke akun user (principal user, optional subaccount)
    let to = Account { owner, subaccount: to_subaccount };
    let arg = TransferArg { from_subaccount: escrow.subaccount.clone(), to, amount: net.clone(), fee: None, memo: Some(b"budget_user_withdraw".to_vec()), created_at_time: Some(time()) };
    let res = icrc1_transfer(asset, arg).await?;

    // Update state
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        if let Some(mut bi) = map.get_mut(&id) {
            // Kurangi total yang dipotong (net + fee) dari available: yaitu `amount`
            bi.info.available_to_withdraw = Nat(&bi.info.available_to_withdraw.0 - &amount.0);
            bi.info.updated_at_ns = time();
        }
    });

    // Log event
    push_event(&id, BudgetEvent { at_time_ns: time(), kind: BudgetEventKind::Withdraw, amount: Some(amount.clone()), note: Some(format!("fee_deducted:{}", fee.0)) });

    Ok(res)
}

pub fn update_budget(id: String, upd: BudgetUpdateRequest) -> Result<BudgetInfo, String> {
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        let bi = map.get_mut(&id).ok_or("budget not found")?;
        if bi.info.owner != caller() { return Err("unauthorized".to_string()); }
        if let Some(name) = upd.name { bi.info.name = name; }
        if let Some(amount) = upd.amount_to_lock { bi.info.amount_to_lock = amount; }
        if let Some(status) = upd.status.clone() {
            match status {
                BudgetStatus::Active => {
                    if bi.info.status != BudgetStatus::Active {
                        // reschedule
                        let lt = schedule_lock_timer_at(id.clone(), bi.info.next_lock_at_ns);
                        bi.lock_timer = Some(lt);
                        bi.unlock_timer = None;
                    }
                    bi.info.status = BudgetStatus::Active;
                }
                BudgetStatus::Paused => {
                    if let Some(t) = bi.lock_timer.take() { let _ = clear_timer(t); }
                    if let Some(t) = bi.unlock_timer.take() { let _ = clear_timer(t); }
                    bi.info.status = BudgetStatus::Paused;
                }
                BudgetStatus::Archived => {
                    if let Some(t) = bi.lock_timer.take() { let _ = clear_timer(t); }
                    if let Some(t) = bi.unlock_timer.take() { let _ = clear_timer(t); }
                    bi.info.status = BudgetStatus::Archived;
                }
                BudgetStatus::Completed => {
                    bi.info.status = BudgetStatus::Completed;
                }
                BudgetStatus::Failed => {
                    bi.info.status = BudgetStatus::Failed;
                }
            }
        }
        bi.info.updated_at_ns = time();
        Ok(bi.info.clone())
    })
}

pub async fn trigger_lock_now(id: String) -> Result<(), String> {
    let owner = BUDGETS.with(|b| b.borrow().get(&id).map(|bi| bi.info.owner));
    match owner {
        Some(o) if o == caller() => {
            handle_period_lock(id).await;
            Ok(())
        }
        Some(_) => Err("unauthorized".to_string()),
        None => Err("budget not found".to_string())
    }
}

// Removed trigger_unlock_now (linear vesting accrues on write)

pub fn pause_budget(id: String) -> Result<(), String> {
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        let bi = map.get_mut(&id).ok_or("budget not found")?;
        if bi.info.owner != caller() { return Err("unauthorized".to_string()); }
        bi.info.status = BudgetStatus::Paused;
        if let Some(t) = bi.lock_timer.take() { let _ = clear_timer(t); }
        if let Some(t) = bi.unlock_timer.take() { let _ = clear_timer(t); }
        bi.info.updated_at_ns = time();
        Ok(())
    })
}

pub fn resume_budget(id: String) -> Result<(), String> {
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        let bi = map.get_mut(&id).ok_or("budget not found")?;
        if bi.info.owner != caller() { return Err("unauthorized".to_string()); }
        bi.info.status = BudgetStatus::Active;
        let lt = schedule_lock_timer_at(id.clone(), bi.info.next_lock_at_ns);
        bi.lock_timer = Some(lt);
        bi.unlock_timer = None;
        bi.info.updated_at_ns = time();
        Ok(())
    })
}

pub async fn delete_budget(id: String) -> Result<(), String> {
    // Transfer any remaining locked_balance + available_to_withdraw back to user
    let (asset, owner, remaining_locked, available, escrow) = BUDGETS.with(|b| {
        let map = b.borrow();
        let bi = map.get(&id).cloned();
        match bi {
            Some(bi) => (
                bi.info.asset_canister,
                bi.info.owner,
                bi.info.locked_balance,
                bi.info.available_to_withdraw,
                canister_escrow_account(escrow_subaccount(&bi.info.owner, &bi.info.id)),
            ),
            None => (Principal::anonymous(), Principal::anonymous(), Nat(num::BigUint::from(0u32)), Nat(num::BigUint::from(0u32)), Account{ owner: ic_cdk::id(), subaccount: None })
        }
    });

    if owner != caller() { return Err("unauthorized".to_string()); }

    if asset != Principal::anonymous() {
        let total = Nat(&remaining_locked.0 + &available.0);
        if total.0 > num::BigUint::from(0u32) {
            let arg = TransferArg { from_subaccount: escrow.subaccount.clone(), to: principal_account(owner), amount: total.clone(), fee: None, memo: Some(b"budget_delete_refund_all".to_vec()), created_at_time: Some(time()) };
            let _ = icrc1_transfer(asset, arg).await; // best-effort
        }
    }

    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        if let Some(mut bi) = map.remove(&id) {
            if let Some(t) = bi.lock_timer.take() { let _ = clear_timer(t); }
            if let Some(t) = bi.unlock_timer.take() { let _ = clear_timer(t); }
        }
    });
    Ok(())
}

// Preview jadwal dan allowance
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BudgetSchedulePreviewItem {
    pub kind: String, // "lock" | "unlock"
    pub at_time_ns: u64,
    pub amount: Nat,
}

pub fn budget_preview_schedule(id: String) -> Result<Vec<BudgetSchedulePreviewItem>, String> {
    BUDGETS.with(|b| {
        let map = b.borrow();
        let bi = map.get(&id).ok_or("budget not found")?;
        if bi.info.owner != caller() { return Err("unauthorized".to_string()); }
        Ok(vec![
            BudgetSchedulePreviewItem { kind: "lock".to_string(), at_time_ns: bi.info.period_start_ns, amount: bi.info.amount_to_lock.clone() },
            BudgetSchedulePreviewItem { kind: "vest_end".to_string(), at_time_ns: bi.info.period_end_ns, amount: bi.info.amount_to_lock.clone() },
        ])
    })
}

pub fn budget_required_allowance(id: String) -> Result<Nat, String> {
    BUDGETS.with(|b| {
        let map = b.borrow();
        let bi = map.get(&id).ok_or("budget not found")?;
        if bi.info.owner != caller() { return Err("unauthorized".to_string()); }
        Ok(bi.info.amount_to_lock.clone())
    })
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct BudgetAmountRequirements {
    pub allowance: Nat,            // jumlah yang perlu di-approve (monthly amount)
    pub estimated_fee: Nat,        // fee transfer_from yang dibebankan oleh ledger
    pub required_user_balance: Nat // allowance + fee (disarankan tersedia di akun user)
}

pub async fn budget_required_amounts(id: String) -> Result<BudgetAmountRequirements, String> {
    let (asset, owner, monthly) = BUDGETS.with(|b| {
        let map = b.borrow();
        match map.get(&id) {
            Some(bi) => Ok((bi.info.asset_canister, bi.info.owner, bi.info.amount_to_lock.clone())),
            None => Err("budget not found".to_string()),
        }
    })?;
    if owner != caller() { return Err("unauthorized".to_string()); }
    let fee = icrc1_fee(asset).await?;
    let required = Nat(&monthly.0 + &fee.0);
    // Tandai period completed jika fully vested
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        if let Some(bi) = map.get_mut(&id) {
            if bi.info.unlocked_so_far.0 >= bi.info.period_locked.0 {
                if bi.info.status != BudgetStatus::Completed {
                    bi.info.status = BudgetStatus::Completed;
                    push_event(&id, BudgetEvent { at_time_ns: time(), kind: BudgetEventKind::PeriodCompleted, amount: Some(bi.info.period_locked.clone()), note: None });
                }
            }
        }
    });
    Ok(BudgetAmountRequirements { allowance: monthly, estimated_fee: fee, required_user_balance: required })
}

// Preview kebutuhan sebelum create (tanpa id)
pub async fn budget_preview_requirements(
    asset_canister: Principal,
    asset_kind: AssetKind,
    amount_to_lock: Nat,
) -> Result<BudgetAmountRequirements, String> {
    if amount_to_lock.0 == num::BigUint::from(0u32) { return Err("amount_to_lock harus > 0".to_string()); }
    let fee = icrc1_fee(asset_canister).await?;
    let allowance = amount_to_lock;
    let required_user_balance = Nat(&allowance.0 + &fee.0);
    Ok(BudgetAmountRequirements { allowance, estimated_fee: fee, required_user_balance })
}

// Create budget dan langsung lock pertama (sekali) bila memungkinkan
pub async fn budget_create_and_lock(req: BudgetCreateRequest) -> Result<BudgetInfo, String> {
    // create dulu
    let info = create_budget(req.clone()).await?;
    // lalu trigger lock sekali; jika gagal karena allowance/saldo, tetap kembalikan info budget
    let _ = trigger_lock_now(info.id.clone()).await;
    Ok(info)
}

// Upgrade handling: serialize/deserialize budgets state
// NOTE: timers don't persist; we will recreate them on post_upgrade

#[derive(CandidType, Deserialize, Clone)]
pub struct PersistBudget {
    pub info: BudgetInfo,
}

thread_local! {
    static PERSIST: std::cell::RefCell<Vec<PersistBudget>> = std::cell::RefCell::new(Vec::new());
}

pub fn pre_upgrade() {
    let data: Vec<PersistBudget> = BUDGETS.with(|b| b.borrow().values().map(|bi| PersistBudget { info: bi.info.clone() }).collect());
    PERSIST.with(|p| *p.borrow_mut() = data);
    // Events are in-memory only for now (can be persisted similarly if needed)
}

pub fn post_upgrade() {
    let data = PERSIST.with(|p| p.borrow().clone());
    BUDGETS.with(|b| {
        let mut map = b.borrow_mut();
        map.clear();
        for pb in data.into_iter() {
            let id = pb.info.id.clone();
            let lt = schedule_lock_timer_at(id.clone(), pb.info.next_lock_at_ns);
            map.insert(id, BudgetInternal { info: pb.info, lock_timer: Some(lt), unlock_timer: None });
        }
    });
}

pub fn budget_list_events(id: String, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<BudgetEvent>, String> {
    let off = offset.unwrap_or(0) as usize;
    let lim = limit.unwrap_or(50) as usize;
    EVENTS.with(|e| {
        let map = e.borrow();
        let v = map.get(&id).cloned().unwrap_or_default();
        let end = (off + lim).min(v.len());
        if off >= v.len() { Ok(vec![]) } else { Ok(v[off..end].to_vec()) }
    })
}


