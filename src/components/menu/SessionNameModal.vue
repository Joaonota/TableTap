<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'

/**
 * Pede o nome do cliente para iniciar a sessão (mesa livre) ou juntar-se
 * à sessão existente (mesa ocupada).
 */
const props = defineProps<{
  isOpen: boolean
  mode: 'start' | 'join'
  tableNumber: string
  maxPartySize?: number
  isSubmitting?: boolean
  initialName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { name: string; partySize?: number; notes?: string }): void
}>()

const form = reactive({ name: '', partySize: 2, notes: '' })
const error = ref('')

watch(
  () => props.isOpen,
  open => {
    if (!open) return
    form.name = props.initialName ?? ''
    form.partySize = Math.min(2, props.maxPartySize ?? 2)
    form.notes = ''
    error.value = ''
  }
)

const submit = () => {
  const name = form.name.trim()
  if (!name) {
    error.value = 'Indique o seu nome — é assim que a equipa identifica os pedidos.'
    return
  }
  if (name.length > 60) {
    error.value = 'O nome deve ter no máximo 60 caracteres.'
    return
  }
  emit('submit', {
    name,
    partySize: props.mode === 'start' ? form.partySize : undefined,
    notes: props.mode === 'start' ? form.notes.trim() || undefined : undefined
  })
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="mode === 'start' ? `Iniciar sessão — Mesa ${tableNumber}` : `Juntar-me à Mesa ${tableNumber}`"
    :subtitle="mode === 'start' ? 'A mesa passa a ocupada e pode fazer pedidos.' : 'Os seus pedidos entram na mesma sessão e conta da mesa.'"
    max-width="440px"
    @close="emit('close')"
  >
    <form class="name-form" novalidate @submit.prevent="submit">
      <label class="field">
        <span class="label">O seu nome *</span>
        <input
          v-model="form.name"
          type="text"
          maxlength="60"
          autocomplete="given-name"
          placeholder="Ex.: Carlos"
          :class="{ 'has-error': error }"
          @input="error = ''"
        />
        <span v-if="error" class="error">{{ error }}</span>
      </label>

      <template v-if="mode === 'start'">
        <div class="field">
          <span class="label">Quantas pessoas?</span>
          <div class="party">
            <button
              v-for="n in [1, 2, 3, 4, 5, 6]"
              :key="n"
              type="button"
              class="party-btn"
              :class="{ 'is-selected': form.partySize === n }"
              @click="form.partySize = n"
            >
              {{ n }}
            </button>
          </div>
        </div>
        <label class="field">
          <span class="label">Observações (opcional)</span>
          <input v-model="form.notes" type="text" maxlength="120" placeholder="Ex.: cadeira de bebé" />
        </label>
      </template>
      <button type="submit" hidden></button>
    </form>

    <template #footer>
      <AppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Agora não</AppButton>
      <AppButton variant="primary" :loading="isSubmitting" @click="submit">
        {{ mode === 'start' ? 'Iniciar sessão' : 'Juntar-me' }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.name-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label {
  font-size: 0.8125rem;
  font-weight: 700;
}

.field input {
  padding: 0.7rem 0.85rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 1rem;
  outline: none;
}

.field input:focus {
  border-color: var(--color-primary-500);
}

.field input.has-error {
  border-color: var(--color-danger-500);
}

.error {
  font-size: 0.75rem;
  color: var(--color-danger-600);
}

.party {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.party-btn {
  width: 42px;
  height: 42px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #fff;
  font-weight: 700;
  cursor: pointer;
}

.party-btn.is-selected {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
  color: var(--color-primary-700);
}
</style>
