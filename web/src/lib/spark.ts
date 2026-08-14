const data = new Map<string, { px: number; ts: number }[]>()

export function record(sym: string, px: number, ts: number) {
  const s = data.get(sym) ?? []
  s.push({ px, ts })
  const cutoff = ts - 60_000
  while (s.length > 240 || (s.length && s[0].ts < cutoff)) s.shift()
  data.set(sym, s)
}

export const series = (sym: string) => data.get(sym) ?? []
