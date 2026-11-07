// src/services/planAccessService.ts
import { mockStorage } from '@/repositories/mock/mockStorage'
import type { FeatureKey, LimitKey, Plan, Subscription } from '@/types'
import { FEATURE_CATALOG, LIMIT_CATALOG } from '@/types/plan'

export interface CanUseResult {
  allowed: boolean
  reason?: string
  requiredPlan?: string
  featureName?: string
}

export interface LimitCheckResult {
  reached: boolean
  canCreate: boolean
  current: number
  limit: number | null
  percentage: number
  unit: string
  resourceName: string
}

export const planAccessService = {
  /**
   * Retrieves the current subscription for a given tenant.
   */
  async getTenantSubscription(tenantId: string): Promise<Subscription | null> {
    const db = mockStorage.getDb()
    const sub = db.subscriptions.find(s => s.tenantId === tenantId)
    return sub ? JSON.parse(JSON.stringify(sub)) : null
  },

  /**
   * Retrieves the active Plan object for a given tenant.
   * If tenant has no subscription, falls back to the default basic plan.
   */
  async getTenantPlan(tenantId: string): Promise<Plan | null> {
    const sub = await this.getTenantSubscription(tenantId)
    const db = mockStorage.getDb()

    if (sub) {
      const plan = db.plans.find(p => p.id === sub.planId)
      if (plan) return JSON.parse(JSON.stringify(plan))
    }

    // Fallback: look at company.planId
    const company = db.companies.find(c => c.id === tenantId)
    if (company?.planId) {
      const plan = db.plans.find(p => p.id === company.planId)
      if (plan) return JSON.parse(JSON.stringify(plan))
    }

    // Default to 'plan-basic' or first active plan
    const defaultPlan = db.plans.find(p => p.id === 'plan-basic') || db.plans[0]
    return defaultPlan ? JSON.parse(JSON.stringify(defaultPlan)) : null
  },

  /**
   * Checks whether a feature is enabled in the tenant's current plan.
   */
  async hasFeature(tenantId: string, featureKey: FeatureKey): Promise<boolean> {
    const plan = await this.getTenantPlan(tenantId)
    if (!plan) return false
    const entry = plan.features?.find(f => f.featureKey === featureKey)
    return entry ? entry.enabled : false
  },

  /**
   * Detailed check returning human friendly explanation and required plan recommendation.
   */
  async canUse(tenantId: string, featureKey: FeatureKey): Promise<CanUseResult> {
    const plan = await this.getTenantPlan(tenantId)
    const featureDef = FEATURE_CATALOG.find(f => f.key === featureKey)
    const featureName = featureDef?.name || featureKey

    if (!plan) {
      return {
        allowed: false,
        featureName,
        reason: 'Subscrição não encontrada para esta empresa.'
      }
    }

    const enabled = plan.features?.some(f => f.featureKey === featureKey && f.enabled)
    if (enabled) {
      return { allowed: true, featureName }
    }

    // Find which plan enables this feature
    const db = mockStorage.getDb()
    const plansWithFeature = db.plans
      .filter(p => p.active && p.features?.some(f => f.featureKey === featureKey && f.enabled))
      .sort((a, b) => a.price - b.price)

    const recommendedPlan = plansWithFeature[0]

    return {
      allowed: false,
      featureName,
      requiredPlan: recommendedPlan?.name || 'Pro',
      reason: `A funcionalidade "${featureName}" não está incluída no seu plano atual (${plan.name}). Atualize para o plano ${recommendedPlan?.name || 'superior'} para desbloquear.`
    }
  },

  /**
   * Gets the numerical limit for a given resource (null = unlimited).
   */
  async getLimit(tenantId: string, resourceKey: LimitKey): Promise<number | null> {
    const plan = await this.getTenantPlan(tenantId)
    if (!plan) return 0
    const entry = plan.limits?.find(l => l.resourceKey === resourceKey)
    return entry !== undefined ? entry.limit : null
  },

  /**
   * Counts real usage of resources inside the mock database.
   */
  async getCurrentUsage(tenantId: string, resourceKey: LimitKey, restaurantId?: string): Promise<number> {
    const db = mockStorage.getDb()

    switch (resourceKey) {
      case 'RESTAURANTS':
        return db.restaurants.filter(r => r.tenantId === tenantId).length

      case 'PRODUCTS': {
        if (restaurantId) {
          return db.products.filter(p => p.restaurantId === restaurantId).length
        }
        // Count across all restaurants belonging to tenant
        const tenantRestIds = db.restaurants.filter(r => r.tenantId === tenantId).map(r => r.id)
        return db.products.filter(p => tenantRestIds.includes(p.restaurantId)).length
      }

      case 'CATEGORIES': {
        if (restaurantId) {
          return db.categories.filter(c => c.restaurantId === restaurantId).length
        }
        const tenantRestIds = db.restaurants.filter(r => r.tenantId === tenantId).map(r => r.id)
        return db.categories.filter(c => tenantRestIds.includes(c.restaurantId)).length
      }

      case 'TABLES': {
        if (restaurantId) {
          return db.tables.filter(t => t.restaurantId === restaurantId).length
        }
        const tenantRestIds = db.restaurants.filter(r => r.tenantId === tenantId).map(r => r.id)
        return db.tables.filter(t => tenantRestIds.includes(t.restaurantId)).length
      }

      case 'STAFF':
        return db.staff.filter(s => s.tenantId === tenantId && s.isActive).length

      case 'ORDERS_PER_MONTH': {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const tenantRestIds = db.restaurants.filter(r => r.tenantId === tenantId).map(r => r.id)

        return db.orders.filter(o => {
          if (restaurantId && o.restaurantId !== restaurantId) return false
          if (!restaurantId && !tenantRestIds.includes(o.restaurantId)) return false
          return o.createdAt >= startOfMonth && o.status !== 'cancelled'
        }).length
      }

      default:
        return 0
    }
  },

  /**
   * Comprehensive check: returns whether the limit is reached, current usage, and percentage.
   */
  async isLimitReached(
    tenantId: string,
    resourceKey: LimitKey,
    restaurantId?: string
  ): Promise<LimitCheckResult> {
    const limit = await this.getLimit(tenantId, resourceKey)
    const current = await this.getCurrentUsage(tenantId, resourceKey, restaurantId)
    const cat = LIMIT_CATALOG.find(l => l.key === resourceKey)
    const resourceName = cat?.name || resourceKey
    const unit = cat?.unit || 'itens'

    if (limit === null) {
      // Unlimited
      return {
        reached: false,
        canCreate: true,
        current,
        limit: null,
        percentage: 0,
        unit,
        resourceName
      }
    }

    const reached = current >= limit
    const percentage = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 100

    return {
      reached,
      canCreate: !reached,
      current,
      limit,
      percentage,
      unit,
      resourceName
    }
  },

  /**
   * Throws or returns validation state for entity creation gating.
   */
  async assertCanCreate(
    tenantId: string,
    resourceKey: LimitKey,
    restaurantId?: string
  ): Promise<{ allowed: boolean; message?: string }> {
    const check = await this.isLimitReached(tenantId, resourceKey, restaurantId)
    if (check.reached) {
      return {
        allowed: false,
        message: `Limite atingido (${check.current} de ${check.limit} ${check.unit}). Faça upgrade do plano para adicionar mais ${check.resourceName.toLowerCase()}.`
      }
    }
    return { allowed: true }
  }
}

