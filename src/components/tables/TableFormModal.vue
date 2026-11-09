<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import { TABLE_AREAS, type Table, type TableArea } from '@/types'
import type { TableInput } from '@/services'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { generateTableSlug, buildTablePath } from '@/domain/publicUrl'

const props = defineProps<{
  isOpen: boolean
  /** Mesa a editar; null para criar. */
  table: Table | null
  existingTables: Table[]
  restaurantSlug: string
  isSaving?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', input: TableInput): void
}>()

const form = reactive({ number: '', name: '', area: 'Sala Principal' as TableArea, capacity: 4 })
const errors = ref<Partial<Record<'number' | 'capacity', string>>>({})

const suggestNumber = () => {
  const numeric = props.existingTables.map(t => Number.parseInt(t.number, 10)).filter(n => Number.isFinite(n))
  return String((numeric.length ? Math.max(...numeric) : 0) + 1).padStart(2, '0')
}

watch(
  () => props.isOpen,
  open => {
    if (!open) return
    errors.value = {}
    if (props.table) {
      form.number = props.table.number
      form.name = props.table.name ?? ''
      form.area = props.table.area
      form.capacity = props.table.capacity
    } else {
      form.number = suggestNumber()
      form.name = ''
      form.area = 'Sala Principal'
      form.capacity = 4
    }
  }
)

/** Pré-visualização da URL permanente (na edição mantém-se a existente). */
const previewPath = computed(() => {
  if (props.table) return buildTablePath(props.restaurantSlug, props.table.slug)
  const slug = generateTableSlug(form.number, props.existingTables.map(t => t.slug))
  return buildTablePath(props.restaurantSlug, slug)
})

const validate = (): boolean => {
  const next: typeof errors.value = {}
  const number = form.number.trim()
  if (!number) next.number = 'Indique o número da mesa.'
  else if (props.existingTables.some(t => t.id !== props.table?.id && t.number.toLowerCase() === number.toLowerCase())) {
    next.number = `Já existe a Mesa ${number}.`
  }
  const capacity = Number(form.capacity)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) next.capacity = 'Entre 1 e 50 pessoas.'
  errors.value = next
  return Object.keys(next).length === 0
}

const submit = () => {
  if (!validate()) return
  emit('save', { number: form.number.trim(), name: form.name.trim(), area: form.area, capacity: Number(form.capacity) })
}
</script>

<template>
  <AppModal :is-open="isOpen" :title="table ? `Editar Mesa ${table.number}` : 'Nova mesa'" max-width="500px" @close="emit('close')">
    <form class="table-form" novalidate @submit.prevent="submit">
      <div class="form-row">
        <label class="field">
          <span class="field-label">Número *</span>
          <input v-model="form.number" type="text" maxlength="12" placeholder="Ex.: 08" :class="{ 'has-error': errors.number }" />
          <span v-if="errors.number" class="field-error">{{ errors.number }}</span>
        </label>
        <label class="field">
          <span class="field-label">Capacidade *</span>
          <input v-model.number="form.capacity" type="number" min="1" max="50" :class="{ 'has-error': errors.capacity }" />
          <span v-if="errors.capacity" class="field-error">{{ errors.capacity }}</span>
        </label>
      </div>

      <label class="field">
        <span class="field-label">Nome</span>
        <input v-model="form.name" type="text" maxlength="60" placeholder="Ex.: Mesa Janela (opcional)" />
      </label>

      <label class="field">
        <span class="field-label">Área</span>
        <select v-model="form.area">
          <option v-for="area in TABLE_AREAS" :key="area" :value="area">{{ area }}</option>
        </select>
      </label>

      <div class="url-preview">
        <span class="field-label">URL permanente</span>
        <code>{{ previewPath }}</code>
        <span class="field-hint">
          {{ table ? 'A URL não muda ao editar a mesa — a etiqueta NFC continua válida.' : 'Gerada a partir do número e fixa a partir da criação.' }}
        </span>
      </div>
      <button type="submit" hidden></button>
    </form>

    <template #footer>
      <AppButton variant="secondary" :disabled="isSaving" @click="emit('close')">Cancelar</AppButton>
      <AppButton variant="primary" :loading="isSaving" @click="submit">{{ table ? 'Guardar alterações' : 'Criar mesa' }}</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.table-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.field input,
.field select {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: #fff;
  outline: none;
}

.field input:focus,
.field select:focus {
  border-color: var(--color-primary-500);
}

.field input.has-error {
  border-color: var(--color-danger-500);
}

.field-error {
  font-size: 0.75rem;
  color: var(--color-danger-600);
}

.url-preview {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  background: var(--color-neutral-50);
  border: 1px solid var(--border-color);
}

.url-preview code {
  font-size: 0.8rem;
  word-break: break-all;
}

.field-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
}

@media (max-width: 420px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
