import type { Position, Px } from '../types'

export const dayStart = (now: number) => new Date(now).setHours(0, 0, 0, 0)

export const uPnl = (p: Position, px?: number) => (px == null ? null : p.qty * (px - p.avg_px))

export const uPnlPct = (p: Position, px?: number) => {
  const u = uPnl(p, px)
  return u == null ? null : (u / (Math.abs(p.qty) * p.avg_px)) * 100
}

export const dayBase = (p: Position, prevClose: number, ds: number) =>
  p.opened_at >= ds ? p.avg_px : prevClose

export const dayPnl = (p: Position, px: number | undefined, prevClose: number, ds: number) =>
  px == null ? null : p.qty * (px - dayBase(p, prevClose, ds))

export const symStale = (px: Px | undefined, clock: number) => !px || clock - px.recvTs > 3000

export const staleAge = (px: Px | undefined, clock: number) =>
  !px ? 0 : symStale(px, clock) ? Math.round((clock - px.recvTs) / 1000) : 0

export function totals(s: {
  positions: Record<string, Position>
  prices: Record<string, Px>
  symbols: Record<string, number>
  realized: number
  clock: number
}) {
  const ds = dayStart(s.clock)
  let u = 0
  let day = 0
  let gross = 0
  for (const p of Object.values(s.positions)) {
    const px = s.prices[p.sym]?.px
    if (px == null) continue
    u += p.qty * (px - p.avg_px)
    day += p.qty * (px - dayBase(p, s.symbols[p.sym] ?? p.avg_px, ds))
    gross += Math.abs(p.qty) * px
  }
  return { u, day, gross, realized: s.realized, count: Object.keys(s.positions).length }
}
