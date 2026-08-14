import { useShallow } from 'zustand/react/shallow'
import { fmtUsd } from '../lib/format'
import { totals } from '../store/selectors'
import { useStore } from '../store/store'

export default function AccountStrip() {
  const t = useStore(useShallow((s) => totals(s)))
  const conn = useStore((s) => s.conn)
  const cls = (v: number) => (v >= 0 ? 'up' : 'dn')
  return (
    <header className="strip">
      <span className="label">POSITIONS</span>
      <span>
        uPnL <b className={`big ${cls(t.u)}`}>{fmtUsd(t.u)} {t.u >= 0 ? '▲' : '▼'}</b>
      </span>
      <span className="muted">Day <span className={cls(t.day)}>{fmtUsd(t.day)}</span></span>
      <span className="muted">Realized <span className={cls(t.realized)}>{fmtUsd(t.realized)}</span></span>
      <span className="muted">Gross <span className="text">${Math.round(t.gross / 1000)}k</span> · {t.count}</span>
      <span className={`conn conn-${conn}`}>● {conn.toUpperCase()}</span>
    </header>
  )
}
