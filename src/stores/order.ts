import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order, OrderStatus, PaymentStatus } from '@/types'
import { orderService, subscribeToRealtime } from '@/services'
import { orderStatusLabel } from '@/domain/statusLabels'
import { useTenantStore } from './tenant'
import { useToastStore } from './toast'

export const useOrderStore = defineStore('order', () => {
  const tenantStore = useTenantStore()
  const toastStore = useToastStore()

  const orders = ref<Order[]>([])
  const isLoading = ref(false)

  // Filters
  const searchFilter = ref('')
  const statusFilter = ref<string>('all')
  const tableFilter = ref<string>('all')

  const loadOrders = async () => {
    if (!tenantStore.currentRestaurant) {
      orders.value = []
      return
    }
    isLoading.value = true
    try {
      orders.value = await orderService.getOrders(tenantStore.currentRestaurant.id)
    } finally {
      isLoading.value = false
    }
  }

  const filteredOrders = computed(() => {
    return orders.value.filter(order => {
      // Search
      const matchesSearch =
        !searchFilter.value ||
        order.orderCode.toLowerCase().includes(searchFilter.value.toLowerCase()) ||
        (order.tableNumber && order.tableNumber.toLowerCase().includes(searchFilter.value.toLowerCase())) ||
        (order.customerName && order.customerName.toLowerCase().includes(searchFilter.value.toLowerCase()))

      // Status
      const matchesStatus =
        statusFilter.value === 'all' || order.status === statusFilter.value

      // Table
      const matchesTable =
        tableFilter.value === 'all' || order.tableNumber === tableFilter.value

      return matchesSearch && matchesStatus && matchesTable
    })
  })

  // KDS Orders (Only active in kitchen/bar: received, confirmed, preparing, ready)
  const kdsOrders = computed(() => {
    return orders.value.filter(o =>
      ['received', 'confirmed', 'preparing', 'ready'].includes(o.status)
    )
  })

  /** `_updatedBy` mantido por compatibilidade: o autor é registado pela base de dados. */
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, _updatedBy?: string, note?: string) => {
    try {
      const updated = await orderService.updateOrderStatus(orderId, newStatus, note)
      const index = orders.value.findIndex(o => o.id === orderId)
      if (index !== -1) {
        orders.value[index] = updated
      }
      toastStore.success(`Pedido ${updated.orderCode} atualizado`, `Estado: ${orderStatusLabel(newStatus)}`)
      return updated
    } catch (e) {
      toastStore.error('Erro ao atualizar pedido', (e as Error).message)
      throw e
    }
  }

  const updatePaymentStatus = async (orderId: string, status: PaymentStatus) => {
    try {
      const updated = await orderService.updatePaymentStatus(orderId, status)
      const index = orders.value.findIndex(o => o.id === orderId)
      if (index !== -1) {
        orders.value[index] = updated
      }
      toastStore.success(`Pagamento do Pedido ${updated.orderCode} atualizado`, `Novo estado: ${status}`)
      return updated
    } catch (e) {
      toastStore.error('Erro ao atualizar pagamento', (e as Error).message)
      throw e
    }
  }

  /**
   * Pedidos novos e alterações chegam em tempo real (Supabase Realtime).
   * Devolve a função para parar de escutar.
   */
  const subscribeRealtime = () => {
    const restaurantId = tenantStore.currentRestaurant?.id
    if (!restaurantId) return () => {}
    return subscribeToRealtime('orders', restaurantId, async () => {
      if (tenantStore.currentRestaurant?.id !== restaurantId) return
      orders.value = await orderService.getOrders(restaurantId)
    })
  }

  return {
    orders,
    isLoading,
    searchFilter,
    statusFilter,
    tableFilter,
    filteredOrders,
    kdsOrders,
    loadOrders,
    updateOrderStatus,
    updatePaymentStatus,
    subscribeRealtime
  }
})
