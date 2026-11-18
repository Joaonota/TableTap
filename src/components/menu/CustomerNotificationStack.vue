<script setup lang="ts">
import { useCustomerNotificationStore } from '@/stores/customerNotifications'
import CustomerNotification from './CustomerNotification.vue'

/**
 * Notificações do cliente, no topo do ecrã. Discretas: não bloqueiam a
 * navegação no menu (o resto da área deixa passar os toques).
 */
const store = useCustomerNotificationStore()
</script>

<template>
  <div class="cn-stack" aria-live="polite" aria-relevant="additions">
    <TransitionGroup name="cn">
      <CustomerNotification
        v-for="n in store.items"
        :key="n.id"
        :notification="n"
        @close="store.dismiss(n.id)"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.cn-stack {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1200;
  width: min(420px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.cn-enter-active,
.cn-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.cn-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.cn-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.cn-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .cn-enter-active,
  .cn-leave-active {
    transition: none;
  }
}
</style>
