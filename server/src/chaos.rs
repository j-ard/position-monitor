use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Default)]
pub struct Chaos {
    pub stall: AtomicBool,
    pub sym: Mutex<Option<String>>,
}

impl Chaos {
    pub fn stalled(&self) -> bool {
        self.stall.load(Ordering::Relaxed)
    }

    pub fn blocks(&self, sym: &str) -> bool {
        self.sym.lock().unwrap().as_deref() == Some(sym)
    }
}
