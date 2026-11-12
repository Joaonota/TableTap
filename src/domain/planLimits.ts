import type { LimitKey, Plan, PlanLimit } from '@/types'
import { FEATURE_CATALOG, LIMIT_CATALOG, type LimitCatalogEntry } from '@/types/plan'

/**
 * Regras dos planos e limites (funções puras).
 * `null` = ilimitado. Usadas pelo repositório mock (que imita o backend),
 * pelas stores e pela UI.
 */

export interface LimitEvaluation {
  key: LimitKey
  resourceName: string
  unit: string
  scope: LimitCatalogEntry['scope']
  planName: string
  current: number
  /** null = ilimitado */
  limit: number | null
  unlimited: boolean
  /** Não é possível criar mais recursos. */
  reached: boolean
  /** Uso acima do limite (ex.: depois de um downgrade). */
  exceeded: boolean
  remaining: number | null
  percentage: number
}

export function getLimitEntry(key: LimitKey): LimitCatalogEntry {
  const entry = LIMIT_CATALOG.find(l => l.key === key)
  if (!entry) throw new Error(`Limite desconhecido: ${key}`)
  return entry
}

/** Valor do limite no plano; um limite em falta é tratado como ilimitado. */
export function planLimitValue(plan: Pick<Plan, 'limits'> | null, key: LimitKey): number | null {
  const found = plan?.limits?.find(l => l.resourceKey === key)
  return found === undefined ? null : found.limit
}

export function evaluateLimit(key: LimitKey, limit: number | null, current: number, planName: string): LimitEvaluation {
  const entry = getLimitEntry(key)
  const unlimited = limit === null
  const reached = !unlimited && current >= limit
  return {
    key,
    resourceName: entry.name,
    unit: entry.unit,
    scope: entry.scope,
    planName,
    current,
    limit,
    unlimited,
    reached,
    exceeded: !unlimited && current > limit,
    remaining: unlimited ? null : Math.max(0, limit - current),
    percentage: unlimited ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((current / limit) * 100))
  }
}

export function formatLimit(limit: number | null): string {
  return limit === null ? 'Ilimitado' : String(limit)
}

/** "3 de 3 mesas" / "8 mesas (ilimitado)" */
export function formatUsage(ev: Pick<LimitEvaluation, 'current' | 'limit' | 'unit'>): string {
  return ev.limit === null ? `${ev.current} ${ev.unit} (ilimitado)` : `${ev.current} de ${ev.limit} ${ev.unit}`
}

/** Mensagem clara mostrada quando o limite impede a criação. */
export function limitReachedMessage(ev: LimitEvaluation): string {
  const where = ev.scope === 'restaurant' ? ' neste restaurante' : ''
  return (
    `Limite do plano atingido: ${formatUsage(ev)}${where} (plano ${ev.planName}). ` +
    `Para adicionar mais ${ev.unit}, é necessário um plano com um limite superior.`
  )
}

// ------------------------------------------
// Validação do plano (editor do Super Admin)
// ------------------------------------------

export interface PlanDraft {
  name: string
  slug: string
  price: number
  limits: PlanLimit[]
}

export type PlanDraftErrors = Partial<Record<'name' | 'slug' | 'price' | `limit:${LimitKey}`, string>>

export function validatePlanDraft(draft: PlanDraft, otherPlans: Pick<Plan, 'id' | 'slug' | 'name'>[] = []): PlanDraftErrors {
  const errors: PlanDraftErrors = {}
  const name = draft.name.trim()
  if (!name) errors.name = 'Indique o nome do plano.'
  else if (otherPlans.some(p => p.name.trim().toLowerCase() === name.toLowerCase())) errors.name = 'Já existe um plano com este nome.'

  const slug = draft.slug.trim()
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.slug = 'Use apenas letras minúsculas, números e hífens.'
  else if (slug && otherPlans.some(p => p.slug === slug)) errors.slug = 'Já existe um plano com este identificador.'

  if (!Number.isFinite(draft.price) || draft.price < 0) errors.price = 'O preço deve ser 0 ou superior.'

  for (const l of draft.limits) {
    if (l.limit !== null && (!Number.isInteger(l.limit) || l.limit < 0)) {
      errors[`limit:${l.resourceKey}`] = 'Use um número inteiro igual ou superior a 0, ou "Ilimitado".'
    }
  }
  return errors
}

/** Garante que o plano tem todas as funcionalidades e limites do catálogo. */
export function normalizePlanEntitlements(plan: Pick<Plan, 'features' | 'limits'>): Pick<Plan, 'features' | 'limits'> {
  return {
    features: FEATURE_CATALOG.map(f => ({
      featureKey: f.key,
      enabled: plan.features?.find(x => x.featureKey === f.key)?.enabled ?? false
    })),
    limits: LIMIT_CATALOG.map(l => ({ resourceKey: l.key, limit: planLimitValue(plan, l.key) }))
  }
}
