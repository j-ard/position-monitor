import { useEffect, useRef, useState } from 'react'
import { dirCls, dirMark } from '../lib/dir'
import { fmtPct, fmtPx, fmtQty, fmtUsd } from '../lib/format'
import { dayPnl, dayStart, staleAge, symStale, uPnl, uPnlPct } from '../store/selectors'
import { useStore } from '../store/store'
import Sparkline from './Sparkline'

export default function PositionRow({ sym }: { sym: string }) {
  const pos = useStore((s) => s.positions[sym])
  const px = useStore((s) => s.prices[sym])
  const prevClose = useStore((s) => s.symbols[sym])
  const stale = useStore((s) => symStale(s.prices[sym], s.clock))
  const age = useStore((s) => staleAge(s.prices[sym], s.clock))
  const ds = useStore((s) => dayStart(s.clock))
  const armed = useStore((s) => s.armed === sym)
  const conn = useStore((s) => s.conn)
  const [pulse, setPulse] = useState('')
  const prevQty = useRef(pos?.qty)
  useEffect(() => {
    if (pos && prevQty.current != null && pos.qty !== prevQty.current) {
      setPulse(pos.qty > prevQty.current ? 'pulse-up' : 'pulse-dn')
      prevQty.current = pos.qty
      const t = setTimeout(() => setPulse(''), 1000)
      return () => clearTimeout(t)
    }
    prevQty.current = pos?.qty
  }, [pos])

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => useStore.getState().setArmed(null), 3000)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && useStore.getState().setArmed(null)
    window.addEventListener('keydown', esc)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', esc)
    }
  }, [armed])

  function flatten() {
    const reject = () =>
      useStore.getState().addPending({
        id: -Date.now(),
        ts: Date.now(),
        sym,
        side: pos.qty > 0 ? 'sell' : 'buy',
        qty: Math.abs(pos.qty),
        status: 'rejected',
      })

    if (!armed) {
      useStore.getState().setArmed(sym)
      return
    }
    useStore.getState().setArmed(null)
    ;(async () => {
      try {
        const r = await fetch(`/api/positions/${sym}/close`, { method: 'POST' })
        if (r.status !== 202) {
          reject()
          return
        }
        const { order_id } = await r.json()
        useStore.getState().addPending({
          id: order_id,
          ts: Date.now(),
          sym,
          side: pos.qty > 0 ? 'sell' : 'buy',
          qty: Math.abs(pos.qty),
          status: 'pending',
        })
        setTimeout(() => useStore.getState().orderFailed(order_id, 'unknown'), 5000)
      } catch {
        reject()
      }
    })()
  }
  if (!pos) return null
  const u = uPnl(pos, px?.px)
  const upct = uPnlPct(pos, px?.px)
  const day = dayPnl(pos, px?.px, prevClose, ds)
  const cls = (v: number | null) => (v == null ? 'dim' : v >= 0 ? 'up' : 'dn')
  return (
    <tr data-testid={`row-${sym}`} className={`${stale ? 'stale' : ''} ${pulse}`}>
      <td className="sym sym-cell" onClick={() => useStore.getState().setTicketSym(sym)}>{sym}</td>
      <td className={pos.qty < 0 ? 'dn' : ''}>{fmtQty(pos.qty)}</td>
      <td className="muted">{fmtPx(pos.avg_px)}</td>
      <td data-testid={`last-${sym}`} className={dirCls(px?.dir ?? 0)}>
        {px ? fmtPx(px.px) : '—'} {dirMark(px?.dir ?? 0)}
      </td>
      <td>{stale ? <span className="dim stale-tag">stale {age}s</span> : <Sparkline sym={sym} />}</td>
      <td className={cls(u)}>{u == null ? '—' : fmtUsd(u)}</td>
      <td className={cls(upct)}>{upct == null ? '—' : fmtPct(upct)}</td>
      <td className={cls(day)}>{day == null ? '—' : fmtUsd(day)}</td>
      <td>
        <button className={`flat ${armed ? 'armed' : ''}`} disabled={stale || conn !== 'live'} onClick={flatten}>
          {armed ? `CONFIRM ${fmtQty(-pos.qty)} @ MKT` : 'FLAT'}
        </button>
      </td>
    </tr>
  )
}
