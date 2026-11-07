// src/stores/subscription.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FeatureKey, LimitKey, Plan, Subscription } from '@/types'
import { subscriptionService, planAccessService, type LimitCheckResult, type CanUseResult } from '@/services'
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
    return tenantStore.currentCompany?.id || 'tenant-1'
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

      // Refresh usage metrics
      await refreshUsageMetrics(tid)
    } catch (e: any) {
      console.error('Erro ao carregar dados de subscrição', e)
    } finally {
      isLoading.value = false
    }
  }

  const refreshUsageMetrics = async (tenantId?: string) => {
    const tid = tenantId || activeTenantId.value
    if (!tid) return

    const keys: LimitKey[] = ['RESTAURANTS', 'PRODUCTS', 'CATEGORIES', 'TABLES', 'STAFF', 'ORDERS_PER_MONTH']
    const metrics: Partial<Record<LimitKey, ResourceUsageMetric>> = {}

    for (const key of keys) {
      const check: LimitCheckResult = await planAccessService.isLimitReached(tid, key)
      metrics[key] = {
        key,
        name: check.resourceName,
        unit: check.unit,
        current: check.current,
        limit: check.limit,
        percentage: check.percentage,
        reached: check.reached
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

  const upgradePlan = async (targetPlanId: string, performedBy?: string): Promise<boolean> => {
    isLoading.value = true
    try {
      const res = await subscriptionService.upgradePlan(
        activeTenantId.value,
        targetPlanId,
        performedBy || tenantStore.currentCompany?.name || 'Administrador'
      )
      currentSubscription.value = res.subscription
      currentPlan.value = res.plan
      await refreshUsageMetrics()
      toastStore.success('Plano Atualizado com Sucesso!', `O seu plano é agora "${res.plan.name}". Todas as novas funcionalidades foram ativadas.`)
      return true
    } catch (e: any) {
      toastStore.error('Erro ao atualizar plano', e.message)
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
    upgradePlan
  }
})

