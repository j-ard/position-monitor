use std::collections::HashMap;

use crate::msg::Position;

#[derive(Default)]
pub struct Portfolio {
    pub positions: HashMap<String, Position>,
    pub realized: f64,
}

impl Portfolio {
    pub fn apply(
        &mut self,
        sym: &str,
        side: crate::msg::Side,
        qty: i64,
        px: f64,
        ts: u64,
    ) -> (Option<Position>, f64) {
        let d = if side == crate::msg::Side::Buy {
            qty
        } else {
            -qty
        };
        let (next, realized) = match self.positions.get(sym).cloned() {
            None => (
                Some(Position {
                    sym: sym.into(),
                    qty: d,
                    avg_px: px,
                    opened_at: ts,
                }),
                0.0,
            ),
            Some(mut p) if p.qty.signum() == d.signum() => {
                let (a, b) = (p.qty.abs() as f64, d.abs() as f64);
                p.avg_px = (p.avg_px * a + px * b) / (a + b);
                p.qty += d;
                (Some(p), 0.0)
            }
            Some(p) => {
                let closed = d.abs().min(p.qty.abs());
                let r = closed as f64 * (px - p.avg_px) * p.qty.signum() as f64;
                let q = p.qty + d;
                let next = match q {
                    0 => None,
                    q if q.signum() == p.qty.signum() => Some(Position { qty: q, ..p }),
                    q => Some(Position {
                        sym: p.sym,
                        qty: q,
                        avg_px: px,
                        opened_at: ts,
                    }),
                };
                (next, r)
            }
        };
        self.realized += realized;
        match &next {
            Some(p) => {
                self.positions.insert(sym.into(), p.clone());
            }
            None => {
                self.positions.remove(sym);
            }
        }
        (next, realized)
    }
}

pub fn seed(now: u64) -> Portfolio {
    let yday = now - 86_400_000;
    let rows: &[(&str, i64, f64, u64)] = &[
        ("AAPL", 200, 231.10, now),
        ("NVDA", -500, 183.20, yday),
        ("TSLA", 100, 328.40, now),
        ("MSFT", 150, 505.22, yday),
        ("AMD", 400, 172.66, yday),
        ("SPY", -50, 637.80, yday),
    ];
    let mut pf = Portfolio::default();
    for (sym, qty, avg_px, opened_at) in rows {
        pf.positions.insert(
            (*sym).into(),
            Position {
                sym: (*sym).into(),
                qty: *qty,
                avg_px: *avg_px,
                opened_at: *opened_at,
            },
        );
    }
    pf
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::msg::Side::*;

    fn p() -> Portfolio {
        Portfolio::default()
    }

    #[test]
    fn open_and_reaverage() {
        let mut pf = p();
        pf.apply("A", Buy, 100, 10.0, 1);
        let (pos, r) = pf.apply("A", Buy, 100, 12.0, 2);
        let pos = pos.unwrap();
        assert_eq!((pos.qty, pos.avg_px, pos.opened_at), (200, 11.0, 1));
        assert_eq!(r, 0.0);
    }

    #[test]
    fn reduce_realizes() {
        let mut pf = p();
        pf.apply("A", Buy, 200, 11.0, 1);
        let (pos, r) = pf.apply("A", Sell, 50, 14.0, 2);
        assert_eq!(pos.unwrap().qty, 150);
        assert_eq!(r, 150.0);
        assert_eq!(pf.realized, 150.0);
    }

    #[test]
    fn full_close_removes() {
        let mut pf = p();
        pf.apply("A", Buy, 100, 10.0, 1);
        let (pos, r) = pf.apply("A", Sell, 100, 9.0, 2);
        assert!(pos.is_none());
        assert_eq!(r, -100.0);
        assert!(pf.positions.is_empty());
    }

    #[test]
    fn short_realizes_on_buyback() {
        let mut pf = p();
        pf.apply("A", Sell, 100, 10.0, 1);
        let (pos, r) = pf.apply("A", Buy, 40, 8.0, 2);
        assert_eq!(pos.unwrap().qty, -60);
        assert_eq!(r, 80.0);
    }

    #[test]
    fn flip_resets_basis() {
        let mut pf = p();
        pf.apply("A", Sell, 60, 10.0, 1);
        let (pos, r) = pf.apply("A", Buy, 100, 9.0, 5);
        let pos = pos.unwrap();
        assert_eq!((pos.qty, pos.avg_px, pos.opened_at), (40, 9.0, 5));
        assert_eq!(r, 60.0);
    }

    #[test]
    fn seed_has_six_mixed_positions() {
        let pf = seed(1_000_000_000_000);
        assert_eq!(pf.positions.len(), 6);
        assert!(pf.positions.values().any(|p| p.qty < 0));
        assert!(
            pf.positions
                .values()
                .any(|p| p.opened_at < 1_000_000_000_000)
        );
    }
}
