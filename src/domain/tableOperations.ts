/**
 * Operação de sala: garçons responsáveis pelas mesas (migração 2000).
 * Os dados vêm de get_table_operations; aqui só se calcula o estado visível,
 * os alertas e os textos. Quem vê o quê é decidido no servidor.
 */
import type { ServiceRequest } from '@/types'

export type AssignmentRole = 'primary' | 'support'
export type DutyStatus = 'on_duty' | 'off_duty' | 'on_break' | 'absent'

export interface TableAssignment {
  id: string
  tableId: string
  staffId: string
  staffName: string
  role: AssignmentRole
  dutyStatus: DutyStatus
  hasAccount: boolean
  expiresAt?: string
  assignedAt: string
  assignedByName?: string
}

export interface TableOrderCounts {
  count: number
  received: number
  confirmed: number
  preparing: number
  ready: number
  delivered: number
  unpaid: number
  total: number
  oldestReadyAt?: string
}

export interface TableOperation {
  id: string
  number: string
  name: string
  area: string
  capacity: number
  status: 'free' | 'occupied' | 'unavailable'
  session?: {
    id: string
    startedAt: string
    customerName?: string
    partySize?: number
    billRequestedAt?: string
    participants: number
  }
  orders: TableOrderCounts
  requests: ServiceRequest[]
  assignments: TableAssignment[]
}

export interface OpsStaff {
  id: string
  name: string
  role: string
  dutyStatus: DutyStatus
  dutyStatusAt?: string
  hasAccount: boolean
  tables: number
}

export interface OpsMe {
  staffId?: string
  name: string
  role?: string
  dutyStatus?: DutyStatus
  scope: 'all' | 'assigned'
  canManage: boolean
  canActForOthers: boolean
}

export interface TableOperationsSnapshot {
  tables: TableOperation[]
  staff: OpsStaff[]
  me: OpsMe
  serverTime: string
}

export type AssignmentEventKind =
  | 'assigned'
  | 'removed'
  | 'transferred'
  | 'role_changed'
  | 'expired'
  | 'request_taken'
  | 'request_completed'
  | 'session_closed'

export interface AssignmentEvent {
  id: string
  event: AssignmentEventKind
  staffId?: string
  staffName?: string
  fromStaffId?: string
  fromStaffName?: string
  role?: AssignmentRole
  reason?: string
  actorName: string
  sessionId?: string
  createdAt: string
}

export type ServiceAction = 'acknowledge' | 'start' | 'complete' | 'cancel' | 'take_over'

// ---------------------------------------------------------------- Estado da mesa
export type TableOpState =
  | 'free'
  | 'unavailable'
  | 'request_pending'
  | 'awaiting_delivery'
  | 'bill_requested'
  | 'ready'
  | 'awaiting_service'
  | 'preparing'
  | 'finished'
  | 'occupied'

export const TABLE_STATE: Record<TableOpState, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  free: { label: 'Livre', tone: 'success' },
  unavailable: { label: 'Indisponível', tone: 'neutral' },
  request_pending: { label: 'Solicitação pendente', tone: 'danger' },
  awaiting_delivery: { label: 'Aguardando entrega', tone: 'danger' },
  bill_requested: { label: 'Conta solicitada', tone: 'warning' },
  ready: { label: 'Pedido pronto', tone: 'warning' },
  awaiting_service: { label: 'Aguardando atendimento', tone: 'warning' },
  preparing: { label: 'Pedido em preparação', tone: 'primary' },
  finished: { label: 'Finalizada', tone: 'neutral' },
  occupied: { label: 'Ocupada', tone: 'primary' }
}

/** Pedido pronto há mais do que isto sem ser entregue → alerta. */
export const READY_WAIT_MINUTES = 5
/** Chamada sem "recebido" há mais do que isto → alerta (e outro garçom pode assumir). */
export const REQUEST_WAIT_MINUTES = 2

const minutesSince = (iso: string | undefined, now: Date) =>
  iso ? (now.getTime() - new Date(iso).getTime()) / 60000 : 0

/** O estado mais urgente primeiro (o que o garçom tem de fazer a seguir). */
export function tableState(t: TableOperation, now = new Date()): TableOpState {
  if (!t.session) return t.status === 'unavailable' ? 'unavailable' : 'free'
  const open = t.requests.filter(r => r.status === 'new' || r.status === 'in_progress')
  if (open.some(r => r.status === 'new' && r.type !== 'bill')) return 'request_pending'
  if (t.orders.ready > 0 && minutesSince(t.orders.oldestReadyAt, now) >= READY_WAIT_MINUTES) return 'awaiting_delivery'
  if (t.session.billRequestedAt || open.some(r => r.type === 'bill')) return 'bill_requested'
  if (t.orders.ready > 0) return 'ready'
  if (t.orders.received > 0) return 'awaiting_service'
  if (t.orders.preparing > 0 || t.orders.confirmed > 0) return 'preparing'
  if (t.orders.count > 0 && t.orders.unpaid === 0 && t.orders.delivered === t.orders.count) return 'finished'
  return 'occupied'
}

