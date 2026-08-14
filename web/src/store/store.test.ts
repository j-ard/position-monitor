import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import type { Out } from '../types'

const snap: Out = {
  type: 'snapshot',
  seq: 1,
  symbols: [{ sym: 'AAPL', prev_close: 231.55 }],
  prices: [{ sym: 'AAPL', px: 232.0, ts: 5 }],
  positions: [{ sym: 'AAPL', qty: 200, avg_px: 231.1, opened_at: 5 }],
  account: { realized_pnl: 10 },
}

beforeEach(() => useStore.getState().applyMsg(snap))

describe('store', () => {
  it('snapshot replaces wholesale', () => {
    const s = useStore.getState()
    expect(s.symbols['AAPL']).toBe(231.55)
    expect(s.prices['AAPL'].dir).toBe(0)
    expect(s.realized).toBe(10)
  })

  it('flushTicks sets direction vs previous', () => {
    useStore.getState().flushTicks({ AAPL: { sym: 'AAPL', px: 233.0, ts: 6 } })
    expect(useStore.getState().prices['AAPL'].dir).toBe(1)
    useStore.getState().flushTicks({ AAPL: { sym: 'AAPL', px: 232.5, ts: 7 } })
    expect(useStore.getState().prices['AAPL'].dir).toBe(-1)
  })

  it('fill replaces matching pending row', () => {
    useStore.getState().addPending({ id: 9, ts: 1, sym: 'META', side: 'buy', qty: 100, status: 'pending' })
    useStore.getState().applyMsg({ type: 'fill', order_id: 9, sym: 'META', side: 'buy', qty: 100, px: 748.1, ts: 2, status: 'filled' })
    const f = useStore.getState().fills[0]
    expect(f.status).toBe('filled')
    expect(f.px).toBe(748.1)
    expect(useStore.getState().fills).toHaveLength(1)
  })

  it('position event upserts and deletes', () => {
    useStore.getState().applyMsg({ type: 'position', sym: 'AAPL', position: null, account: { realized_pnl: 25 } })
    expect(useStore.getState().positions['AAPL']).toBeUndefined()
    expect(useStore.getState().realized).toBe(25)
  })
})
