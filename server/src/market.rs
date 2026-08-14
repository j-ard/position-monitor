use std::collections::HashMap;

use rand::Rng;
use rand_distr::StandardNormal;

use crate::msg::Tick;

pub struct Spec {
    pub sym: &'static str,
    pub prev_close: f64,
    pub bps: f64,
}

pub const SYMBOLS: &[Spec] = &[
    Spec {
        sym: "AAPL",
        prev_close: 231.55,
        bps: 2.0,
    },
    Spec {
        sym: "NVDA",
        prev_close: 182.10,
        bps: 4.0,
    },
    Spec {
        sym: "TSLA",
        prev_close: 331.90,
        bps: 5.0,
    },
    Spec {
        sym: "MSFT",
        prev_close: 503.30,
        bps: 2.0,
    },
    Spec {
        sym: "AMD",
        prev_close: 171.50,
        bps: 4.0,
    },
    Spec {
        sym: "SPY",
        prev_close: 636.20,
        bps: 1.0,
    },
    Spec {
        sym: "META",
        prev_close: 748.00,
        bps: 3.0,
    },
    Spec {
        sym: "AMZN",
        prev_close: 214.50,
        bps: 3.0,
    },
];

pub fn step(px: f64, bps: f64, rng: &mut impl Rng) -> f64 {
    let g: f64 = rng.sample(StandardNormal);
    let burst = if rng.random_bool(0.02) {
        rng.random_range(-10.0..10.0)
    } else {
        0.0
    };
    (px * (1.0 + (bps * g + burst) / 10_000.0)).max(0.01)
}

pub fn conflate(ticks: &[Tick]) -> Vec<Tick> {
    let mut latest: HashMap<&str, &Tick> = HashMap::new();
    let mut order: Vec<&str> = Vec::new();
    for t in ticks {
        if latest.insert(t.sym.as_str(), t).is_none() {
            order.push(t.sym.as_str());
        }
    }
    order.into_iter().map(|s| latest[s].clone()).collect()
}

pub fn start_px(rng: &mut impl Rng) -> HashMap<String, f64> {
    SYMBOLS
        .iter()
        .map(|s| {
            (
                s.sym.into(),
                s.prev_close * (1.0 + rng.random_range(-0.004..0.004)),
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eight_symbols_with_positive_prices() {
        assert_eq!(SYMBOLS.len(), 8);
        assert!(SYMBOLS.iter().all(|s| s.prev_close > 0.0 && s.bps > 0.0));
    }

    #[test]
    fn step_stays_positive_and_bounded() {
        let mut rng = rand::rng();
        let mut px = 100.0;
        for _ in 0..10_000 {
            let next = step(px, 5.0, &mut rng);
            assert!(next > 0.0);
            assert!((next / px - 1.0).abs() < 0.02);
            px = next;
        }
    }

    #[test]
    fn conflate_keeps_latest_per_sym_in_first_seen_order() {
        let t = |sym: &str, px: f64, ts: u64| Tick {
            sym: sym.into(),
            px,
            ts,
        };
        let out = conflate(&[t("A", 1.0, 1), t("B", 2.0, 2), t("A", 3.0, 3)]);
        assert_eq!(out.len(), 2);
        assert_eq!((out[0].sym.as_str(), out[0].px), ("A", 3.0));
        assert_eq!(out[1].sym.as_str(), "B");
    }
}
