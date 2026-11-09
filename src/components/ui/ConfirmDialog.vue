<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'
import { AlertTriangle } from 'lucide-vue-next'

/**
 * Confirmação para ações destrutivas ou com impacto operacional.
 * `inputLabel` mostra um campo de texto opcional (ex.: motivo).
 */
const props = withDefaults(
  defineProps<{
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    variant?: 'danger' | 'primary' | 'warning'
    isLoading?: boolean
    inputLabel?: string
    inputPlaceholder?: string
  }>(),
  { confirmLabel: 'Confirmar', variant: 'danger', isLoading: false }
)

const emit = defineEmits<{
  (e: 'confirm', inputValue: string): void
  (e: 'cancel'): void
}>()

const inputValue = ref('')
watch(
  () => props.isOpen,
  open => {
    if (open) inputValue.value = ''
  }
)
</script>

<template>
  <AppModal :is-open="isOpen" :title="title" max-width="460px" @close="emit('cancel')">
    <div class="confirm-body">
      <div class="confirm-icon" :class="`is-${variant}`">
        <AlertTriangle :size="20" />
      </div>
      <div class="confirm-text">
        <p class="confirm-message">{{ message }}</p>
        <slot />
        <label v-if="inputLabel" class="confirm-field">
          <span>{{ inputLabel }}</span>
          <input v-model="inputValue" type="text" :placeholder="inputPlaceholder" maxlength="160" />
        </label>
      </div>
    </div>
    <template #footer>
      <AppButton variant="secondary" :disabled="isLoading" @click="emit('cancel')">Cancelar</AppButton>
      <AppButton :variant="variant" :loading="isLoading" @click="emit('confirm', inputValue.trim())">{{ confirmLabel }}</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.confirm-body {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
}

.confirm-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-icon.is-danger {
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}

.confirm-icon.is-warning {
  background: var(--color-warning-50);
  color: var(--color-warning-600);
}

.confirm-icon.is-primary {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
}

.confirm-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.confirm-message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-main);
}

.confirm-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.confirm-field input {
  padding: 0.6rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.confirm-field input:focus {
  border-color: var(--color-primary-500);
}
</style>
