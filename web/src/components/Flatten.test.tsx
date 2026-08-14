import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/store'
import Blotter from './Blotter'

beforeEach(() => {
  vi.useRealTimers()
  useStore.setState({ conn: 'live', armed: null, fills: [] })
  useStore.getState().applyMsg({
    type: 'snapshot',
    seq: 1,
    symbols: [{ sym: 'AAPL', prev_close: 231.55 }, { sym: 'NVDA', prev_close: 182.1 }],
    prices: [
      { sym: 'AAPL', px: 232.0, ts: 5 },
      { sym: 'NVDA', px: 181.9, ts: 5 },
    ],
    positions: [
      { sym: 'AAPL', qty: 200, avg_px: 231.1, opened_at: Date.now() },
      { sym: 'NVDA', qty: -500, avg_px: 183.2, opened_at: Date.now() },
    ],
    account: { realized_pnl: 0 },
  })
  useStore.getState().setClock(Date.now())
})

describe('armed flatten', () => {
  it('arms with exact consequence, fires on second click', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ order_id: 7, status: 'accepted' }), { status: 202 }),
    )
    render(<Blotter />)
    const flat = screen.getAllByRole('button', { name: 'FLAT' })[0]
    await userEvent.click(flat)
    const armed = screen.getByRole('button', { name: 'CONFIRM -200 @ MKT' })
    await userEvent.click(armed)
    expect(fetchMock).toHaveBeenCalledWith('/api/positions/AAPL/close', expect.objectContaining({ method: 'POST' }))
    expect(useStore.getState().armed).toBeNull()
  })

  it('arming one row disarms the other', async () => {
    render(<Blotter />)
    await userEvent.click(screen.getAllByRole('button', { name: 'FLAT' })[0])
    expect(useStore.getState().armed).toBe('AAPL')
    await userEvent.click(screen.getByRole('button', { name: 'FLAT' }))
    expect(useStore.getState().armed).toBe('NVDA')
    expect(screen.getByRole('button', { name: 'CONFIRM +500 @ MKT' })).toBeInTheDocument()
  })

  it('escape disarms', async () => {
    render(<Blotter />)
    await userEvent.click(screen.getAllByRole('button', { name: 'FLAT' })[0])
    await userEvent.keyboard('{Escape}')
    expect(useStore.getState().armed).toBeNull()
  })

  it('auto-disarms after 3s', () => {
    vi.useFakeTimers()
    render(<Blotter />)
    act(() => {
      screen.getAllByRole('button', { name: 'FLAT' })[0].click()
    })
    expect(useStore.getState().armed).toBe('AAPL')
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(useStore.getState().armed).toBeNull()
    vi.useRealTimers()
  })

  it('fetch rejection adds rejected fill row', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
    render(<Blotter />)
    const flat = screen.getAllByRole('button', { name: 'FLAT' })[0]
    await userEvent.click(flat)
    const armed = screen.getByRole('button', { name: 'CONFIRM -200 @ MKT' })
    await userEvent.click(armed)
    expect(fetchMock).toHaveBeenCalledWith('/api/positions/AAPL/close', expect.objectContaining({ method: 'POST' }))
    expect(useStore.getState().armed).toBeNull()
    const fills = useStore.getState().fills
    expect(fills.some((f) => f.status === 'rejected' && f.id < 0)).toBe(true)
  })
})
