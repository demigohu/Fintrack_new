use ic_cdk::api::time;
use ic_cdk_timers::{set_timer, clear_timer, TimerId};

pub const NS_PER_SEC: u64 = 1_000_000_000;
pub const SEC_PER_MIN: u64 = 60;
pub const SEC_PER_HOUR: u64 = 60 * 60;
pub const SEC_PER_DAY: u64 = 24 * SEC_PER_HOUR;

pub fn schedule_at(ns_timestamp: u64, f: impl FnOnce() + 'static) -> TimerId {
    let now = time();
    let delay = ns_timestamp.saturating_sub(now);
    set_timer(std::time::Duration::from_nanos(delay as u64), f)
}

pub fn schedule_in(ns_delay: u64, f: impl FnOnce() + 'static) -> TimerId {
    set_timer(std::time::Duration::from_nanos(ns_delay as u64), f)
}

pub fn cancel_timer(timer: Option<TimerId>) {
    if let Some(t) = timer { let _ = clear_timer(t); }
}

// Removed calendar helpers; we now rely on explicit ns inputs







