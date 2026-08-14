import type { Conn } from '../types'

export function connState(i: { wsOpen: boolean; everConnected: boolean; lastBeat: number; now: number }): Conn {
  if (!i.wsOpen) return i.everConnected ? 'reconnecting' : 'connecting'
  const gap = i.now - i.lastBeat
  if (gap < 2500) return 'live'
  if (gap <= 6000) return 'degraded'
  return 'stale'
}

export const backoff = (attempt: number) => Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 250
