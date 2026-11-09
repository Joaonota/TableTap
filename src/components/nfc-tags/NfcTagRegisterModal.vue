<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { Restaurant } from '@/types'
import type { RegisterNfcTagsInput } from '@/services'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { NFC_TAG_CODE_PATTERN } from '@/domain/nfcTagRules'

/** Registo de novas etiquetas físicas no inventário (equipa TapMenu). */
const props = defineProps<{
  isOpen: boolean
  restaurants: Restaurant[]
  defaultRestaurantId?: string
  isSaving?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', input: RegisterNfcTagsInput): void
}>()

const form = reactive({ restaurantId: '', mode: 'generate' as 'generate' | 'codes', quantity: 1, codes: '', notes: '' })
const errors = ref<Record<string, string>>({})

watch(
  () => props.isOpen,
  open => {
    if (!open) return
    form.restaurantId = props.defaultRestaurantId || props.restaurants[0]?.id || ''
    form.mode = 'generate'
    form.quantity = 1
    form.codes = ''
    form.notes = ''
    errors.value = {}
  }
)

const parseCodes = () =>
  form.codes
    .split(/[\s,;]+/)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean)

const submit = () => {
  const next: Record<string, string> = {}
  if (!form.restaurantId) next.restaurantId = 'Escolha o restaurante.'
  if (form.mode === 'generate') {
    if (!Number.isInteger(form.quantity) || form.quantity < 1 || form.quantity > 100) next.quantity = 'Entre 1 e 100.'
  } else {
    const codes = parseCodes()
    if (codes.length === 0) next.codes = 'Introduza pelo menos um código.'
    const invalid = codes.filter(c => !NFC_TAG_CODE_PATTERN.test(c))
    if (invalid.length) next.codes = `Formato inválido: ${invalid.join(', ')} (use TAG-00017).`
  }
  errors.value = next
  if (Object.keys(next).length) return

  emit('submit', {
    restaurantId: form.restaurantId,
    quantity: form.mode === 'generate' ? form.quantity : undefined,
    codes: form.mode === 'codes' ? parseCodes() : undefined,
    notes: form.notes.trim() || undefined
  })
}
</script>

<template>
  <AppModal :is-open="isOpen" title="Registar etiquetas" subtitle="Adiciona etiquetas físicas ao inventário de um restaurante." max-width="480px" @close="emit('close')">
    <form class="register" novalidate @submit.prevent="submit">
      <label class="field">
        <span class="label">Restaurante *</span>
        <select v-model="form.restaurantId" :class="{ 'has-error': errors.restaurantId }">
          <option value="" disabled>Escolher…</option>
          <option v-for="r in restaurants" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <span v-if="errors.restaurantId" class="error">{{ errors.restaurantId }}</span>
      </label>

      <div class="field">
        <span class="label">Códigos</span>
        <div class="mode">
          <label><input v-model="form.mode" type="radio" value="generate" /> Gerar sequenciais</label>
          <label><input v-model="form.mode" type="radio" value="codes" /> Já impressos</label>
        </div>
      </div>

      <label v-if="form.mode === 'generate'" class="field">
        <span class="label">Quantidade</span>
        <input v-model.number="form.quantity" type="number" min="1" max="100" :class="{ 'has-error': errors.quantity }" />
        <span v-if="errors.quantity" class="error">{{ errors.quantity }}</span>
        <span v-else class="hint">Os códigos seguem a numeração global (ex.: TAG-00011, TAG-00012…).</span>
      </label>

      <label v-else class="field">
        <span class="label">Códigos impressos</span>
        <textarea v-model="form.codes" rows="4" placeholder="TAG-00017&#10;TAG-00018" :class="{ 'has-error': errors.codes }"></textarea>
        <span v-if="errors.codes" class="error">{{ errors.codes }}</span>
        <span v-else class="hint">Um por linha, ou separados por vírgula.</span>
      </label>

      <label class="field">
        <span class="label">Notas (opcional)</span>
        <input v-model="form.notes" type="text" maxlength="160" placeholder="Ex.: lote de outubro" />
      </label>
      <button type="submit" hidden></button>
    </form>
    <template #footer>
      <AppButton variant="secondary" :disabled="isSaving" @click="emit('close')">Cancelar</AppButton>
      <AppButton variant="primary" :loading="isSaving" @click="submit">Registar</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.register {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.label {
  font-size: 0.8125rem;
  font-weight: 700;
}

select,
input[type='number'],
input[type='text'],
textarea {
  padding: 0.6rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-family: inherit;
  background: #fff;
}

.has-error {
  border-color: var(--color-danger-500) !important;
}

.mode {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.8125rem;
}

.mode label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.error {
  font-size: 0.75rem;
  color: var(--color-danger-600);
}

.hint {
  font-size: 0.72rem;
  color: var(--text-muted);
}
</style>
