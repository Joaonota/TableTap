// src/stores/platform.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PlatformAuditLog, PlatformConfig, Subscription } from '@/types'
import { subscriptionService, auditService, platformConfigService, tenantService } from '@/services'
import { useToastStore } from './toast'

export const usePlatformStore = defineStore('platform', () => {
  const toastStore = useToastStore()

  const subscriptions = ref<Subscription[]>([])
  const auditLogs = ref<PlatformAuditLog[]>([])
  const config = ref<PlatformConfig | null>(null)
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
      const [subs, logs, cfg, companies] = await Promise.all([
        subscriptionService.getAllSubscriptions(),
        auditService.getLogs(),
        platformConfigService.getConfig(),
        tenantService.getAllCompanies()
      ])

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

  const updateSubscription = async (id: string, updates: Partial<Subscription>): Promise<Subscription | null> => {
    isLoading.value = true
    try {
      const updated = await subscriptionService.updateSubscription(id, updates)
      const idx = subscriptions.value.findIndex(s => s.id === id)
      if (idx !== -1) subscriptions.value[idx] = updated

      // Log action
      await auditService.log({
        tenantId: updated.tenantId,
        userId: 'user-super-1',
        userName: 'Super Administrador',
        action: 'subscription.updated',
        resource: `Subscription: ${updated.id}`,
        details: `Subscrição atualizada (estado: ${updated.status}, plano: ${updated.planName}).`
      })

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

      await auditService.log({
        userId: 'user-super-1',
        userName: 'Super Administrador',
        action: 'platform.config_updated',
        resource: 'PlatformConfig',
        details: 'Configurações globais do sistema foram atualizadas.'
      })

      toastStore.success('Configurações Atualizadas', 'As definições globais da plataforma foram guardadas.')
      return true
    } catch (e: any) {
      toastStore.error('Erro ao atualizar configurações', e.message)
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
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

