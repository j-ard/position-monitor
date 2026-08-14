import { describe, expect, it } from 'vitest'
import { dayBase, dayPnl, dayStart, staleAge, symStale, totals, uPnl, uPnlPct } from './selectors'
import type { Position } from '../types'

const pos = (qty: number, avg: number, opened: number, sym = 'X'): Position => ({ sym, qty, avg_px: avg, opened_at: opened })

describe('selectors', () => {
  it('uPnl long/short/missing price', () => {
    expect(uPnl(pos(200, 231.1, 0), 232.45)).toBeCloseTo(270)
    expect(uPnl(pos(-500, 183.2, 0), 181.95)).toBeCloseTo(625)
    expect(uPnl(pos(200, 231.1, 0), undefined)).toBeNull()
  })

  it('uPnlPct is vs cost basis', () => {
    expect(uPnlPct(pos(200, 100, 0), 101)).toBeCloseTo(1.0)
    expect(uPnlPct(pos(-100, 100, 0), 99)).toBeCloseTo(1.0)
  })

  it('day baseline: prev_close overnight, avg if opened today', () => {
    const ds = dayStart(Date.now())
    expect(dayBase(pos(1, 100, ds + 1000), 90, ds)).toBe(100)
    expect(dayBase(pos(1, 100, ds - 1000), 90, ds)).toBe(90)
    expect(dayPnl(pos(10, 100, ds - 1000), 95, 90, ds)).toBeCloseTo(50)
  })

  it('totals sums and counts, skips missing prices', () => {
    const t = totals({
      positions: { A: pos(100, 10, 0, 'A'), B: pos(100, 10, 0, 'B') },
      prices: { A: { px: 11, dir: 0, recvTs: 0 } },
      symbols: { A: 10, B: 10 },
      realized: 5,
      clock: 0,
    })
    expect(t.u).toBeCloseTo(100)
    expect(t.day).toBeCloseTo(100)
    expect(t.gross).toBeCloseTo(1100)
    expect(t.count).toBe(2)
    expect(t.realized).toBe(5)
  })

  it('symStale over 3s', () => {
    expect(symStale({ px: 1, dir: 0, recvTs: 0 }, 3001)).toBe(true)
    expect(symStale({ px: 1, dir: 0, recvTs: 0 }, 2999)).toBe(false)
    expect(symStale(undefined, 0)).toBe(true)
  })

  it('staleAge is 0 while fresh, seconds since recvTs once stale', () => {
    expect(staleAge({ px: 1, dir: 0, recvTs: 0 }, 2999)).toBe(0)
    expect(staleAge({ px: 1, dir: 0, recvTs: 0 }, 5000)).toBe(5)
  })

  it('staleAge returns 0 when px is undefined', () => {
    expect(staleAge(undefined, 0)).toBe(0)
    expect(staleAge(undefined, Date.now())).toBe(0)
  })
})
