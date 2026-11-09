<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div v-if="icon" class="empty-icon">
      <component :is="icon" :size="24" />
    </div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="empty-description">{{ description }}</p>
    <div v-if="$slots.default" class="empty-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.35rem;
  padding: 2.5rem 1rem;
  border: 1.5px dashed var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-surface, #fff);
}

.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--color-neutral-100);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.empty-title {
  margin: 0;
  font-weight: 700;
  color: var(--text-main);
}

.empty-description {
  margin: 0;
  max-width: 420px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.empty-actions {
  margin-top: 0.75rem;
}
</style>
