import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store/store'
import App from './App'

beforeEach(() => {
  useStore.setState({
    conn: 'live',
    clock: Date.now(),
    symbols: {},
    prices: {},
    positions: {},
    realized: 0,
    fills: [],
    armed: null,
  })
})

describe('App', () => {
  it('boots, applies a snapshot, and survives a tick flush without crashing', () => {
    render(<App />)

    act(() => {
      useStore.getState().applyMsg({
        type: 'snapshot',
        seq: 1,
        symbols: [
          { sym: 'AAPL', prev_close: 231.55 },
          { sym: 'NVDA', prev_close: 182.1 },
        ],
        prices: [
          { sym: 'AAPL', px: 232.45, ts: 5 },
          { sym: 'NVDA', px: 181.95, ts: 5 },
        ],
        positions: [
          { sym: 'AAPL', qty: 200, avg_px: 231.1, opened_at: Date.now() },
          { sym: 'NVDA', qty: -500, avg_px: 183.2, opened_at: Date.now() },
        ],
        account: { realized_pnl: 12.5 },
      })
    })

    act(() => {
      useStore.getState().flushTicks({ AAPL: { sym: 'AAPL', px: 233.0, ts: 6 } })
    })

    expect(screen.getByText('POSITIONS')).toBeInTheDocument()
    expect(screen.getByText(/uPnL/)).toBeInTheDocument()
  })
})
