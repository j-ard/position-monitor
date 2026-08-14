import { describe, expect, it } from 'vitest'
import { coalesce, push } from './buffer'

describe('buffer', () => {
  it('coalesces latest per symbol and drains', () => {
    push([{ sym: 'A', px: 1, ts: 1 }, { sym: 'B', px: 2, ts: 1 }])
    push([{ sym: 'A', px: 3, ts: 2 }])
    const out = coalesce()!
    expect(out['A'].px).toBe(3)
    expect(out['B'].px).toBe(2)
    expect(coalesce()).toBeNull()
  })
})
