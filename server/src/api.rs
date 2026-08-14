use std::sync::Arc;
use std::sync::atomic::Ordering;

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use rand::Rng;
use serde::Deserialize;
use serde_json::json;

use crate::msg::{Account, Out, Side, SymbolInfo};
use crate::{App, market, now_ms};

const QTY_CAP: i64 = 10_000;

#[derive(Deserialize)]
pub struct OrderReq {
    pub symbol: String,
    pub side: Side,
    pub qty: i64,
}

#[derive(Deserialize)]
pub struct ChaosReq {
    pub mode: String,
    pub duration_ms: u64,
    pub symbol: Option<String>,
}

fn err(code: StatusCode, msg: &str) -> Response {
    (code, Json(json!({ "error": msg }))).into_response()
}

fn accepted(order_id: u64) -> Response {
    (
        StatusCode::ACCEPTED,
        Json(json!({ "order_id": order_id, "status": "accepted" })),
    )
        .into_response()
}

pub async fn place(State(app): State<Arc<App>>, Json(req): Json<OrderReq>) -> Response {
    if !market::SYMBOLS.iter().any(|s| s.sym == req.symbol) {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "unknown_symbol");
    }
    if req.qty <= 0 {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "bad_qty");
    }
    if req.qty > QTY_CAP {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "qty_cap");
    }
    let oid = app.oid.fetch_add(1, Ordering::Relaxed) + 1;
    tokio::spawn(exec(app, oid, req.symbol, req.side, req.qty));
    accepted(oid)
}

pub async fn close(State(app): State<Arc<App>>, Path(sym): Path<String>) -> Response {
    let flat = !app.portfolio.read().await.positions.contains_key(&sym);
    if flat {
        return err(StatusCode::NOT_FOUND, "flat");
    }
    let oid = app.oid.fetch_add(1, Ordering::Relaxed) + 1;
    tokio::spawn(exec_close(app, oid, sym));
    accepted(oid)
}

async fn exec(app: Arc<App>, oid: u64, sym: String, side: Side, qty: i64) {
    let (lat, slip) = {
        let mut r = rand::rng();
        (r.random_range(50..150u64), r.random_range(0.01..0.05f64))
    };
    tokio::time::sleep(std::time::Duration::from_millis(lat)).await;
    let base = app.prices.read().await[&sym].px;
    let px = if side == Side::Buy {
        base + slip
    } else {
        base - slip
    };
    let ts = now_ms();
    let (pos, realized) = {
        let mut pf = app.portfolio.write().await;
        let (pos, _) = pf.apply(&sym, side, qty, px, ts);
        let realized = pf.realized;
        (pos, realized)
    };
    let _ = app.tx.send(Out::Fill {
        order_id: oid,
        sym: sym.clone(),
        side,
        qty,
        px,
        ts,
        status: "filled".into(),
    });
    let _ = app.tx.send(Out::Position {
        sym,
        position: pos,
        account: Account {
            realized_pnl: realized,
        },
    });
}

async fn exec_close(app: Arc<App>, oid: u64, sym: String) {
    let (lat, slip) = {
        let mut r = rand::rng();
        (r.random_range(50..150u64), r.random_range(0.01..0.05f64))
    };
    tokio::time::sleep(std::time::Duration::from_millis(lat)).await;
    let base = app.prices.read().await[&sym].px;
    let ts = now_ms();
    let filled = {
        let mut pf = app.portfolio.write().await;
        let qty = pf.positions.get(&sym).map(|p| p.qty).unwrap_or(0);
        (qty != 0).then(|| {
            let side = if qty > 0 { Side::Sell } else { Side::Buy };
            let px = if side == Side::Buy {
                base + slip
            } else {
                base - slip
            };
            let (pos, _) = pf.apply(&sym, side, qty.abs(), px, ts);
            (side, qty.abs(), px, pos, pf.realized)
        })
    };
    let Some((side, qty, px, pos, realized)) = filled else {
        return;
    };
    let _ = app.tx.send(Out::Fill {
        order_id: oid,
        sym: sym.clone(),
        side,
        qty,
        px,
        ts,
        status: "filled".into(),
    });
    let _ = app.tx.send(Out::Position {
        sym,
        position: pos,
        account: Account {
            realized_pnl: realized,
        },
    });
}

pub async fn positions(State(app): State<Arc<App>>) -> Response {
    let pf = app.portfolio.read().await;
    Json(json!({
        "positions": pf.positions.values().collect::<Vec<_>>(),
        "account": { "realized_pnl": pf.realized },
    }))
    .into_response()
}

pub async fn symbols(State(_): State<Arc<App>>) -> Response {
    let syms: Vec<SymbolInfo> = market::SYMBOLS
        .iter()
        .map(|s| SymbolInfo {
            sym: s.sym.into(),
            prev_close: s.prev_close,
        })
        .collect();
    Json(syms).into_response()
}

pub async fn chaos(State(app): State<Arc<App>>, Json(req): Json<ChaosReq>) -> Response {
    match req.mode.as_str() {
        "stall" => app.chaos.stall.store(true, Ordering::Relaxed),
        "symbol_stall" => *app.chaos.sym.lock().unwrap() = req.symbol.clone(),
        "drop" => {
            let _ = app.kick.send(());
            return StatusCode::NO_CONTENT.into_response();
        }
        _ => return err(StatusCode::UNPROCESSABLE_ENTITY, "bad_mode"),
    }
    let a = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(req.duration_ms)).await;
        a.chaos.stall.store(false, Ordering::Relaxed);
        *a.chaos.sym.lock().unwrap() = None;
    });
    StatusCode::NO_CONTENT.into_response()
}
