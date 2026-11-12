<script setup lang="ts">
import { computed } from 'vue'
import type { FeatureKey, PlanFeature } from '@/types'
import { FEATURE_CATALOG } from '@/types/plan'
import { Check, X } from 'lucide-vue-next'

interface Props {
  modelValue: PlanFeature[]
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: PlanFeature[]): void
}>()

const modules = ['Menu & Mesas', 'Operação', 'Pagamentos', 'Inteligência', 'Equipa', 'Avançado'] as const

const isEnabled = (key: FeatureKey): boolean => {
  const item = props.modelValue.find(f => f.featureKey === key)
  return item ? item.enabled : false
}

const toggleFeature = (key: FeatureKey) => {
  if (props.disabled) return
  const current = [...props.modelValue]
  const idx = current.findIndex(f => f.featureKey === key)

  if (idx >= 0) {
    current[idx] = {
      ...current[idx],
      enabled: !current[idx].enabled
    }
  } else {
    current.push({ featureKey: key, enabled: true })
  }

  emit('update:modelValue', current)
}

const selectAllInModule = (moduleName: string, enable: boolean) => {
  if (props.disabled) return
  const current = [...props.modelValue]
  const moduleFeatures = FEATURE_CATALOG.filter(f => f.module === moduleName)

  moduleFeatures.forEach(feat => {
    const idx = current.findIndex(f => f.featureKey === feat.key)
    if (idx >= 0) {
      current[idx] = { ...current[idx], enabled: enable }
    } else {
      current.push({ featureKey: feat.key, enabled: enable })
    }
  })

  emit('update:modelValue', current)
}
</script>

<template>
  <div class="feature-selector">
    <div
      v-for="mod in modules"
      :key="mod"
      class="module-group"
    >
      <div class="module-header">
        <div class="module-title-wrap">
          <span class="module-tag">{{ mod }}</span>
          <span class="module-count">
            {{ FEATURE_CATALOG.filter(f => f.module === mod && isEnabled(f.key)).length }} /
            {{ FEATURE_CATALOG.filter(f => f.module === mod).length }} ativas
          </span>
        </div>
        <div v-if="!disabled" class="module-quick-actions">
          <button
            type="button"
            class="quick-btn"
            @click="selectAllInModule(mod, true)"
          >
            Todas
          </button>
          <span class="sep">•</span>
          <button
            type="button"
            class="quick-btn"
            @click="selectAllInModule(mod, false)"
          >
            Nenhuma
          </button>
        </div>
      </div>

      <div class="features-grid">
        <div
          v-for="feat in FEATURE_CATALOG.filter(f => f.module === mod)"
          :key="feat.key"
          class="feature-item"
          :class="{ 'is-active': isEnabled(feat.key), 'is-disabled': disabled }"
          @click="toggleFeature(feat.key)"
        >
          <div class="toggle-checkbox" :class="{ 'checked': isEnabled(feat.key) }">
            <Check v-if="isEnabled(feat.key)" :size="13" />
            <X v-else :size="11" />
          </div>

          <div class="feature-info">
            <div class="feature-name">{{ feat.name }}</div>
            <div class="feature-desc">{{ feat.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feature-selector {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.module-group {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.module-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.module-tag {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-primary, #0d7a5f);
  background: rgba(13, 122, 95, 0.08);
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
}

.module-count {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
}

.module-quick-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
}

.quick-btn {
  background: transparent;
  border: none;
  color: var(--color-primary, #0d7a5f);
  cursor: pointer;
  padding: 0;
  font-weight: 600;
}

.quick-btn:hover {
  text-decoration: underline;
}

.sep {
  color: var(--color-border, #374151);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.625rem;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: var(--color-background, #f9fafb);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.feature-item:hover:not(.is-disabled) {
  border-color: var(--color-primary, #0d7a5f);
  background: #ffffff;
}

.feature-item.is-active {
  border-color: rgba(13, 122, 95, 0.4);
  background: rgba(13, 122, 95, 0.03);
}

.toggle-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1.5px solid var(--color-border, #d1d5db);
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0f172a;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all 0.15s;
}

.toggle-checkbox.checked {
  background: var(--color-primary, #0d7a5f);
  border-color: var(--color-primary, #0d7a5f);
}

.feature-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #111827);
}

.feature-desc {
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.35;
  margin-top: 0.15rem;
}

.is-disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>

