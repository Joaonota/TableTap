/**
 * Empresa com vários estabelecimentos (migração 1900) — tipos e textos.
 * Os números vêm do servidor (get_company_overview / get_company_alerts).
 */

export interface CompanyTotals {
  revenue: number
  orders: number
  cancelled: number
  paid: number
  refunds: number
  prevRevenue: number
  prevOrders: number
  averageTicket: number
}

export interface LocationPerformance {
  id: string
  name: string
  isActive: boolean
  revenue: number
  orders: number
  cancelled: number
  paid: number
  refunds: number
  prevRevenue: number
  prevOrders: number
  averageTicket: number
  /** % de pedidos cancelados. */
  cancellationRate: number
}

export interface ProductPerformance {
  name: string
  quantity: number
  revenue: number
  byRestaurant: { restaurantId: string; quantity: number; revenue: number }[]
}

export interface CompanyOverview {
  from: string
  to: string
  totals: CompanyTotals
  restaurants: LocationPerformance[]
  products: ProductPerformance[]
  daily: { day: string; restaurantId: string; revenue: number }[]
}

export type AlertKind =
  | 'cancellations_by_staff'
  | 'cancelled_after_preparation'
  | 'frequent_refunds'
  | 'payment_mismatch'
  | 'delivered_unpaid'
  | 'forced_close'

export interface CompanyAlert {
  kind: AlertKind
  severity: 'high' | 'medium'
  restaurantId: string
  restaurantName?: string
  actor?: string
  count: number
  amount?: number
  rate?: number
  orderCodes?: string[]
}

export interface MenuCopyReport {
  restaurantId: string
  name: string
  categoriesCreated: number
  productsCreated: number
  productsUpdated: number
  productsSkipped: number
}

export const ALERT_TEXT: Record<AlertKind, { title: string; describe: (a: CompanyAlert) => string; action: string }> = {
  cancellations_by_staff: {
    title: 'Muitos pedidos cancelados pela mesma pessoa',
    describe: a => `${a.actor || 'Sem nome'} cancelou ${a.count} pedidos (${a.rate ?? 0}% dos pedidos do estabelecimento).`,
    action: 'Confirme os motivos com a equipa e veja o histórico em Pedidos.'
  },
  cancelled_after_preparation: {
    title: 'Pedidos cancelados depois de preparados',
    describe: a => `${a.count} pedidos foram cancelados depois de a cozinha começar${a.actor ? ` (por ${a.actor})` : ''}.`,
    action: 'Produtos preparados e não servidos: verifique desperdício e motivos.'
  },
  frequent_refunds: {
    title: 'Reembolsos frequentes',
    describe: a =>
      `${a.count} reembolsos${a.rate ? ` (${a.rate}% dos pagamentos)` : ''}${a.actor ? ` — registados por ${a.actor}` : ''}.`,
    action: 'Confirme cada reembolso em Pagamentos.'
  },
  payment_mismatch: {
    title: 'Diferenças entre pagamentos e pedidos',
    describe: a =>
      `${a.count} ${a.count === 1 ? 'pedido marcado' : 'pedidos marcados'} como pago com valor recebido diferente do total${
        a.orderCodes?.length ? ` (${a.orderCodes.slice(0, 5).join(', ')})` : ''
      }.`,
    action: 'Compare o valor recebido com o total em Pagamentos.'
  },
  delivered_unpaid: {
    title: 'Pedidos entregues sem pagamento',
    describe: a => `${a.count} ${a.count === 1 ? 'pedido entregue' : 'pedidos entregues'} em mesas já encerradas, sem pagamento registado.`,
    action: 'Verifique se o pagamento foi recebido e não registado.'
  },
  forced_close: {
    title: 'Mesas encerradas com valores por pagar',
    describe: a => `${a.count} ${a.count === 1 ? 'mesa encerrada' : 'mesas encerradas'} à força${a.actor ? ` por ${a.actor}` : ''}.`,
    action: 'O motivo de cada fecho está na auditoria.'
  }
}

/** Variação em % face ao período anterior (null se não havia base). */
export function growth(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export type PeriodKey = 'today' | '7d' | '30d' | '90d'
export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: 'today', label: 'Hoje', days: 1 },
  { key: '7d', label: '7 dias', days: 7 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 }
]

/** Período [início do dia há N-1 dias, agora]. */
export function periodRange(days: number, now = new Date()): { from: Date; to: Date } {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (days - 1))
  return { from, to: now }
}
