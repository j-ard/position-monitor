const n2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const n0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const sign = (v: number) => (v < 0 ? '-' : '+')

export const fmtPx = (v: number) => n2.format(v)
export const fmtQty = (q: number) => sign(q) + n0.format(Math.abs(q))
export const fmtUsd = (v: number) => sign(v) + '$' + n0.format(Math.abs(v))
export const fmtPct = (v: number) => sign(v) + n2.format(Math.abs(v))
export const fmtNotional = (v: number) => '$' + n0.format(Math.abs(v))
export const fmtClock = (ms: number) => new Date(ms).toTimeString().slice(0, 8)
