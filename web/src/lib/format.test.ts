import { describe, expect, it } from 'vitest'
import { fmtClock, fmtNotional, fmtPct, fmtPx, fmtQty, fmtUsd } from './format'

describe('format', () => {
  it('px fixed 2dp', () => {
    expect(fmtPx(232.4)).toBe('232.40')
    expect(fmtPx(1234.567)).toBe('1,234.57')
  })
  it('qty signed int', () => {
    expect(fmtQty(200)).toBe('+200')
    expect(fmtQty(-500)).toBe('-500')
  })
  it('usd signed 0dp', () => {
    expect(fmtUsd(4213.4)).toBe('+$4,213')
    expect(fmtUsd(-812)).toBe('-$812')
    expect(fmtUsd(0)).toBe('+$0')
  })
  it('pct signed 2dp', () => {
    expect(fmtPct(0.58)).toBe('+0.58')
    expect(fmtPct(-0.617)).toBe('-0.62')
  })
  it('notional', () => {
    expect(fmtNotional(23245.4)).toBe('$23,245')
  })
  it('clock', () => {
    expect(fmtClock(Date.UTC(2026, 0, 1, 10, 41, 3))).toMatch(/\d{2}:\d{2}:\d{2}/)
  })
})
