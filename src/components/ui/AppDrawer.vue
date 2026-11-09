<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    title?: string
    subtitle?: string
    width?: string
  }>(),
  { width: '560px' }
)

const emit = defineEmits<{ (e: 'close'): void }>()

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) emit('close')
}

// Impede o scroll da página por trás do painel
watch(
  () => props.isOpen,
  open => {
    document.body.style.overflow = open ? 'hidden' : ''
  }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="drawer-backdrop" @click.self="emit('close')">
        <aside class="drawer-panel" :style="{ maxWidth: width }" role="dialog" aria-modal="true" :aria-label="title">
          <header class="drawer-header">
            <div class="drawer-heading">
              <slot name="header">
                <h3 class="drawer-title">{{ title }}</h3>
                <p v-if="subtitle" class="drawer-subtitle">{{ subtitle }}</p>
              </slot>
            </div>
            <button type="button" class="drawer-close" aria-label="Fechar painel" @click="emit('close')">
              <X :size="20" />
            </button>
          </header>
          <div class="drawer-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="drawer-footer">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 100%;
  height: 100%;
  background: var(--bg-surface, #fff);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.125rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.drawer-heading {
  min-width: 0;
  flex: 1;
}

.drawer-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-main);
}

.drawer-subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.drawer-close {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-muted);
  cursor: pointer;
}

.drawer-close:hover {
  color: var(--text-main);
  background: var(--color-neutral-50);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.drawer-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--border-color);
  background: var(--color-neutral-50);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}

@media (max-width: 640px) {
  .drawer-header,
  .drawer-body,
  .drawer-footer {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
