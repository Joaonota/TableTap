<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button'
})

defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="app-btn"
    :class="[`app-btn--${variant}`, `app-btn--${size}`, { 'is-loading': loading }]"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="spinner" aria-hidden="true"></span>
    <slot name="icon-left" />
    <span class="btn-text"><slot /></span>
    <slot name="icon-right" />
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
  line-height: 1;
}

.app-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

/* Sizes */
.app-btn--sm {
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
  border-radius: var(--radius-sm);
}
.app-btn--md {
  padding: 0.65rem 1.1rem;
  font-size: 0.875rem;
}
.app-btn--lg {
  padding: 0.85rem 1.5rem;
  font-size: 1rem;
  border-radius: var(--radius-lg);
}

/* Variants */
.app-btn--primary {
  background-color: var(--color-primary-800);
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(30, 64, 175, 0.2);
}
.app-btn--primary:hover:not(:disabled) {
  background-color: var(--color-primary-900);
  box-shadow: 0 4px 6px -1px rgba(30, 64, 175, 0.25);
  transform: translateY(-1px);
}

.app-btn--secondary {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-800);
  border-color: var(--color-neutral-200);
}
.app-btn--secondary:hover:not(:disabled) {
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-900);
}

.app-btn--success {
  background-color: var(--color-success-600);
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(5, 150, 105, 0.2);
}
.app-btn--success:hover:not(:disabled) {
  background-color: var(--color-success-700);
  transform: translateY(-1px);
}

.app-btn--danger {
  background-color: var(--color-danger-600);
  color: #ffffff;
}
.app-btn--danger:hover:not(:disabled) {
  background-color: var(--color-danger-700);
}

.app-btn--outline {
  background-color: transparent;
  border-color: var(--border-medium);
  color: var(--text-main);
}
.app-btn--outline:hover:not(:disabled) {
  background-color: var(--color-neutral-100);
  border-color: var(--color-neutral-400);
}

.app-btn--ghost {
  background-color: transparent;
  color: var(--color-neutral-700);
}
.app-btn--ghost:hover:not(:disabled) {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