export const primaryOf = (t: TableOperation) => t.assignments.find(a => a.role === 'primary')
export const supportsOf = (t: TableOperation) => t.assignments.filter(a => a.role === 'support')

/** Pedidos ainda por entregar. */
export const pendingOrders = (t: TableOperation) => t.orders.received + t.orders.confirmed + t.orders.preparing + t.orders.ready

// ---------------------------------------------------------------- Alertas
export interface TableAlert {
  kind: 'request_waiting' | 'ready_waiting' | 'no_responsible' | 'responsible_away' | 'temporary_ending'
  text: string
  severity: 'high' | 'medium'
}

export function tableAlerts(t: TableOperation, now = new Date()): TableAlert[] {
  const alerts: TableAlert[] = []
  const waiting = t.requests.filter(
    r => r.status === 'new' && !r.acknowledgedAt && minutesSince(r.createdAt, now) >= REQUEST_WAIT_MINUTES
  )
  if (waiting.length) {
    alerts.push({
      kind: 'request_waiting',
      severity: 'high',
      text: `Chamada sem resposta há ${Math.floor(minutesSince(waiting[0]!.createdAt, now))} min`
    })
  }
  if (t.orders.ready > 0 && minutesSince(t.orders.oldestReadyAt, now) >= READY_WAIT_MINUTES) {
    alerts.push({
      kind: 'ready_waiting',
      severity: 'high',
      text: `Pedido pronto há ${Math.floor(minutesSince(t.orders.oldestReadyAt, now))} min`
    })
  }
  const primary = primaryOf(t)
  if (t.session && !t.assignments.length) {
    alerts.push({ kind: 'no_responsible', severity: 'medium', text: 'Mesa ocupada sem garçom responsável' })
  } else if (t.session && primary && primary.dutyStatus !== 'on_duty') {
    const onDutySupport = supportsOf(t).some(s => s.dutyStatus === 'on_duty')
    alerts.push({
      kind: 'responsible_away',
      severity: onDutySupport ? 'medium' : 'high',
      text: `${primary.staffName} está ${DUTY_LABELS[primary.dutyStatus].toLowerCase()}`
    })
  }
  for (const a of t.assignments) {
    if (a.expiresAt && minutesSince(a.expiresAt, now) > -15 && minutesSince(a.expiresAt, now) < 0) {
      alerts.push({ kind: 'temporary_ending', severity: 'medium', text: `Atribuição de ${a.staffName} termina em breve` })
    }
  }
  return alerts
}

// ---------------------------------------------------------------- Textos
export const DUTY_LABELS: Record<DutyStatus, string> = {
  on_duty: 'Em serviço',
  off_duty: 'Fora de serviço',
  on_break: 'Em pausa',
  absent: 'Ausente'
}

export const ROLE_TEXT: Record<AssignmentRole, string> = {
  primary: 'Garçom principal',
  support: 'Garçom de apoio'
}

export const REQUEST_REASON: Record<ServiceRequest['type'], string> = {
  waiter_call: 'Atendimento',
  water: 'Água',
  cutlery: 'Talheres',
  bill: 'Conta',
  general_help: 'Ajuda'
}

/** "Recebido" / "Em atendimento" / "Nova" — o passo em que a chamada está. */
export function requestStep(r: ServiceRequest): 'new' | 'acknowledged' | 'in_progress' | 'closed' {
  if (r.status === 'completed' || r.status === 'cancelled') return 'closed'
  if (r.status === 'in_progress') return 'in_progress'
  return r.acknowledgedAt ? 'acknowledged' : 'new'
}

export function eventText(e: AssignmentEvent, tableLabel: string): string {
  const who = e.staffName || 'Sem nome'
  switch (e.event) {
    case 'assigned':
      return `${who} assumiu ${tableLabel}${e.role === 'support' ? ' (apoio)' : ''}`
    case 'transferred':
      return `${tableLabel} transferida${e.fromStaffName ? ` de ${e.fromStaffName}` : ''} para ${who}`
    case 'removed':
      return `${who} deixou ${tableLabel}`
    case 'role_changed':
      return `${who} passou a ${e.role === 'primary' ? 'garçom principal' : 'garçom de apoio'}`
    case 'expired':
      return `Terminou a atribuição temporária de ${who}`
    case 'request_taken':
      return `${who} assumiu uma chamada${e.fromStaffName ? ` de ${e.fromStaffName}` : ''}`
    case 'request_completed':
      return `${who} concluiu atendimento`
    case 'session_closed':
      return `Mesa encerrada — responsável ${who}`
  }
}

export function sessionDuration(startedAt: string | undefined, now = new Date()): string {
  if (!startedAt) return ''
  const mins = Math.max(0, Math.floor(minutesSince(startedAt, now)))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}`
}

export const tableLabel = (t: Pick<TableOperation, 'number' | 'name'>) =>
  t.name && t.name.trim() && t.name.trim() !== t.number ? `Mesa ${t.number} · ${t.name}` : `Mesa ${t.number}`
