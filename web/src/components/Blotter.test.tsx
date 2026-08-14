import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../store/store'
import Blotter from './Blotter'

beforeEach(() => {
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
    account: { realized_pnl: 0 },
  })
  useStore.getState().setClock(Date.now())
  useStore.getState().setTicketSym('AAPL')
})

describe('Blotter', () => {
  it('renders a row per position with signed qty and pnl', () => {
    render(<Blotter />)
    expect(screen.getByTestId('row-AAPL')).toHaveTextContent('+200')
    expect(screen.getByTestId('row-AAPL')).toHaveTextContent('+$270')
    expect(screen.getByTestId('row-NVDA')).toHaveTextContent('-500')
    expect(screen.getByTestId('row-NVDA')).toHaveTextContent('+$625')
  })

  it('marks tick direction on LAST', () => {
    useStore.getState().flushTicks({ AAPL: { sym: 'AAPL', px: 232.9, ts: 6 } })
    render(<Blotter />)
    expect(screen.getByTestId('last-AAPL')).toHaveClass('up')
    expect(screen.getByTestId('last-AAPL')).toHaveTextContent('▲')
  })

  it('dims stale rows', () => {
    useStore.setState({
      prices: { ...useStore.getState().prices, AAPL: { px: 232.45, dir: 0, recvTs: Date.now() - 5000 } },
    })
    render(<Blotter />)
    expect(screen.getByTestId('row-AAPL')).toHaveClass('stale')
  })

  it('clicking SYM cell seeds ticket symbol', async () => {
    render(<Blotter />)
    expect(useStore.getState().ticketSym).toBe('AAPL')
    await userEvent.click(screen.getByTestId('row-NVDA').querySelector('.sym-cell')!)
    expect(useStore.getState().ticketSym).toBe('NVDA')
  })
})
