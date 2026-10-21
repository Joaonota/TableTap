<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notification'
import type { Notification, NotificationType } from '@/types'
import {
  BellRing,
  Check,
  CheckCheck,
  Users,
  UtensilsCrossed,
  Receipt,
  HelpCircle,
  ExternalLink,
  Clock
} from 'lucide-vue-next'

const router = useRouter()
const notificationStore = useNotificationStore()

const isOpen = ref(false)
const filterType = ref<'all' | 'tables' | 'orders' | 'service'>('all')

const dropdownRef = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const handleClickOutside = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const filteredNotifications = computed(() => {
  return notificationStore.notifications.filter(n => {
    if (filterType.value === 'all') return true
    if (filterType.value === 'tables') return n.type === 'table_occupied'
    if (filterType.value === 'orders') return n.type === 'new_order' || n.type === 'additional_order'
    if (filterType.value === 'service') return n.type === 'waiter_call' || n.type === 'bill_requested' || n.type === 'service_request'
    return true
  })
})

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'table_occupied':
      return { component: Users, color: 'text-primary' }
    case 'new_order':
    case 'additional_order':
      return { component: UtensilsCrossed, color: 'text-success' }
    case 'bill_requested':
      return { component: Receipt, color: 'text-warning' }
    case 'waiter_call':
    case 'service_request':
      return { component: BellRing, color: 'text-danger' }
    default:
      return { component: HelpCircle, color: 'text-muted' }
  }
}

const handleNotificationClick = async (notif: Notification) => {
  if (!notif.readAt) {
    await notificationStore.markAsRead(notif.id)
  }
  isOpen.value = false

  if (notif.type === 'table_occupied' || notif.type === 'bill_requested') {
    router.push('/app/mesas')
  } else if (notif.type === 'new_order' || notif.type === 'additional_order') {
    router.push('/app/pedidos')
  } else if (notif.type === 'waiter_call' || notif.type === 'service_request') {
    router.push('/app/atendimento')
  }
}
</script>

<template>
  <div ref="dropdownRef" class="notif-dropdown-wrapper">
    <button
      type="button"
      class="topbar-icon-btn notif-trigger"
      :class="{ 'is-active': isOpen }"
      title="Notificações do Balcão"
      aria-label="Abrir notificações"
      @click="toggleDropdown"
    >
      <BellRing :size="18" />
      <span v-if="notificationStore.unreadCount > 0" class="badge-counter">
        {{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}
      </span>
    </button>

    <div v-if="isOpen" class="notif-popover">
      <div class="popover-header">
        <div class="header-title-box">
          <h4 class="popover-title">Notificações</h4>
          <span v-if="notificationStore.unreadCount > 0" class="unread-pill">
            {{ notificationStore.unreadCount }} novas
          </span>
        </div>

        <button
          v-if="notificationStore.unreadCount > 0"
          type="button"
          class="mark-all-btn"
          @click="notificationStore.markAllAsRead"
        >
          <CheckCheck :size="14" />
          <span>Marcar todas como lidas</span>
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <button
          type="button"
          class="filter-tab"
          :class="{ 'is-active': filterType === 'all' }"
          @click="filterType = 'all'"
        >
          Todas
        </button>
        <button
          type="button"
          class="filter-tab"
          :class="{ 'is-active': filterType === 'tables' }"
          @click="filterType = 'tables'"
        >
          Mesas
        </button>
        <button
          type="button"
          class="filter-tab"
          :class="{ 'is-active': filterType === 'orders' }"
          @click="filterType = 'orders'"
        >
          Pedidos
        </button>
        <button
          type="button"
          class="filter-tab"
          :class="{ 'is-active': filterType === 'service' }"
          @click="filterType = 'service'"
        >
          Atendimento
        </button>
      </div>

      <!-- Notifications List -->
      <div class="popover-list">
        <div v-if="filteredNotifications.length === 0" class="empty-notifs">
          <BellRing :size="28" class="empty-icon" />
          <p>Nenhuma notificação nesta categoria.</p>
        </div>

        <div
          v-for="notif in filteredNotifications"
          :key="notif.id"
          class="notif-item"
          :class="{ 'is-unread': !notif.readAt }"
          @click="handleNotificationClick(notif)"
        >
          <div class="notif-icon-col" :class="getNotificationIcon(notif.type).color">
            <component :is="getNotificationIcon(notif.type).component" :size="18" />
          </div>

          <div class="notif-content-col">
            <div class="notif-title-row">
              <span class="notif-title">{{ notif.title }}</span>
              <span class="notif-time">
                {{ new Date(notif.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
            </div>
            <p class="notif-msg">{{ notif.message }}</p>
          </div>

          <div v-if="!notif.readAt" class="unread-dot"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-dropdown-wrapper {
  position: relative;
}

.topbar-icon-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: #ffffff;
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all var(--transition-fast);
}

.topbar-icon-btn:hover,
.topbar-icon-btn.is-active {
  background-color: var(--color-slate-100);
  border-color: var(--color-primary-400);
}

.badge-counter {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: var(--color-danger-500);
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 800;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid #ffffff;
}

/* Popover */
.notif-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  background-color: #ffffff;
  border-radius: var(--radius-xl);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border-color);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 480px) {
  .notif-popover {
    width: calc(100vw - 2rem);
    right: -60px;
  }
}

.popover-header {
  padding: 0.875rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  background-color: #f8fafc;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.popover-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--text-main);
}

.unread-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  background-color: #dbeafe;
  color: #1e40af;
  padding: 0.125rem 0.45rem;
  border-radius: var(--radius-full);
}

.mark-all-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: var(--color-primary-700);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.mark-all-btn:hover {
  text-decoration: underline;
}

.filters-bar {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  background-color: #ffffff;
}

.filter-tab {
  flex: 1;
  padding: 0.35rem;
  border: none;
  background: none;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: center;
  transition: all var(--transition-fast);
}

.filter-tab:hover {
  background-color: var(--color-slate-100);
  color: var(--text-main);
}

.filter-tab.is-active {
  background-color: #eff6ff;
  color: var(--color-primary-800);
  font-weight: 700;
}

.popover-list {
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.empty-notifs {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  margin: 0 auto 0.5rem auto;
  opacity: 0.4;
}

.empty-notifs p {
  margin: 0;
  font-size: 0.8125rem;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  position: relative;
}

.notif-item:hover {
  background-color: #f8fafc;
}

.notif-item.is-unread {
  background-color: #f0f7ff;
}

.notif-icon-col {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: #ffffff;
  border: 1px solid var(--border-color);
}

.text-primary {
  color: #1e40af;
  background-color: #eff6ff;
}

.text-success {
  color: #15803d;
  background-color: #f0fdf4;
}

.text-warning {
  color: #b45309;
  background-color: #fefce8;
}

.text-danger {
  color: #b91c1c;
  background-color: #fef2f2;
}

.notif-content-col {
  flex: 1;
  min-width: 0;
}

.notif-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
}

.notif-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-time {
  font-size: 0.6875rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.notif-msg {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.unread-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #2563eb;
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
}
</style>
