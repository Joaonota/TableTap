import type { Table, TableStatus, TableSession, TableSessionStatus } from '@/types'

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  free: 'Livre',
  occupied: 'Ocupada',
  unavailable: 'Indisponível'
}

export const SESSION_STATUS_LABELS: Record<TableSessionStatus, string> = {
  active: 'Ativa',
  closed: 'Encerrada',
  cancelled: 'Cancelada'
}

/**
 * Estado efetivo apresentado ao restaurante e ao cliente.
 * Uma mesa desativada é sempre "indisponível", independentemente do estado.
 */
export function effectiveTableStatus(table: Pick<Table, 'status' | 'isActive'>): TableStatus {
  if (!table.isActive) return 'unavailable'
  return table.status
}

export interface TableCounts {
  total: number
  free: number
  occupied: number
  unavailable: number
}

export function countTables(tables: Pick<Table, 'status' | 'isActive'>[]): TableCounts {
  const counts: TableCounts = { total: tables.length, free: 0, occupied: 0, unavailable: 0 }
  for (const t of tables) counts[effectiveTableStatus(t)]++
  return counts
}

/** Mudanças manuais permitidas (ocupação só acontece via sessão). */
export function canSetManualStatus(table: Pick<Table, 'status'>, target: 'free' | 'unavailable'): boolean {
  if (table.status === 'occupied') return false
  return table.status !== target
}

/** Uma nova sessão só pode começar numa mesa ativa e livre. */
export function canStartSession(table: Pick<Table, 'status' | 'isActive'>): boolean {
  return table.isActive && table.status === 'free'
}

/** Soma dos pedidos não cancelados. */
export function sumOrderTotals(orders: { status: string; total: number }[]): number {
  const total = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  return Math.round(total * 100) / 100
}

/** Duração legível de uma sessão (ex.: "12 min", "1h 05m", "2d 4h"). */
export function formatDuration(fromIso: string, toIso?: string): string {
  const end = toIso ? new Date(toIso).getTime() : Date.now()
  const mins = Math.max(0, Math.floor((end - new Date(fromIso).getTime()) / 60000))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ${String(mins % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

/** Hora de início: só a hora se for hoje; caso contrário, dia/mês e hora. */
export function formatStartTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return time
  return `${date.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' })} ${time}`
}

export function isSessionOpen(session: Pick<TableSession, 'status'> | null | undefined): boolean {
  return session?.status === 'active'
}
