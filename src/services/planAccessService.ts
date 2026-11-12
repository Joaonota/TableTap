// src/services/planAccessService.ts
import { repositories } from '@/repositories'
import type { FeatureKey, LimitKey, Plan, Subscription } from '@/types'
import { FEATURE_CATALOG } from '@/types/plan'
import {
  evaluateLimit,
  getLimitEntry,
  limitReachedMessage,
  planLimitValue,
  type LimitEvaluation
} from '@/domain/planLimits'

/**
 * Acesso às funcionalidades e limites do plano de cada empresa.
 * Só depende das interfaces dos repositórios — ao ligar a API, nada aqui
 * nem na UI precisa de mudar.
 */

export type { LimitEvaluation }

export interface CanUseResult {
  allowed: boolean
  reason?: string
  requiredPlan?: string
  featureName?: string
}

/** Formato legado usado por "Meu Plano" e pelo dashboard. */
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
  async getTenantSubscription(tenantId: string): Promise<Subscription | null> {
    return repositories.subscriptions.getByTenant(tenantId)
  },

  async getTenantPlan(tenantId: string): Promise<Plan | null> {
    return repositories.planAccess.getTenantPlan(tenantId)
  },

  async hasFeature(tenantId: string, featureKey: FeatureKey): Promise<boolean> {
    const plan = await this.getTenantPlan(tenantId)
    return !!plan?.features?.some(f => f.featureKey === featureKey && f.enabled)
  },

  async canUse(tenantId: string, featureKey: FeatureKey): Promise<CanUseResult> {
    const plan = await this.getTenantPlan(tenantId)
    const featureName = FEATURE_CATALOG.find(f => f.key === featureKey)?.name || featureKey

    if (!plan) return { allowed: false, featureName, reason: 'Subscrição não encontrada para esta empresa.' }
    if (plan.features?.some(f => f.featureKey === featureKey && f.enabled)) return { allowed: true, featureName }

    const recommended = (await repositories.plans.getAll())
      .filter(p => p.active && p.features?.some(f => f.featureKey === featureKey && f.enabled))
      .sort((a, b) => a.price - b.price)[0]

    return {
      allowed: false,
      featureName,
      requiredPlan: recommended?.name,
      reason: `A funcionalidade "${featureName}" não está incluída no seu plano atual (${plan.name}).${recommended ? ` Está disponível no plano ${recommended.name}.` : ''}`
    }
  },

  /** null = ilimitado. */
  async getLimit(tenantId: string, resourceKey: LimitKey): Promise<number | null> {
    return planLimitValue(await this.getTenantPlan(tenantId), resourceKey)
  },

  async getCurrentUsage(tenantId: string, resourceKey: LimitKey, restaurantId?: string): Promise<number> {
    return repositories.planAccess.countUsage(tenantId, resourceKey, restaurantId)
  },

  /**
   * Avaliação completa de um limite. Para limites por restaurante, indique o
   * restaurante; para limites da empresa, o restaurante é ignorado.
   */
  async checkLimit(tenantId: string, resourceKey: LimitKey, restaurantId?: string): Promise<LimitEvaluation> {
    const scopedRestaurant = getLimitEntry(resourceKey).scope === 'restaurant' ? restaurantId : undefined
    const [plan, current] = await Promise.all([
      this.getTenantPlan(tenantId),
      this.getCurrentUsage(tenantId, resourceKey, scopedRestaurant)
    ])
    return evaluateLimit(resourceKey, planLimitValue(plan, resourceKey), current, plan?.name ?? 'sem plano')
  },

  async isLimitReached(tenantId: string, resourceKey: LimitKey, restaurantId?: string): Promise<LimitCheckResult> {
    const ev = await this.checkLimit(tenantId, resourceKey, restaurantId)
    return {
      reached: ev.reached,
      canCreate: !ev.reached,
      current: ev.current,
      limit: ev.limit,
      percentage: ev.percentage,
      unit: ev.unit,
      resourceName: ev.resourceName
    }
  },

  async assertCanCreate(tenantId: string, resourceKey: LimitKey, restaurantId?: string): Promise<{ allowed: boolean; message?: string }> {
    const ev = await this.checkLimit(tenantId, resourceKey, restaurantId)
    return ev.reached ? { allowed: false, message: limitReachedMessage(ev) } : { allowed: true }
  }
}
