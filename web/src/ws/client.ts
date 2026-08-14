import { useStore } from '../store/store'
import type { Out } from '../types'
import { push, startFlusher } from './buffer'
import { backoff, connState } from './conn'

export const live = { wsOpen: false, everConnected: false, lastBeat: 0 }

let attempt = 0
let started = false

export function connect(url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) {
  if (!started) {
    started = true
    startFlusher((m) => useStore.getState().flushTicks(m))
    setInterval(() => {
      useStore.getState().setConn(connState({ ...live, now: Date.now() }))
      useStore.getState().setClock(Date.now())
    }, 500)
  }
  const ws = new WebSocket(url)
  ws.onopen = () => {
    live.wsOpen = true
    live.everConnected = true
    live.lastBeat = Date.now()
    attempt = 0
  }
  ws.onmessage = (e) => {
    live.lastBeat = Date.now()
    const m: Out = JSON.parse(e.data)
    if (m.type === 'ticks') push(m.ticks)
    else if (m.type !== 'heartbeat') useStore.getState().applyMsg(m)
  }
  ws.onclose = () => {
    live.wsOpen = false
    setTimeout(() => connect(url), backoff(attempt++))
  }
  ws.onerror = () => ws.close()
}
