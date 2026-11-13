<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'

/**
 * Variantes (ex.: tamanho, com acréscimo ao preço base) e adicionais
 * (extras pagos) de um produto. Guardados em product_variants /
 * product_addons; o preço final é sempre calculado pelo servidor.
 */
export interface OptionRow {
  id?: string
  name: string
  amount: number
}

const props = defineProps<{
  title: string
  description: string
  amountLabel: string
  addLabel: string
  modelValue: OptionRow[]
  /** Variantes aceitam acréscimo negativo (ex.: dose pequena). */
  allowNegative?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', rows: OptionRow[]): void }>()

const update = (index: number, patch: Partial<OptionRow>) => {
  emit('update:modelValue', props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}
const add = () => emit('update:modelValue', [...props.modelValue, { name: '', amount: 0 }])
const remove = (index: number) => emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
</script>

<template>
  <fieldset class="options-editor">
    <legend class="options-title">{{ title }}</legend>
    <p class="options-desc">{{ description }}</p>

    <div v-for="(row, index) in modelValue" :key="index" class="option-row">
      <input
        :value="row.name"
        class="option-input"
        type="text"
        placeholder="Nome"
        maxlength="60"
        :aria-label="`${title}: nome`"
        @input="update(index, { name: ($event.target as HTMLInputElement).value })"
      />
      <div class="option-amount">
        <input
          :value="row.amount"
          class="option-input"
          type="number"
          step="1"
          :min="allowNegative ? undefined : 0"
          :aria-label="amountLabel"
          @input="update(index, { amount: Number(($event.target as HTMLInputElement).value) || 0 })"
        />
        <span>MT</span>
      </div>
      <button type="button" class="option-remove" :aria-label="`Remover ${row.name || 'opção'}`" @click="remove(index)">
        <Trash2 :size="15" />
      </button>
    </div>

    <button type="button" class="option-add" @click="add">
      <Plus :size="15" />
      {{ addLabel }}
    </button>
  </fieldset>
</template>

<style scoped>
.options-editor {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.9rem 0.9rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.options-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-800);
  padding: 0 0.25rem;
}

.options-desc {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.option-row {
  display: grid;
  grid-template-columns: 1fr 130px auto;
  gap: 0.5rem;
  align-items: center;
}

.option-input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  background: #fff;
}

.option-amount {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.option-remove {
  border: none;
  background: transparent;
  color: var(--color-danger-600);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: var(--radius-sm);
}

.option-remove:hover {
  background: var(--color-danger-50);
}

.option-add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px dashed var(--border-medium);
  background: #fff;
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary-700);
  cursor: pointer;
}

@media (max-width: 480px) {
  .option-row {
    grid-template-columns: 1fr 100px auto;
  }
}
</style>
