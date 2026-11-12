import { mockStorage } from './mockStorage'
import type { IPlanAccessRepository } from '../interfaces'
import type { LimitKey, Plan } from '@/types'
import { DomainError } from '@/domain/errors'
import { evaluateLimit, getLimitEntry, limitReachedMessage, planLimitValue, type LimitEvaluation } from '@/domain/planLimits'

/**
 * Plano efetivo e consumo de recursos (mock que imita o backend).
 * As funções síncronas são usadas pelos outros repositórios mock para
 * recusar criações acima do limite, como o backend fará.
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export function resolveTenantPlan(tenantId: string): Plan | null {
  const db = mockStorage.getDb()
  const sub = db.subscriptions.find(s => s.tenantId === tenantId)
  const company = db.companies.find(c => c.id === tenantId)
  const planId = sub?.planId ?? company?.planId ?? db.platformConfig?.defaultPlanId
  return db.plans.find(p => p.id === planId) ?? null
}

/** Contagem por recurso. Para um limite novo, acrescentar o caso aqui. */
export function countUsageSync(tenantId: string, key: LimitKey, restaurantId?: string): number {
  const db = mockStorage.getDb()
  const tenantRestaurantIds = db.restaurants.filter(r => r.tenantId === tenantId).map(r => r.id)
  const inScope = (rid: string) => (restaurantId ? rid === restaurantId : tenantRestaurantIds.includes(rid))

  switch (key) {
    case 'RESTAURANTS':
      return tenantRestaurantIds.length
    case 'STAFF':
      return db.staff.filter(s => s.tenantId === tenantId && s.isActive).length
    case 'TABLES':
      return db.tables.filter(t => inScope(t.restaurantId)).length
    case 'PRODUCTS':
      return db.products.filter(p => inScope(p.restaurantId)).length
    case 'CATEGORIES':
      return db.categories.filter(c => inScope(c.restaurantId)).length
    case 'ORDERS_PER_MONTH': {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      return db.orders.filter(o => inScope(o.restaurantId) && o.createdAt >= startOfMonth && o.status !== 'cancelled').length
    }
    default: {
      const unhandled: never = key
      throw new Error(`Contagem não implementada para o limite ${unhandled}`)
    }
  }
}

export function evaluateLimitSync(tenantId: string, key: LimitKey, restaurantId?: string): LimitEvaluation {
  const plan = resolveTenantPlan(tenantId)
  const scopedRestaurant = getLimitEntry(key).scope === 'restaurant' ? restaurantId : undefined
  return evaluateLimit(key, planLimitValue(plan, key), countUsageSync(tenantId, key, scopedRestaurant), plan?.name ?? 'sem plano')
}

/** Recusa a criação de um recurso quando o limite do plano foi atingido. */
export function assertWithinPlanLimit(tenantId: string, key: LimitKey, restaurantId?: string): void {
  const ev = evaluateLimitSync(tenantId, key, restaurantId)
  if (ev.reached) throw new DomainError('plan_limit_reached', limitReachedMessage(ev))
}

export class MockPlanAccessRepository implements IPlanAccessRepository {
  async getTenantPlan(tenantId: string): Promise<Plan | null> {
    const plan = resolveTenantPlan(tenantId)
    return plan ? clone(plan) : null
  }

  async countUsage(tenantId: string, key: LimitKey, restaurantId?: string): Promise<number> {
    return countUsageSync(tenantId, key, restaurantId)
  }
}
