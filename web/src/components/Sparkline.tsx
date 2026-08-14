import { useEffect, useRef } from 'react'
import { record, series } from '../lib/spark'
import { useStore } from '../store/store'

export default function Sparkline({ sym }: { sym: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const px = useStore((s) => s.prices[sym]?.px)
  useEffect(() => {
    const c = ref.current
    if (!c || px == null) return
    record(sym, px, Date.now())
    const s = series(sym)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    if (s.length < 2) return
    const lo = Math.min(...s.map((p) => p.px))
    const hi = Math.max(...s.map((p) => p.px))
    const up = s[s.length - 1].px >= s[0].px
    ctx.strokeStyle = up ? '#3fb950' : '#f85149'
    ctx.lineWidth = 1
    ctx.beginPath()
    s.forEach((p, i) => {
      const x = (i / (s.length - 1)) * c.width
      const y = hi === lo ? c.height / 2 : c.height - ((p.px - lo) / (hi - lo)) * (c.height - 2) - 1
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.stroke()
  }, [sym, px])
  return <canvas ref={ref} width={52} height={14} className="spark" />
}
