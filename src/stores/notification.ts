import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notification, NotificationType } from '@/types'
import { notificationService } from '@/services'
import { useTenantStore } from './tenant'
import { useToastStore } from './toast'

export const useNotificationStore = defineStore('notification', () => {
  const tenantStore = useTenantStore()
  const toastStore = useToastStore()

  const notifications = ref<Notification[]>([])
  const isLoading = ref(false)

  const unreadCount = computed(() => {
    return notifications.value.filter(n => !n.readAt).length
  })

  const loadNotifications = async () => {
    if (!tenantStore.currentRestaurant) {
      notifications.value = []
      return
    }
    isLoading.value = true
    try {
      notifications.value = await notificationService.getNotifications(tenantStore.currentRestaurant.id)
    } finally {
      isLoading.value = false
    }
  }

  const createNotification = async (payload: {
    tenantId?: string
    restaurantId?: string
    type: NotificationType
    title: string
    message: string
    tableId?: string
    tableNumber?: string
    tableSessionId?: string
    orderId?: string
    serviceRequestId?: string
  }) => {
    const tenantId = payload.tenantId || tenantStore.currentRestaurant?.tenantId || 'tenant-1'
    const restaurantId = payload.restaurantId || tenantStore.currentRestaurant?.id || 'rest-1'

    const created = await notificationService.createNotification({
      tenantId,
      restaurantId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      tableId: payload.tableId,
      tableNumber: payload.tableNumber,
      tableSessionId: payload.tableSessionId,
      orderId: payload.orderId,
      serviceRequestId: payload.serviceRequestId
    })

    // If it belongs to current active restaurant, prepend to reactive list
    if (tenantStore.currentRestaurant?.id === restaurantId) {
      notifications.value.unshift(created)
    }

    // Display a gentle toast
    if (payload.type === 'table_occupied') {
      toastStore.info(payload.title, payload.message)
    } else if (payload.type === 'new_order' || payload.type === 'additional_order') {
      toastStore.success(payload.title, payload.message)
    } else if (payload.type === 'bill_requested' || payload.type === 'waiter_call') {
      toastStore.warning(payload.title, payload.message)
    }

    return created
  }

  const markAsRead = async (id: string) => {
    try {
      const updated = await notificationService.markAsRead(id)
      const index = notifications.value.findIndex(n => n.id === id)
      if (index !== -1) {
        notifications.value[index] = updated
      }
    } catch (e) {
      console.error('Erro ao marcar notificação como lida', e)
    }
  }

  const markAllAsRead = async () => {
    if (!tenantStore.currentRestaurant) return
    try {
      await notificationService.markAllAsRead(tenantStore.currentRestaurant.id)
      const now = new Date().toISOString()
      notifications.value.forEach(n => {
        if (!n.readAt) n.readAt = now
      })
      toastStore.info('Notificações', 'Todas as notificações foram marcadas como lidas.')
    } catch (e) {
      console.error('Erro ao marcar todas como lidas', e)
    }
  }

  return {
    notifications,
    isLoading,
    unreadCount,
    loadNotifications,
    createNotification,
    markAsRead,
    markAllAsRead
  }
})
