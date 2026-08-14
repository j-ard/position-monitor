import type { Tick } from '../types'

let buf: Tick[] = []

export function push(batch: Tick[]) {
  buf.push(...batch)
}

export function coalesce(): Record<string, Tick> | null {
  if (!buf.length) return null
  const latest: Record<string, Tick> = {}
  for (const t of buf) latest[t.sym] = t
  buf = []
  return latest
}

export function startFlusher(flush: (m: Record<string, Tick>) => void) {
  let last = 0
  const loop = (now: number) => {
    if (now - last >= 100) {
      const m = coalesce()
      if (m) flush(m)
      last = now
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
