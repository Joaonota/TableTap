<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon?: Component
  trend?: {
    value: string
    isPositive: boolean
  }
  variant?: 'primary' | 'success' | 'warning' | 'neutral'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary'
})
</script>

<template>
  <div class="metric-card" :class="`metric-card--${variant}`">
    <div class="metric-header">
      <span class="metric-title">{{ title }}</span>
      <div v-if="icon" class="metric-icon-box">
        <component :is="icon" :size="20" />
      </div>
    </div>

    <div class="metric-value-row">
      <div class="metric-value">{{ value }}</div>
    </div>

    <div v-if="trend || subtitle" class="metric-footer">
      <span
        v-if="trend"
        class="metric-trend"
        :class="{ 'is-positive': trend.isPositive, 'is-negative': !trend.isPositive }"
      >
        {{ trend.isPositive ? '↑' : '↓' }} {{ trend.value }}
      </span>
      <span v-if="subtitle" class="metric-subtitle">{{ subtitle }}</span>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metric-icon-box {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-card--primary .metric-icon-box {
  background: var(--color-primary-50);
  color: var(--color-primary-800);
}
.metric-card--success .metric-icon-box {
  background: var(--color-success-50);
  color: var(--color-success-600);
}
.metric-card--warning .metric-icon-box {
  background: var(--color-warning-50);
  color: var(--color-warning-600);
}
.metric-card--neutral .metric-icon-box {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.metric-value {
  font-size: 1.75rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-neutral-900);
  letter-spacing: -0.02em;
  line-height: 1;
}

.metric-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.metric-trend {
  font-weight: 700;
}
.metric-trend.is-positive {
  color: var(--color-success-600);
}
.metric-trend.is-negative {
  color: var(--color-danger-600);
}

.metric-subtitle {
  color: var(--text-muted);
}
</style>
