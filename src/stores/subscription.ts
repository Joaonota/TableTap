// src/stores/subscription.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FeatureKey, LimitKey, Plan, Subscription } from '@/types'
import { subscriptionService, planAccessService, type LimitCheckResult, type CanUseResult, type PlanChangeRequest } from '@/services'
import { LIMIT_CATALOG, type LimitScope } from '@/types/plan'
import { useTenantStore } from './tenant'
import { useToastStore } from './toast'

export interface ResourceUsageMetric {
  key: LimitKey
  name: string
  unit: string
  current: number
  limit: number | null
  percentage: number
  reached: boolean
  scope: LimitScope
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const tenantStore = useTenantStore()
  const toastStore = useToastStore()

  const currentSubscription = ref<Subscription | null>(null)
  const currentPlan = ref<Plan | null>(null)
  const availablePlans = ref<Plan[]>([])
  const usageMetrics = ref<Record<LimitKey, ResourceUsageMetric>>({} as any)
  const isLoading = ref(false)

  const activeTenantId = computed(() => {
    return tenantStore.currentCompany?.id || ''
  })

  const isTrial = computed(() => currentSubscription.value?.status === 'trial')
  const isActive = computed(() => currentSubscription.value?.status === 'active' || isTrial.value)

  const daysUntilRenewal = computed(() => {
    if (!currentSubscription.value?.renewalDate) return 0
    const renewal = new Date(currentSubscription.value.renewalDate).getTime()
    const now = Date.now()
    const diffDays = Math.ceil((renewal - now) / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  })

  const fetchSubscriptionData = async (tenantId?: string) => {
    const tid = tenantId || activeTenantId.value
    if (!tid) return

    isLoading.value = true
    try {
      const [sub, plan, allPlans] = await Promise.all([
        subscriptionService.getByTenant(tid),
        planAccessService.getTenantPlan(tid),
        subscriptionService.getAllPlans()
      ])

      currentSubscription.value = sub
      currentPlan.value = plan
      availablePlans.value = allPlans.filter(p => p.active)

      await Promise.all([refreshUsageMetrics(tid), loadPendingChangeRequest()])
    } catch (e: any) {
      console.error('Erro ao carregar dados de subscrição', e)
    } finally {
      isLoading.value = false
    }
  }

  const refreshUsageMetrics = async (tenantId?: string) => {
    const tid = tenantId || activeTenantId.value
    if (!tid) return

    const metrics: Partial<Record<LimitKey, ResourceUsageMetric>> = {}
    // Limites por restaurante: consumo do restaurante atualmente selecionado
    const restaurantId = tenantStore.currentRestaurant?.tenantId === tid ? tenantStore.currentRestaurant.id : undefined

    for (const { key, scope } of LIMIT_CATALOG) {
      const check: LimitCheckResult = await planAccessService.isLimitReached(tid, key, restaurantId)
      metrics[key] = {
        key,
        name: check.resourceName,
        unit: check.unit,
        current: check.current,
        limit: check.limit,
        percentage: check.percentage,
        reached: check.reached,
        scope
      }
    }

    usageMetrics.value = metrics as Record<LimitKey, ResourceUsageMetric>
  }

  const canUseFeature = async (key: FeatureKey): Promise<CanUseResult> => {
    return planAccessService.canUse(activeTenantId.value, key)
  }

  const hasFeature = (key: FeatureKey): boolean => {
    if (!currentPlan.value) return false
    const f = currentPlan.value.features?.find(feat => feat.featureKey === key)
    return f ? f.enabled : false
  }

  const checkResourceLimit = async (key: LimitKey, restaurantId?: string): Promise<LimitCheckResult> => {
    return planAccessService.isLimitReached(activeTenantId.value, key, restaurantId)
  }

  /** Pedido de alteração pendente (aplicado pela equipa TapMenu). */
  const pendingChangeRequest = ref<PlanChangeRequest | null>(null)

  const loadPendingChangeRequest = async () => {
    if (!activeTenantId.value) return
    try {
      const requests = await subscriptionService.getPlanChangeRequests(activeTenantId.value)
      pendingChangeRequest.value = requests.find(r => r.status === 'pending') ?? null
    } catch {
      pendingChangeRequest.value = null
    }
  }

  /**
   * Não há pagamento online: o dono da empresa pede a alteração e a equipa
   * TapMenu aplica-a (Super Admin → Subscrições). Os novos limites e
   * funcionalidades ficam ativos quando o pedido é aprovado.
   */
  const requestPlanChange = async (targetPlanId: string, note?: string): Promise<boolean> => {
    isLoading.value = true
    try {
      pendingChangeRequest.value = await subscriptionService.requestPlanChange(targetPlanId, note)
      const plan = availablePlans.value.find(p => p.id === targetPlanId)
      toastStore.success('Pedido enviado', `A equipa TapMenu foi notificada do seu pedido para o plano "${plan?.name ?? ''}".`)
      return true
    } catch (e) {
      toastStore.error('Não foi possível enviar o pedido', (e as Error).message)
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    currentSubscription,
    currentPlan,
    availablePlans,
    usageMetrics,
    isLoading,
    isTrial,
    isActive,
    daysUntilRenewal,
    fetchSubscriptionData,
    refreshUsageMetrics,
    canUseFeature,
    hasFeature,
    checkResourceLimit,
    pendingChangeRequest,
    loadPendingChangeRequest,
    requestPlanChange
  }
})

