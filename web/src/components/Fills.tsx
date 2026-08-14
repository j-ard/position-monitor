import { fmtClock, fmtPx } from '../lib/format'
import { useStore } from '../store/store'
import type { FillRow } from '../types'

function line(f: FillRow) {
  const verb = f.side === 'buy' ? 'BOT' : 'SLD'
  if (f.status === 'pending') return <>⧗ {verb} {f.qty} {f.sym} <span className="dim">pending</span></>
  if (f.status === 'filled') return <><span className={f.side === 'buy' ? 'up' : 'dn'}>{verb}</span> {f.qty} {f.sym} @ {fmtPx(f.px!)}</>
  return <span className="err">✕ {verb} {f.qty} {f.sym} {f.status}</span>
}

export default function Fills() {
  const fills = useStore((s) => s.fills)
  return (
    <section className="fills">
      <div className="label">FILLS</div>
      {fills.map((f) => (
        <div key={f.id} className="fill">
          <span className="dim">{fmtClock(f.ts)}</span> {line(f)}
        </div>
      ))}
    </section>
  )
}
