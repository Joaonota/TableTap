<script setup lang="ts">
import { computed } from 'vue'
import type { CustomerNotificationItem, NotificationIcon } from '@/domain/customerNotifications'
import { orderStatusLabel } from '@/domain/statusLabels'
import { Inbox, ChefHat, CheckCircle2, PackageCheck, XCircle, CreditCard, BellRing, DoorClosed, X } from 'lucide-vue-next'

/** Uma notificação do cliente: ícone, título, mensagem, estado e hora. */
const props = defineProps<{ notification: CustomerNotificationItem }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const ICONS: Record<NotificationIcon, unknown> = {
  received: Inbox,
  preparing: ChefHat,
  ready: CheckCircle2,
  delivered: PackageCheck,
  cancelled: XCircle,
  payment: CreditCard,
  service: BellRing,
  session: DoorClosed
}

const icon = computed(() => ICONS[props.notification.icon])
const time = computed(() =>
  new Date(props.notification.receivedAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
)
const statusText = computed(() =>
  props.notification.eventType === 'order.status_changed' && props.notification.status
    ? orderStatusLabel(props.notification.status)
    : ''
)
</script>

<template>
  <div class="cn" :class="`cn--${notification.tone}`" role="status">
    <div class="cn-icon"><component :is="icon" :size="20" /></div>
    <div class="cn-body">
      <div class="cn-head">
        <strong class="cn-title">{{ notification.title }}</strong>
        <time class="cn-time">{{ time }}</time>
      </div>
      <p class="cn-message">{{ notification.message }}</p>
      <span v-if="statusText" class="cn-status">Estado: {{ statusText }}</span>
    </div>
    <button type="button" class="cn-close" aria-label="Fechar notificação" @click="emit('close')">
      <X :size="16" />
    </button>
  </div>
</template>

<style scoped>
.cn {
  --cn-accent: var(--color-primary-600, #0d7a5f);
  --cn-soft: var(--color-primary-50, #ecfdf5);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.8rem 0.75rem 0.8rem 0.85rem;
  background: #fff;
  border: 1px solid var(--border-color, #e2e8f0);
  border-left: 4px solid var(--cn-accent);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
  pointer-events: auto;
}

.cn--info {
  --cn-accent: #2563eb;
  --cn-soft: #eff6ff;
}
.cn--progress {
  --cn-accent: #d97706;
  --cn-soft: #fffbeb;
}
.cn--success {
  --cn-accent: #059669;
  --cn-soft: #ecfdf5;
}
.cn--warning {
  --cn-accent: #ca8a04;
  --cn-soft: #fefce8;
}
.cn--danger {
  --cn-accent: #dc2626;
  --cn-soft: #fef2f2;
}

.cn-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cn-soft);
  color: var(--cn-accent);
}

.cn-body {
  flex: 1;
  min-width: 0;
}

.cn-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.cn-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--color-neutral-900, #0f172a);
}

.cn-time {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--text-muted, #64748b);
  font-variant-numeric: tabular-nums;
}

.cn-message {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--color-neutral-700, #334155);
}

.cn-status {
  display: inline-block;
  margin-top: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--cn-accent);
}

.cn-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: -0.3rem -0.2rem 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: 8px;
  color: var(--text-muted, #64748b);
  cursor: pointer;
}

.cn-close:hover {
  background: var(--color-neutral-100, #f1f5f9);
}
</style>
