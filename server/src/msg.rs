use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, PartialEq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Buy,
    Sell,
}

#[derive(Clone, PartialEq, Debug, Serialize)]
pub struct Tick {
    pub sym: String,
    pub px: f64,
    pub ts: u64,
}

#[derive(Clone, PartialEq, Debug, Serialize)]
pub struct Position {
    pub sym: String,
    pub qty: i64,
    pub avg_px: f64,
    pub opened_at: u64,
}

#[derive(Clone, Debug, Serialize)]
pub struct SymbolInfo {
    pub sym: String,
    pub prev_close: f64,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Account {
    pub realized_pnl: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Out {
    Snapshot {
        seq: u64,
        symbols: Vec<SymbolInfo>,
        prices: Vec<Tick>,
        positions: Vec<Position>,
        account: Account,
    },
    Ticks {
        seq: u64,
        ticks: Vec<Tick>,
    },
    Fill {
        order_id: u64,
        sym: String,
        side: Side,
        qty: i64,
        px: f64,
        ts: u64,
        status: String,
    },
    Position {
        sym: String,
        position: Option<Position>,
        account: Account,
    },
    Heartbeat {
        ts: u64,
        seq: u64,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ticks_wire_format() {
        let m = Out::Ticks {
            seq: 7,
            ticks: vec![Tick {
                sym: "AAPL".into(),
                px: 232.45,
                ts: 1000,
            }],
        };
        assert_eq!(
            serde_json::to_string(&m).unwrap(),
            r#"{"type":"ticks","seq":7,"ticks":[{"sym":"AAPL","px":232.45,"ts":1000}]}"#
        );
    }

    #[test]
    fn position_close_marker() {
        let m = Out::Position {
            sym: "NVDA".into(),
            position: None,
            account: Account { realized_pnl: 12.5 },
        };
        assert_eq!(
            serde_json::to_string(&m).unwrap(),
            r#"{"type":"position","sym":"NVDA","position":null,"account":{"realized_pnl":12.5}}"#
        );
    }

    #[test]
    fn side_lowercase() {
        assert_eq!(serde_json::to_string(&Side::Buy).unwrap(), r#""buy""#);
        let s: Side = serde_json::from_str(r#""sell""#).unwrap();
        assert!(matches!(s, Side::Sell));
    }
}
