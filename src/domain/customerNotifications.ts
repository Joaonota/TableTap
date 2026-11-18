/**
 * Notificações do CLIENTE (menu da mesa) — regras partilhadas.
 *
 * Os eventos chegam em tempo real pelo canal privado do dispositivo
 * (Supabase Realtime Broadcast, migração 1300). Cada evento traz um
 * `eventId` determinístico: cada alteração gera no máximo UMA notificação
 * por dispositivo, mesmo que o Realtime a entregue mais de uma vez.
 */
import type { OrderStatus } from '@/types'

/** Eventos enviados pela base de dados (ver migração 1300). */
export type CustomerEventType =
  | 'order.status_changed'
  | 'payment.confirmed'
  | 'service_request.status_changed'
  | 'session.closed'
  | 'session.cancelled'

/**
 * Preparados para o futuro (ainda não emitidos pela base de dados):
 * pedido atualizado, item indisponível, pedido parcialmente preparado,
 * pedido de atendimento recebido, chamada do empregado.
 */
export type FutureCustomerEventType =
  | 'order.updated'
  | 'order.item_unavailable'
  | 'order.partially_ready'
  | 'service_request.received'
  | 'waiter.called'

export interface CustomerEvent {
  eventId: string
  type: CustomerEventType | FutureCustomerEventType
  sessionId: string
  occurredAt: string
  orderId?: string
  orderCode?: string
  status?: string
  previousStatus?: string
  serviceRequestId?: string
  requestType?: string
}

export type NotificationTone = 'info' | 'progress' | 'success' | 'warning' | 'danger'
/** Ícone (Lucide) por tipo de notificação — sem emojis na interface. */
export type NotificationIcon = 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'payment' | 'service' | 'session'

export interface CustomerNotificationContent {
  title: string
  message: string
  tone: NotificationTone
  icon: NotificationIcon
  /** Merece som/vibração (alteração relevante). */
  alert: boolean
}

/** Notificação apresentada no dispositivo. */
export interface CustomerNotificationItem extends CustomerNotificationContent {
  id: string
  eventType: CustomerEvent['type']
  orderId?: string
  orderCode?: string
  status?: string
  receivedAt: number
}

const ORDER_MESSAGES: Partial<Record<OrderStatus, CustomerNotificationContent>> = {
  received: {
    title: 'Pedido recebido',
    message: 'O seu pedido foi recebido e está a ser processado.',
    tone: 'info',
    icon: 'received',
    alert: true
  },
  confirmed: {
    title: 'Pedido recebido',
    message: 'O seu pedido foi recebido e está a ser processado.',
    tone: 'info',
    icon: 'received',
    alert: true
  },
  preparing: {
    title: 'Pedido em preparação',
    message: 'O seu pedido está a ser preparado.',
    tone: 'progress',
    icon: 'preparing',
    alert: true
  },
  ready: {
    title: 'Pedido pronto',
    message: 'O seu pedido está pronto. Aguarde pelo atendimento.',
    tone: 'success',
    icon: 'ready',
    alert: true
  },
  delivered: {
    title: 'Pedido entregue',
    message: 'O seu pedido foi entregue.',
    tone: 'success',
    icon: 'delivered',
    alert: true
  },
  cancelled: {
    title: 'Pedido cancelado',
    message: 'O seu pedido foi cancelado. Consulte os detalhes para mais informações.',
    tone: 'danger',
    icon: 'cancelled',
    alert: true
  }
}

const SERVICE_MESSAGES: Record<string, CustomerNotificationContent> = {
  in_progress: {
    title: 'Pedido de atendimento recebido',
    message: 'A equipa já está a tratar do seu pedido.',
    tone: 'info',
    icon: 'service',
    alert: true
  },
  completed: {
    title: 'Atendimento concluído',
    message: 'O seu pedido de atendimento foi concluído.',
    tone: 'success',
    icon: 'service',
    alert: false
  }
}

/** Texto da notificação para um evento (null = evento sem notificação visível). */
export function describeCustomerEvent(event: CustomerEvent): CustomerNotificationContent | null {
  switch (event.type) {
    case 'order.status_changed': {
      const base = ORDER_MESSAGES[event.status as OrderStatus]
      if (!base) return null
      return event.orderCode ? { ...base, title: `${base.title} · ${event.orderCode}` } : base
    }
    case 'payment.confirmed':
      return {
        title: 'Pagamento confirmado',
        message: 'O pagamento foi confirmado pela equipa. Obrigado!',
        tone: 'success',
        icon: 'payment',
        alert: true
      }
    case 'service_request.status_changed':
      return SERVICE_MESSAGES[event.status ?? ''] ?? null
    // O fim da sessão tem o seu próprio ecrã (agradecimento / avaliação).
    case 'session.closed':
    case 'session.cancelled':
      return null
    default:
      return null
  }
}

/** Chave de deduplicação: um estado de um pedido = uma notificação. */
export const orderStatusEventId = (orderId: string, status: string) => `${orderId}:status:${status}`

// ---------------------------------------------------------------------
// Progresso do pedido (área do pedido no ecrã)
// ---------------------------------------------------------------------
export type OrderProgressStep = 'received' | 'preparing' | 'ready' | 'delivered'

export const ORDER_PROGRESS_STEPS: { key: OrderProgressStep; label: string }[] = [
  { key: 'received', label: 'Recebido' },
  { key: 'preparing', label: 'Em preparação' },
  { key: 'ready', label: 'Pronto' },
  { key: 'delivered', label: 'Entregue' }
]

/** Índice do passo atual (confirmado conta como recebido); -1 = cancelado. */
export function orderProgressIndex(status: OrderStatus): number {
  switch (status) {
    case 'received':
    case 'confirmed':
      return 0
    case 'preparing':
      return 1
    case 'ready':
      return 2
    case 'delivered':
      return 3
    case 'cancelled':
      return -1
    default:
      return 0
  }
}

/** Estado de cada passo para desenhar a linha do tempo. */
export function orderProgressSteps(status: OrderStatus): { key: OrderProgressStep; label: string; state: 'done' | 'current' | 'todo' }[] {
  const current = orderProgressIndex(status)
  return ORDER_PROGRESS_STEPS.map((step, i) => ({
    ...step,
    state: current < 0 ? 'todo' : i < current || (i === current && status === 'delivered') ? 'done' : i === current ? 'current' : 'todo'
  }))
}

/** Valida e normaliza o payload recebido do Realtime (nunca confiar cegamente). */
export function parseCustomerEvent(raw: unknown): CustomerEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.eventId !== 'string' || typeof r.type !== 'string' || typeof r.sessionId !== 'string') return null
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    eventId: r.eventId,
    type: r.type as CustomerEvent['type'],
    sessionId: r.sessionId,
    occurredAt: str(r.occurredAt) ?? new Date().toISOString(),
    orderId: str(r.orderId),
    orderCode: str(r.orderCode),
    status: str(r.status),
    previousStatus: str(r.previousStatus),
    serviceRequestId: str(r.serviceRequestId),
    requestType: str(r.requestType)
  }
}
