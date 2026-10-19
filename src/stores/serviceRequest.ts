import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from '@/types'
import { serviceRequestService } from '@/services'
import { useTenantStore } from './tenant'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'

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

  const createCustomerRequest = async (tableId: string, tableNumber: string, type: ServiceRequestType, notes?: string) => {
    if (!tenantStore.currentRestaurant) return
    try {
      const created = await serviceRequestService.createRequest({
        tenantId: tenantStore.currentRestaurant.tenantId,
        restaurantId: tenantStore.currentRestaurant.id,
        tableId,
        tableNumber,
        type,
        status: 'new',
        notes
      })
      requests.value.unshift(created)
      toastStore.success('Solicitação enviada', 'A nossa equipa foi notificada e já está a caminho da sua mesa!')
      return created
    } catch (e) {
      toastStore.error('Erro ao enviar solicitação', (e as Error).message)
      throw e
    }
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
      toastStore.success('Atendimento Atualizado', `Mesa ${updated.tableNumber} - ${status.toUpperCase()}`)
      return updated
    } catch (e) {
      toastStore.error('Erro ao atualizar atendimento', (e as Error).message)
    }
  }

  return {
    requests,
    isLoading,
    loadRequests,
    createCustomerRequest,
    updateRequestStatus
  }
})
