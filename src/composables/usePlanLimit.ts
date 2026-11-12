import { computed, ref, watch } from 'vue'
import type { LimitKey } from '@/types'
import { planAccessService, type LimitEvaluation } from '@/services/planAccessService'
import { limitReachedMessage } from '@/domain/planLimits'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'

/**
 * Estado de um limite do plano para a empresa/restaurante atual.
 *
 * Uso:
 *   const tablesLimit = usePlanLimit('TABLES')
 *   <AppButton :disabled="tablesLimit.isReached.value" @click="tablesLimit.guard() && openCreate()">
 *   // depois de criar/remover: tablesLimit.refresh()
 *
 * O repositório também recusa a criação (como o backend fará); este
 * composable serve para avisar antes e desativar o botão.
 */
export function usePlanLimit(key: LimitKey) {
  const tenantStore = useTenantStore()
  const toastStore = useToastStore()

  const evaluation = ref<LimitEvaluation | null>(null)
  const isLoading = ref(false)

  const refresh = async () => {
    const tenantId = tenantStore.currentRestaurant?.tenantId ?? tenantStore.currentCompany?.id
    if (!tenantId) {
      evaluation.value = null
      return
    }
    isLoading.value = true
    try {
      evaluation.value = await planAccessService.checkLimit(tenantId, key, tenantStore.currentRestaurant?.id)
    } finally {
      isLoading.value = false
    }
  }

  const isReached = computed(() => !!evaluation.value?.reached)
  const message = computed(() => (evaluation.value?.reached ? limitReachedMessage(evaluation.value) : ''))

  /** Devolve `false` (e explica porquê) quando não é possível criar mais. */
  const guard = (): boolean => {
    if (!evaluation.value?.reached) return true
    toastStore.warning('Limite do plano atingido', message.value)
    return false
  }

  watch(() => [tenantStore.currentRestaurant?.id, tenantStore.currentCompany?.id], refresh, { immediate: true })

  return { evaluation, isLoading, isReached, message, refresh, guard }
}
