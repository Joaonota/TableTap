import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from '@/types'
import { serviceRequestService, tableService } from '@/services'
import { useTenantStore } from './tenant'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'
import { useNotificationStore } from './notification'

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
  const notificationStore = useNotificationStore()

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

  const createCustomerRequest = async (
    tableId: string,
    tableNumber: string,
    type: ServiceRequestType,
    notes?: string,
    tableSessionId?: string,
    customerName?: string
  ) => {
    if (!tenantStore.currentRestaurant) return

    // Prevent duplicate active requests of the same type on the same table
    const existingActive = requests.value.find(
      r => r.tableId === tableId && r.type === type && (r.status === 'new' || r.status === 'in_progress')
    )
    if (existingActive) {
      toastStore.info(
        'Solicitação já registada',
        `Já existe um pedido de "${serviceTypeLabels[type]}" em andamento para a sua mesa. A nossa equipa já está a caminho!`
      )
      return existingActive
    }

    try {
      const typeLabel = serviceTypeLabels[type] || 'Atendimento'
      const created = await serviceRequestService.createRequest({
        tenantId: tenantStore.currentRestaurant.tenantId,
        restaurantId: tenantStore.currentRestaurant.id,
        tableId,
        tableNumber,
        tableSessionId,
        customerName: customerName || 'Cliente',
        type,
        status: 'new',
        notes
      })
      requests.value.unshift(created)

      // Update table status if appropriate
      if (type === 'bill') {
        await tableService.updateTable(tableId, { status: 'waiting_bill' })
      } else {
        await tableService.updateTable(tableId, { status: 'waiting_service' })
      }

      // Create counter notification
      await notificationStore.createNotification({
        tenantId: tenantStore.currentRestaurant.tenantId,
        restaurantId: tenantStore.currentRestaurant.id,
        type: type === 'bill' ? 'bill_requested' : type === 'waiter_call' ? 'waiter_call' : 'service_request',
        title: type === 'bill' ? 'Pedido de Conta' : type === 'waiter_call' ? 'Cliente solicita atendimento' : `Solicitação: ${typeLabel}`,
        message: `Mesa ${tableNumber}${customerName ? ` (${customerName})` : ''} solicitou ${typeLabel.toLowerCase()}.${notes ? ` Nota: "${notes}"` : ''}`,
        tableId,
        tableNumber,
        tableSessionId,
        serviceRequestId: created.id
      })

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

      // Check if table has any other pending requests
      const otherActive = requests.value.some(
        r => r.tableId === updated.tableId && r.id !== updated.id && (r.status === 'new' || r.status === 'in_progress')
      )
      if (!otherActive && (status === 'completed' || status === 'cancelled')) {
        // Return table to occupied or has_order
        const tbl = await tableService.getTableById(updated.tableId)
        if (tbl && (tbl.status === 'waiting_service' || tbl.status === 'waiting_bill')) {
          const nextStatus = tbl.activeOrderId ? 'has_order' : tbl.activeSessionId ? 'occupied' : 'free'
          await tableService.updateTable(updated.tableId, { status: nextStatus })
        }
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
    createCustomerRequest,
    updateRequestStatus
  }
})
