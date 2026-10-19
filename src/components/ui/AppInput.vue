<script setup lang="ts">
interface Props {
  modelValue?: string | number
  label?: string
  placeholder?: string
  type?: string
  error?: string
  hint?: string
  disabled?: boolean
  required?: boolean
  id?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  required: false
})

defineEmits<{
  (e: 'update:modelValue', val: string | number): void
}>()
</script>

<template>
  <div class="input-wrapper" :class="{ 'has-error': !!error, 'is-disabled': disabled }">
    <label v-if="label" :for="id" class="input-label">
      {{ label }}
      <span v-if="required" class="required-star">*</span>
    </label>

    <div class="input-box">
      <div v-if="$slots.prefix" class="input-prefix">
        <slot name="prefix" />
      </div>

      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        class="input-control"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />

      <div v-if="$slots.suffix" class="input-suffix">
        <slot name="suffix" />
      </div>
    </div>

    <span v-if="error" class="input-error-msg">{{ error }}</span>
    <span v-else-if="hint" class="input-hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
}

.input-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.required-star {
  color: var(--color-danger-600);
}

.input-box {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  overflow: hidden;
}

.input-box:focus-within {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.has-error .input-box {
  border-color: var(--color-danger-500);
}
.has-error .input-box:focus-within {
  box-shadow: 0 0 0 3px var(--color-danger-100);
}

.input-control {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--text-main);
  border: none;
  background: transparent;
  outline: none;
}

.input-control:disabled {
  background-color: var(--color-neutral-100);
  cursor: not-allowed;
}

.input-prefix, .input-suffix {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  color: var(--text-muted);
}

.input-error-msg {
  font-size: 0.75rem;
  color: var(--color-danger-600);
  font-weight: 500;
}

.input-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
