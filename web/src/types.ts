export type Side = 'buy' | 'sell'
export interface Tick { sym: string; px: number; ts: number }
export interface Position { sym: string; qty: number; avg_px: number; opened_at: number }
export interface SymbolInfo { sym: string; prev_close: number }
export interface Account { realized_pnl: number }

export type Out =
  | { type: 'snapshot'; seq: number; symbols: SymbolInfo[]; prices: Tick[]; positions: Position[]; account: Account }
  | { type: 'ticks'; seq: number; ticks: Tick[] }
  | { type: 'fill'; order_id: number; sym: string; side: Side; qty: number; px: number; ts: number; status: string }
  | { type: 'position'; sym: string; position: Position | null; account: Account }
  | { type: 'heartbeat'; ts: number; seq: number }

export type Conn = 'connecting' | 'live' | 'degraded' | 'stale' | 'reconnecting'
export interface Px { px: number; dir: 1 | -1 | 0; recvTs: number }
export interface FillRow {
  id: number
  ts: number
  sym: string
  side: Side
  qty: number
  px?: number
  status: 'pending' | 'filled' | 'rejected' | 'unknown'
}
