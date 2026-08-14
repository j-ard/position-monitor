import { create } from 'zustand'
import type { Conn, FillRow, Out, Position, Px, Tick } from '../types'

const MAX_FILLS = 20

interface S {
  conn: Conn
  clock: number
  symbols: Record<string, number>
  prices: Record<string, Px>
  positions: Record<string, Position>
  realized: number
  fills: FillRow[]
  armed: string | null
  ticketSym: string
  applyMsg(m: Out): void
  flushTicks(latest: Record<string, Tick>): void
  addPending(f: FillRow): void
  orderFailed(id: number, status: 'rejected' | 'unknown'): void
  setConn(c: Conn): void
  setClock(n: number): void
  setArmed(sym: string | null): void
  setTicketSym(sym: string): void
}

export const useStore = create<S>()((set, get) => ({
  conn: 'connecting',
  clock: Date.now(),
  symbols: {},
  prices: {},
  positions: {},
  realized: 0,
  fills: [],
  armed: null,
  ticketSym: 'AAPL',

  applyMsg: (m) => {
    if (m.type === 'snapshot') {
      const now = Date.now()
      set({
        symbols: Object.fromEntries(m.symbols.map((s) => [s.sym, s.prev_close])),
        prices: Object.fromEntries(m.prices.map((t) => [t.sym, { px: t.px, dir: 0 as const, recvTs: now }])),
        positions: Object.fromEntries(m.positions.map((p) => [p.sym, p])),
        realized: m.account.realized_pnl,
      })
    } else if (m.type === 'fill') {
      const row: FillRow = { id: m.order_id, ts: m.ts, sym: m.sym, side: m.side, qty: m.qty, px: m.px, status: 'filled' }
      const fills = get().fills.slice()
      const i = fills.findIndex((f) => f.id === m.order_id)
      if (i >= 0) fills[i] = row
      else fills.unshift(row)
      set({ fills: fills.slice(0, MAX_FILLS) })
    } else if (m.type === 'position') {
      const positions = { ...get().positions }
      if (m.position) positions[m.sym] = m.position
      else delete positions[m.sym]
      set({ positions, realized: m.account.realized_pnl })
    }
  },

  flushTicks: (latest) => {
    const now = Date.now()
    const prices = { ...get().prices }
    for (const [sym, t] of Object.entries(latest)) {
      const prev = prices[sym]
      const dir = !prev || t.px === prev.px ? (prev?.dir ?? 0) : t.px > prev.px ? 1 : -1
      prices[sym] = { px: t.px, dir, recvTs: now }
    }
    set({ prices })
  },

  addPending: (f) => set({ fills: [f, ...get().fills].slice(0, MAX_FILLS) }),
  orderFailed: (id, status) =>
    set({ fills: get().fills.map((f) => (f.id === id && f.status === 'pending' ? { ...f, status } : f)) }),
  setConn: (conn) => set({ conn }),
  setClock: (clock) => set({ clock }),
  setArmed: (armed) => set({ armed }),
  setTicketSym: (ticketSym) => set({ ticketSym }),
}))
