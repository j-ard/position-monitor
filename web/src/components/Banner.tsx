import { fmtClock } from '../lib/format'
import { live } from '../ws/client'
import { useStore } from '../store/store'

export default function Banner() {
  const conn = useStore((s) => s.conn)
  const clock = useStore((s) => s.clock)
  if (conn === 'degraded')
    return <div className="banner warn">FEED DEGRADED — last data {Math.round((clock - live.lastBeat) / 1000)}s ago</div>
  if (conn === 'stale')
    return <div className="banner bad">STALE — prices as of {fmtClock(live.lastBeat)}</div>
  if (conn === 'reconnecting') return <div className="banner bad">RECONNECTING…</div>
  return null
}
