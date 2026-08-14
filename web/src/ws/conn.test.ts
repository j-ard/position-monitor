import { describe, expect, it } from 'vitest'
import { backoff, connState } from './conn'

describe('connState', () => {
  const base = { wsOpen: true, everConnected: true, lastBeat: 10_000 }
  it('live under 2.5s gap', () => {
    expect(connState({ ...base, now: 12_400 })).toBe('live')
  })
  it('degraded 2.5-6s', () => {
    expect(connState({ ...base, now: 12_600 })).toBe('degraded')
    expect(connState({ ...base, now: 15_900 })).toBe('degraded')
  })
  it('boundary at gap===6000: degraded, then stale', () => {
    expect(connState({ ...base, now: 16_000 })).toBe('degraded')
    expect(connState({ ...base, now: 16_001 })).toBe('stale')
  })
  it('stale over 6s', () => {
    expect(connState({ ...base, now: 16_100 })).toBe('stale')
  })
  it('closed socket: connecting before first connect, reconnecting after', () => {
    expect(connState({ wsOpen: false, everConnected: false, lastBeat: 0, now: 0 })).toBe('connecting')
    expect(connState({ wsOpen: false, everConnected: true, lastBeat: 0, now: 0 })).toBe('reconnecting')
  })
})

describe('backoff', () => {
  it('doubles and caps at 30s', () => {
    expect(backoff(0)).toBeGreaterThanOrEqual(500)
    expect(backoff(0)).toBeLessThan(1000)
    expect(backoff(10)).toBeLessThanOrEqual(30_250)
  })
})
