<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  dot?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'neutral',
  dot: false
})
</script>

<template>
  <span class="app-badge" :class="`app-badge--${variant}`">
    <span v-if="dot" class="badge-dot" aria-hidden="true"></span>
    <slot />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  text-transform: capitalize;
  letter-spacing: 0.01em;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.app-badge--primary {
  background-color: var(--color-primary-50);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-200);
}

.app-badge--success {
  background-color: var(--color-success-50);
  color: var(--color-success-700);
  border: 1px solid var(--color-success-100);
}

.app-badge--warning {
  background-color: var(--color-warning-50);
  color: var(--color-warning-600);
  border: 1px solid var(--color-warning-100);
}

.app-badge--danger {
  background-color: var(--color-danger-50);
  color: var(--color-danger-600);
  border: 1px solid var(--color-danger-100);
}

.app-badge--neutral {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
  border: 1px solid var(--color-neutral-200);
}
</style>
