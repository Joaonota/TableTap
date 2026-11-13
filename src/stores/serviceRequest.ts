import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Restaurant, ServiceRequest, ServiceRequestStatus, ServiceRequestType } from '@/types'
import { serviceRequestService, publicTableService, subscribeToRealtime } from '@/services'
import { useTenantStore } from './tenant'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'

const serviceTypeLabels: Record<ServiceRequestType, string> = {
  waiter_call: 'Chamada de Garçom',
  water: 'Pedido de Água',
  cutlery: 'Pedido de Talheres',
  bill: 'Pedido da Conta',
  general_help: 'Assistência Geral'
}

export const useServiceRequestStore = defineStore('serviceRequest', () => {
  const tenantStore = useTenantStore()
  const authStore = useAuthStore()
  const toastStore = useToastStore()

  const requests = ref<ServiceRequest[]>([])
  const isLoading = ref(false)

  const loadRequests = async () => {
    if (!tenantStore.currentRestaurant) {
      requests.value = []
      return
    }
    isLoading.value = true
    try {
      requests.value = await serviceRequestService.getRequests(tenantStore.currentRestaurant.id)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Pedido de atendimento feito pelo cliente no menu público.
   * O restaurante vem da URL da mesa (não do contexto do painel admin).
   */
  const createCustomerRequest = async (
    restaurant: Pick<Restaurant, 'id' | 'tenantId'>,
    tableId: string,
    _tableNumber: string,
    type: ServiceRequestType,
    notes?: string,
    tableSessionId?: string,
    customerName?: string,
    participantToken?: string
  ) => {
    try {
      // O servidor evita duplicados e notifica a equipa.
      const { request, alreadyExisted } = await publicTableService.createServiceRequest({
        tableId,
        type,
        sessionId: tableSessionId,
        participantToken,
        customerName,
        notes
      })
      if (alreadyExisted) {
        toastStore.info(
          'Solicitação já registada',
          `Já existe um pedido de "${serviceTypeLabels[type]}" em andamento para a sua mesa. A nossa equipa já está a caminho!`
        )
      } else {
        toastStore.success('Solicitação enviada', 'A nossa equipa foi notificada e já está a caminho da sua mesa!')
      }
      if (tenantStore.currentRestaurant?.id === restaurant.id && !alreadyExisted) requests.value.unshift(request)
      return request
    } catch (e) {
      toastStore.error('Erro ao enviar solicitação', (e as Error).message)
      throw e
    }
  }

  /** Chamadas novas e alterações chegam em tempo real. */
  const subscribeRealtime = () => {
    const restaurantId = tenantStore.currentRestaurant?.id
    if (!restaurantId) return () => {}
    return subscribeToRealtime('service_requests', restaurantId, async () => {
      if (tenantStore.currentRestaurant?.id !== restaurantId) return
      requests.value = await serviceRequestService.getRequests(restaurantId)
    })
  }

  const updateRequestStatus = async (requestId: string, status: ServiceRequestStatus) => {
    try {
      const user = authStore.currentUser
      const updated = await serviceRequestService.updateStatus(
        requestId,
        status,
        user?.id,
        user?.name
      )
      const index = requests.value.findIndex(r => r.id === requestId)
      if (index !== -1) {
        requests.value[index] = updated
      }

      const statusMsg = status === 'completed' ? 'Concluído' : status === 'in_progress' ? 'Em atendimento' : 'Cancelado'
      toastStore.success('Atendimento Atualizado', `Mesa ${updated.tableNumber} — ${statusMsg}`)
      return updated
    } catch (e) {
      toastStore.error('Erro ao atualizar atendimento', (e as Error).message)
    }
  }

  return {
    requests,
    isLoading,
    loadRequests,
    subscribeRealtime,
    createCustomerRequest,
    updateRequestStatus
  }
})
