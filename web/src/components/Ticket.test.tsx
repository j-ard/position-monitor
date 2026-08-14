import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/store'
import Fills from './Fills'
import Ticket from './Ticket'

beforeEach(() => {
  useStore.setState({
    conn: 'live',
    symbols: { AAPL: 231.55 },
    prices: { AAPL: { px: 232.0, dir: 0, recvTs: Date.now() } },
    fills: [],
    ticketSym: 'AAPL',
  })
})

describe('Ticket', () => {
  it('posts order and shows pending then filled', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ order_id: 42, status: 'accepted' }), { status: 202 }),
    )
    render(<><Ticket /><Fills /></>)
    await userEvent.clear(screen.getByLabelText('qty'))
    await userEvent.type(screen.getByLabelText('qty'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'BUY' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ method: 'POST' }))
    expect(await screen.findByText(/pending/)).toBeInTheDocument()
    act(() => {
      useStore.getState().applyMsg({ type: 'fill', order_id: 42, sym: 'AAPL', side: 'buy', qty: 100, px: 232.05, ts: Date.now(), status: 'filled' })
    })
    expect(screen.queryByText(/pending/)).toBeNull()
    expect(screen.getByText(/BOT/)).toBeInTheDocument()
  })

  it('disables actions when not live', () => {
    useStore.setState({ conn: 'reconnecting' })
    render(<Ticket />)
    expect(screen.getByRole('button', { name: 'BUY' })).toBeDisabled()
  })

  it('shows inline error on 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'qty_cap' }), { status: 422 }),
    )
    render(<Ticket />)
    await userEvent.clear(screen.getByLabelText('qty'))
    await userEvent.type(screen.getByLabelText('qty'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'BUY' }))
    expect(await screen.findByText(/qty_cap/)).toBeInTheDocument()
  })

  it('shows network error when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'))
    render(<><Ticket /><Fills /></>)
    await userEvent.clear(screen.getByLabelText('qty'))
    await userEvent.type(screen.getByLabelText('qty'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'BUY' }))
    expect(await screen.findByText('network')).toBeInTheDocument()
    expect(screen.queryByText(/pending/)).toBeNull()
  })

  it('quote renders price with up class and arrow after positive dir is set', () => {
    render(<Ticket />)
    expect(screen.getByText(/232\.00/)).toBeInTheDocument()
    act(() => {
      useStore.getState().flushTicks({ AAPL: { sym: 'AAPL', px: 232.50, ts: Date.now() } })
    })
    const quotePx = screen.getByTestId('quote-px')
    expect(quotePx).toHaveClass('up')
    expect(quotePx).toHaveTextContent('▲')
  })

  it('quote switches when selecting a different symbol', async () => {
    act(() => {
      useStore.setState({
        symbols: { AAPL: 231.55, NVDA: 182.1 },
        prices: {
          AAPL: { px: 232.0, dir: 0, recvTs: Date.now() },
          NVDA: { px: 181.95, dir: -1, recvTs: Date.now() },
        },
      })
    })
    render(<Ticket />)
    expect(screen.getByText(/232\.00/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('symbol'), 'NVDA')
    expect(screen.queryByText(/232\.00/)).toBeNull()
    expect(screen.getByText(/181\.95/)).toBeInTheDocument()
  })

  it('quote shows em-dash when symbol has no price', () => {
    act(() => {
      useStore.setState({
        symbols: { AAPL: 231.55 },
        prices: {},
      })
    })
    render(<Ticket />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText(/stale/)).toBeNull()
  })

  it('stale quote uses opacity with preserved dir class', () => {
    act(() => {
      const staleTs = Date.now() - 5000
      useStore.setState({
        prices: {
          AAPL: { px: 232.0, dir: 1, recvTs: staleTs },
        },
        clock: Date.now(),
      })
    })
    render(<Ticket />)
    const quoteContainer = screen.getByText(/stale/).closest('.quote')
    const quotePx = screen.getByTestId('quote-px')
    expect(quoteContainer).toHaveClass('stale')
    expect(quotePx).toHaveClass('up')
  })

  it('ticket reflects store ticketSym and switches quote', () => {
    act(() => {
      useStore.setState({
        symbols: { AAPL: 231.55, META: 350.0 },
        prices: {
          AAPL: { px: 232.0, dir: 0, recvTs: Date.now() },
          META: { px: 350.5, dir: 1, recvTs: Date.now() },
        },
        ticketSym: 'META',
      })
    })
    render(<Ticket />)
    const select = screen.getByLabelText('symbol') as HTMLSelectElement
    expect(select.value).toBe('META')
    expect(screen.getByText(/350\.50/)).toBeInTheDocument()
    expect(screen.queryByText(/232\.00/)).toBeNull()
  })
})
