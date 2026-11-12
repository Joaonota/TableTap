<script setup lang="ts">
import type { LimitKey, PlanLimit } from '@/types'
import { LIMIT_CATALOG } from '@/types/plan'
import { Infinity as InfinityIcon } from 'lucide-vue-next'

interface Props {
  modelValue: PlanLimit[]
  disabled?: boolean
  /** Erros de validação por chave de limite. */
  errors?: Partial<Record<LimitKey, string>>
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: PlanLimit[]): void
}>()

const getLimitValue = (key: LimitKey): number | null => {
  const item = props.modelValue.find(l => l.resourceKey === key)
  return item !== undefined ? item.limit : 0
}

const isUnlimited = (key: LimitKey): boolean => {
  const item = props.modelValue.find(l => l.resourceKey === key)
  return item?.limit === null
}

const toggleUnlimited = (key: LimitKey) => {
  if (props.disabled) return
  const current = [...props.modelValue]
  const idx = current.findIndex(l => l.resourceKey === key)
  const currentlyUnlimited = current[idx]?.limit === null

  const newLimit = currentlyUnlimited ? 10 : null

  if (idx >= 0) {
    current[idx] = { ...current[idx], limit: newLimit }
  } else {
    current.push({ resourceKey: key, limit: newLimit })
  }

  emit('update:modelValue', current)
}

const updateNumber = (key: LimitKey, value: number) => {
  if (props.disabled) return
  const current = [...props.modelValue]
  const idx = current.findIndex(l => l.resourceKey === key)
  // Valores inválidos (decimais, negativos) ficam para a validação do editor mostrar
  const safeVal = Number.isNaN(value) ? 0 : value

  if (idx >= 0) {
    current[idx] = { ...current[idx], limit: safeVal }
  } else {
    current.push({ resourceKey: key, limit: safeVal })
  }

  emit('update:modelValue', current)
}
</script>

<template>
  <div class="limit-editor-grid">
    <div
      v-for="entry in LIMIT_CATALOG"
      :key="entry.key"
      class="limit-card"
      :class="{ 'is-unlimited': isUnlimited(entry.key) }"
    >
      <div class="limit-card-header">
        <div>
          <div class="limit-name">
            {{ entry.name }}
            <span class="scope-tag">{{ entry.scope === 'restaurant' ? 'por restaurante' : 'por empresa' }}</span>
          </div>
          <div class="limit-desc">{{ entry.description }}</div>
          <div v-if="!entry.enforcedOnCreate" class="limit-desc">Apenas informativo: não bloqueia a operação.</div>
        </div>

        <button
          type="button"
          class="unlimited-toggle-btn"
          :class="{ 'active': isUnlimited(entry.key) }"
          :disabled="disabled"
          @click="toggleUnlimited(entry.key)"
        >
          <InfinityIcon :size="15" />
          <span>Ilimitado</span>
        </button>
      </div>

      <div class="limit-input-wrap">
        <div v-if="isUnlimited(entry.key)" class="unlimited-badge">
          <InfinityIcon :size="18" />
          <span>Sem limite (Ilimitado)</span>
        </div>

        <div v-else class="number-input-group">
          <input
            type="number"
            min="0"
            step="1"
            :value="getLimitValue(entry.key) ?? 0"
            :disabled="disabled"
            class="limit-number-input"
            @input="updateNumber(entry.key, Number(($event.target as HTMLInputElement).value))"
          />
          <span class="unit-label">{{ entry.unit }}</span>
        </div>
        <span v-if="errors?.[entry.key]" class="limit-error">{{ errors[entry.key] }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scope-tag {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: var(--color-neutral-100);
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  vertical-align: middle;
}

.limit-error {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--color-danger-600);
}

.limit-editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.limit-card {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.85rem;
  transition: all 0.15s ease;
}

.limit-card.is-unlimited {
  border-color: rgba(13, 122, 95, 0.35);
  background: rgba(13, 122, 95, 0.02);
}

.limit-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.limit-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text, #111827);
}

.limit-desc {
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.35;
  margin-top: 0.15rem;
}

.unlimited-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7188rem;
  font-weight: 600;
  padding: 0.3rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--color-border, #d1d5db);
  background: #ffffff;
  color: var(--color-text-muted, #4b5563);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.unlimited-toggle-btn:hover:not(:disabled) {
  border-color: var(--color-primary, #0d7a5f);
  color: var(--color-primary, #0d7a5f);
}

.unlimited-toggle-btn.active {
  background: var(--color-primary, #0d7a5f);
  border-color: var(--color-primary, #0d7a5f);
  color: #ffffff;
}

.limit-input-wrap {
  margin-top: auto;
}

.unlimited-badge {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.75rem;
  background: rgba(13, 122, 95, 0.08);
  border-radius: 8px;
  color: var(--color-primary, #0d7a5f);
  font-size: 0.8125rem;
  font-weight: 600;
}

.number-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.limit-number-input {
  width: 100px;
  padding: 0.5rem 0.65rem;
  font-size: 0.9375rem;
  font-weight: 700;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-text, #111827);
  text-align: right;
}

.limit-number-input:focus {
  outline: none;
  border-color: var(--color-primary, #0d7a5f);
  box-shadow: 0 0 0 2px rgba(13, 122, 95, 0.15);
}

.unit-label {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #6b7280);
}
</style>

