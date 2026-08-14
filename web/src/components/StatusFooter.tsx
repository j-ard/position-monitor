import { live } from '../ws/client'
import { useStore } from '../store/store'

const chaos = (body: object) =>
  fetch('/api/chaos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export default function StatusFooter() {
  const conn = useStore((s) => s.conn)
  const clock = useStore((s) => s.clock)
  return (
    <footer className="foot">
      <span>
        ws <span className={`conn-${conn}`}>●</span> {conn} · heartbeat {((clock - live.lastBeat) / 1000).toFixed(1)}s
      </span>
      <span className="dim chaos">
        chaos:
        <button onClick={() => chaos({ mode: 'stall', duration_ms: 5000 })}>stall</button>
        <button onClick={() => chaos({ mode: 'symbol_stall', duration_ms: 8000, symbol: 'AAPL' })}>sym</button>
        <button onClick={() => chaos({ mode: 'drop', duration_ms: 0 })}>drop</button>
      </span>
    </footer>
  )
}
