import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notification } from '@/types'
import { notificationService, subscribeToRealtime } from '@/services'
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

  /**
   * As notificações são criadas pelo servidor (pedidos, mesas, chamadas).
   * Em tempo real, recarrega a lista e mostra um aviso para as novas.
   */
  const subscribeRealtime = () => {
    const restaurantId = tenantStore.currentRestaurant?.id
    if (!restaurantId) return () => {}
    return subscribeToRealtime('notifications', restaurantId, async () => {
      if (tenantStore.currentRestaurant?.id !== restaurantId) return
      const known = new Set(notifications.value.map(n => n.id))
      const latest = await notificationService.getNotifications(restaurantId)
      notifications.value = latest
      for (const n of latest.filter(n => !known.has(n.id) && !n.readAt).slice(0, 3)) {
        if (n.type === 'new_order' || n.type === 'additional_order') toastStore.success(n.title, n.message)
        else if (n.type === 'bill_requested' || n.type === 'waiter_call') toastStore.warning(n.title, n.message)
        else toastStore.info(n.title, n.message)
      }
    })
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
    subscribeRealtime,
    markAsRead,
    markAllAsRead
  }
})
