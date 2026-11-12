import type { OrderStatus } from '@/types'
import type { SubscriptionStatus } from '@/types/plan'

/** Rótulos em português para estados guardados em inglês nos dados. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  preparing: 'Em preparação',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado'
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: 'Em teste',
  active: 'Ativa',
  suspended: 'Suspensa',
  expired: 'Expirada',
  cancelled: 'Cancelada'
}

export const orderStatusLabel = (status: string) => ORDER_STATUS_LABEL[status as OrderStatus] ?? status
export const subscriptionStatusLabel = (status: string) => SUBSCRIPTION_STATUS_LABEL[status as SubscriptionStatus] ?? status
