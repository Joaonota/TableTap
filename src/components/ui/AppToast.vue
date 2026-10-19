<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const toastStore = useToastStore()
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="toast-item"
        :class="`toast--${toast.type}`"
      >
        <div class="toast-icon">
          <CheckCircle2 v-if="toast.type === 'success'" :size="18" />
          <AlertCircle v-else-if="toast.type === 'danger'" :size="18" />
          <AlertTriangle v-else-if="toast.type === 'warning'" :size="18" />
          <Info v-else :size="18" />
        </div>

        <div class="toast-content">
          <div class="toast-title">{{ toast.title }}</div>
          <div v-if="toast.message" class="toast-message">{{ toast.message }}</div>
        </div>

        <button class="toast-dismiss-btn" aria-label="Fechar" @click="toastStore.dismiss(toast.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 380px;
  width: calc(100% - 3rem);
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #ffffff;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-subtle);
}

.toast--success { border-left: 4px solid var(--color-success-600); }
.toast--success .toast-icon { color: var(--color-success-600); }

.toast--danger { border-left: 4px solid var(--color-danger-600); }
.toast--danger .toast-icon { color: var(--color-danger-600); }

.toast--warning { border-left: 4px solid var(--color-warning-500); }
.toast--warning .toast-icon { color: var(--color-warning-500); }

.toast--info { border-left: 4px solid var(--color-primary-600); }
.toast--info .toast-icon { color: var(--color-primary-600); }

.toast-content {
  flex: 1;
}

.toast-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-900);
}

.toast-message {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-top: 0.125rem;
}

.toast-dismiss-btn {
  background: transparent;
  border: none;
  color: var(--color-neutral-400);
  cursor: pointer;
  padding: 0.125rem;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-dismiss-btn:hover {
  color: var(--color-neutral-700);
}

/* Animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(1rem) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(2rem);
}
</style>
