// src/stores/platform.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PlatformAuditLog, PlatformConfig, Subscription } from '@/types'
import type { PlanChangeRequest } from '@/services'
import { subscriptionService, auditService, platformConfigService, tenantService } from '@/services'
import { useToastStore } from './toast'

export const usePlatformStore = defineStore('platform', () => {
  const toastStore = useToastStore()

  const subscriptions = ref<Subscription[]>([])
  const auditLogs = ref<PlatformAuditLog[]>([])
  const config = ref<PlatformConfig | null>(null)
  /** Pedidos de alteração de plano feitos pelos restaurantes. */
  const planChangeRequests = ref<PlanChangeRequest[]>([])
  const pendingPlanChangeRequests = computed(() => planChangeRequests.value.filter(r => r.status === 'pending'))
  const totalCompaniesCount = ref(0)
  const isLoading = ref(false)

  const mrr = computed(() => {
    return subscriptions.value
      .filter(s => s.status === 'active')
      .reduce((acc, s) => acc + (s.monthlyPrice || 0), 0)
  })

  const arr = computed(() => mrr.value * 12)

  const activeSubscriptionsCount = computed(() => {
    return subscriptions.value.filter(s => s.status === 'active').length
  })

  const trialSubscriptionsCount = computed(() => {
    return subscriptions.value.filter(s => s.status === 'trial').length
  })

  const planDistribution = computed(() => {
    const counts: Record<string, number> = {}
    subscriptions.value.forEach(s => {
      counts[s.planName] = (counts[s.planName] || 0) + 1
    })
    return counts
  })

  const fetchPlatformData = async () => {
    isLoading.value = true
    try {
      const [subs, logs, cfg, companies, requests] = await Promise.all([
        subscriptionService.getAllSubscriptions(),
        auditService.getLogs(),
        platformConfigService.getConfig(),
        tenantService.getAllCompanies(),
        subscriptionService.getPlanChangeRequests()
      ])
      planChangeRequests.value = requests

      subscriptions.value = subs
      auditLogs.value = logs
      config.value = cfg
      totalCompaniesCount.value = companies.length
    } catch (e: any) {
      toastStore.error('Erro ao carregar dados da plataforma', e.message)
    } finally {
      isLoading.value = false
    }
  }

  /** O histórico e a auditoria da alteração são registados pela base de dados. */
  const updateSubscription = async (
    id: string,
    updates: Partial<Pick<Subscription, 'planId' | 'status' | 'renewalDate' | 'isAutoRenew' | 'startDate'>>
  ): Promise<Subscription | null> => {
    isLoading.value = true
    try {
      const updated = await subscriptionService.updateSubscription(id, updates)
      const idx = subscriptions.value.findIndex(s => s.id === id)
      if (idx !== -1) subscriptions.value[idx] = updated
      planChangeRequests.value = await subscriptionService.getPlanChangeRequests()


      toastStore.success('Subscrição Atualizada', `A subscrição de ${updated.companyName} foi atualizada.`)
      return updated
    } catch (e: any) {
      toastStore.error('Erro ao atualizar subscrição', e.message)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateConfig = async (updates: Partial<PlatformConfig>): Promise<boolean> => {
    isLoading.value = true
    try {
      const saved = await platformConfigService.updateConfig(updates)
      config.value = saved


      toastStore.success('Configurações Atualizadas', 'As definições globais da plataforma foram guardadas.')
      return true
    } catch (e: any) {
      toastStore.error('Erro ao atualizar configurações', e.message)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /** Nota administrativa no histórico da subscrição (persistida). */
  const addSubscriptionNote = async (id: string, note: string) => {
    try {
      const updated = await subscriptionService.addHistoryEvent(id, { event: 'note', note, performedBy: '' })
      const idx = subscriptions.value.findIndex(s => s.id === id)
      if (idx !== -1) subscriptions.value[idx] = updated
    } catch (e) {
      toastStore.error('Erro ao guardar a nota', (e as Error).message)
    }
  }

  const rejectPlanChangeRequest = async (id: string) => {
    try {
      await subscriptionService.resolvePlanChangeRequest(id, 'rejected')
      planChangeRequests.value = await subscriptionService.getPlanChangeRequests()
      toastStore.info('Pedido recusado')
    } catch (e) {
      toastStore.error('Erro ao recusar pedido', (e as Error).message)
    }
  }

  return {
    planChangeRequests,
    pendingPlanChangeRequests,
    rejectPlanChangeRequest,
    addSubscriptionNote,
    subscriptions,
    auditLogs,
    config,
    totalCompaniesCount,
    isLoading,
    mrr,
    arr,
    activeSubscriptionsCount,
    trialSubscriptionsCount,
    planDistribution,
    fetchPlatformData,
    updateSubscription,
    updateConfig
  }
})

