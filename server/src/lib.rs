pub mod api;
pub mod chaos;
pub mod market;
pub mod msg;
pub mod state;
pub mod ws;

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::Router;
use axum::routing::{get, post};
use rand::Rng;
use tokio::sync::{RwLock, broadcast};
use tower_http::services::ServeDir;

use chaos::Chaos;
use msg::{Account, Out, SymbolInfo, Tick};
use state::Portfolio;

pub struct App {
    pub portfolio: RwLock<Portfolio>,
    pub prices: RwLock<HashMap<String, Tick>>,
    pub tx: broadcast::Sender<Out>,
    pub kick: broadcast::Sender<()>,
    pub seq: AtomicU64,
    pub oid: AtomicU64,
    pub chaos: Chaos,
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

pub fn app() -> Arc<App> {
    let now = now_ms();
    let mut rng = rand::rng();
    let prices = market::start_px(&mut rng)
        .into_iter()
        .map(|(sym, px)| (sym.clone(), Tick { sym, px, ts: now }))
        .collect();
    Arc::new(App {
        portfolio: RwLock::new(state::seed(now)),
        prices: RwLock::new(prices),
        tx: broadcast::channel(256).0,
        kick: broadcast::channel(8).0,
        seq: AtomicU64::new(0),
        oid: AtomicU64::new(0),
        chaos: Chaos::default(),
    })
}

pub async fn snapshot(app: &App) -> Out {
    let pf = app.portfolio.read().await;
    Out::Snapshot {
        seq: app.seq.load(Ordering::Relaxed),
        symbols: market::SYMBOLS
            .iter()
            .map(|s| SymbolInfo {
                sym: s.sym.into(),
                prev_close: s.prev_close,
            })
            .collect(),
        prices: app.prices.read().await.values().cloned().collect(),
        positions: pf.positions.values().cloned().collect(),
        account: Account {
            realized_pnl: pf.realized,
        },
    }
}

pub fn router(app: Arc<App>) -> Router {
    let dist = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../web/dist".into());
    Router::new()
        .route("/ws", get(ws::handler))
        .route("/api/orders", post(api::place))
        .route("/api/positions/{sym}/close", post(api::close))
        .route("/api/positions", get(api::positions))
        .route("/api/symbols", get(api::symbols))
        .route("/api/chaos", post(api::chaos))
        .fallback_service(ServeDir::new(dist))
        .with_state(app)
}

pub fn spawn_feed(app: Arc<App>) {
    let (raw_tx, mut raw_rx) = tokio::sync::mpsc::unbounded_channel::<Tick>();
    let a = app.clone();
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(std::time::Duration::from_millis(10));
        loop {
            iv.tick().await;
            if a.chaos.stalled() {
                continue;
            }
            let mut updates = Vec::new();
            {
                let prices = a.prices.read().await;
                let mut rng = rand::rng();
                for s in market::SYMBOLS {
                    if a.chaos.blocks(s.sym) || !rng.random_bool(0.025) {
                        continue;
                    }
                    let px = market::step(prices[s.sym].px, s.bps, &mut rng);
                    updates.push(Tick {
                        sym: s.sym.into(),
                        px,
                        ts: now_ms(),
                    });
                }
            }
            if !updates.is_empty() {
                let mut prices = a.prices.write().await;
                for t in &updates {
                    prices.insert(t.sym.clone(), t.clone());
                    let _ = raw_tx.send(t.clone());
                }
            }
        }
    });
    let a = app.clone();
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(std::time::Duration::from_millis(50));
        let mut buf = Vec::new();
        loop {
            iv.tick().await;
            while let Ok(t) = raw_rx.try_recv() {
                buf.push(t);
            }
            if buf.is_empty() || a.chaos.stalled() {
                continue;
            }
            let seq = a.seq.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = a.tx.send(Out::Ticks {
                seq,
                ticks: market::conflate(&buf),
            });
            buf.clear();
        }
    });
    tokio::spawn(async move {
        let mut iv = tokio::time::interval(std::time::Duration::from_secs(1));
        loop {
            iv.tick().await;
            if !app.chaos.stalled() {
                let _ = app.tx.send(Out::Heartbeat {
                    ts: now_ms(),
                    seq: app.seq.load(Ordering::Relaxed),
                });
            }
        }
    });
}
