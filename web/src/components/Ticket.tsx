import { useState } from 'react'
import { dirCls, dirMark } from '../lib/dir'
import { fmtNotional, fmtPx } from '../lib/format'
import { staleAge, symStale } from '../store/selectors'
import { useStore } from '../store/store'
import type { Side } from '../types'
import Sparkline from './Sparkline'

export default function Ticket() {
  const symbols = useStore((s) => Object.keys(s.symbols).join(','))
    .split(',')
    .filter(Boolean)
  const conn = useStore((s) => s.conn)
  const sym = useStore((s) => s.ticketSym)
  const [qty, setQty] = useState('100')
  const [err, setErr] = useState('')
  const px = useStore((s) => s.prices[sym])
  const pxVal = px?.px
  const stale = useStore((s) => symStale(s.prices[sym], s.clock))
  const age = useStore((s) => staleAge(s.prices[sym], s.clock))
  const n = Number(qty)
  const valid = Number.isInteger(n) && n > 0 && n <= 10_000
  const disabled = conn !== 'live' || !valid

  async function submit(side: Side) {
    setErr('')
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: sym, side, qty: n }),
      })
      if (r.status !== 202) {
        setErr((await r.json()).error ?? `http_${r.status}`)
        return
      }
      const { order_id } = await r.json()
      useStore.getState().addPending({ id: order_id, ts: Date.now(), sym, side, qty: n, status: 'pending' })
      setTimeout(() => useStore.getState().orderFailed(order_id, 'unknown'), 5000)
    } catch {
      setErr('network')
    }
  }

  return (
    <section className="ticket">
      <div className="label">NEW POSITION</div>
      <select value={sym} onChange={(e) => useStore.getState().setTicketSym(e.target.value)} aria-label="symbol">
        {symbols.map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className={`quote ${pxVal && stale ? 'stale' : ''}`}>
        {pxVal ? (
          <>
            <span className={dirCls(px?.dir ?? 0)} data-testid="quote-px">{fmtPx(pxVal)} {dirMark(px?.dir ?? 0)}</span> {stale ? <span className="dim stale-tag">stale {age}s</span> : <Sparkline sym={sym} />}
          </>
        ) : (
          '—'
        )}
      </div>
      <input value={qty} onChange={(e) => setQty(e.target.value)} aria-label="qty" type="number" min={1} max={10000} />
      <div className="pair">
        <button className="buy" disabled={disabled} onClick={() => submit('buy')}>BUY</button>
        <button className="sell" disabled={disabled} onClick={() => submit('sell')}>SELL</button>
      </div>
      <div className="dim">{pxVal && valid ? `est. ${fmtNotional(n * pxVal)} notional` : ' '}</div>
      {err && <div className="err">{err}</div>}
    </section>
  )
}
