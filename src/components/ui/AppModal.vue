<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  title?: string
  subtitle?: string
  maxWidth?: string
  preventClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  maxWidth: '540px',
  preventClose: false
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const requestClose = () => {
  if (!props.preventClose) {
    emit('close')
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    requestClose()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-backdrop" @click.self="requestClose">
        <div class="modal-dialog" :style="{ maxWidth: maxWidth }">
          <div v-if="title || $slots.header" class="modal-header">
            <div>
              <h3 class="modal-title">{{ title }}</h3>
              <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
            </div>
            <button
              v-if="!preventClose"
              class="modal-close-btn"
              aria-label="Fechar modal"
              @click="requestClose"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="modal-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.modal-dialog {
  width: 100%;
  min-width: 0;
  background: #ffffff;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  animation: modal-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  overflow-wrap: anywhere;
}

.modal-subtitle {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--color-neutral-400);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.modal-close-btn:hover {
  color: var(--color-neutral-800);
  background-color: var(--color-neutral-100);
}

.modal-body {
  padding: 1.5rem;
  min-width: 0;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-subtle);
  background-color: var(--color-neutral-50);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.modal-close-btn {
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .modal-backdrop {
    padding: 0.75rem;
  }

  .modal-dialog {
    max-height: 92vh;
    border-radius: var(--radius-lg);
  }

  .modal-header {
    padding: 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .modal-footer {
    padding: 0.875rem 1rem;
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .modal-footer :deep(.app-btn) {
    width: 100%;
    white-space: normal;
    line-height: 1.25;
  }
}

/* Animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@keyframes modal-pop {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
