<script setup lang="ts">
interface Option {
  label: string
  value: string | number
}

interface Props {
  modelValue?: string | number
  label?: string
  options: Option[]
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
  id?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  required: false
})

defineEmits<{
  (e: 'update:modelValue', val: string | number): void
}>()
</script>

<template>
  <div class="select-wrapper" :class="{ 'has-error': !!error, 'is-disabled': disabled }">
    <label v-if="label" :for="id" class="select-label">
      {{ label }}
      <span v-if="required" class="required-star">*</span>
    </label>

    <div class="select-box">
      <select
        :id="id"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        class="select-control"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="placeholder" value="" disabled selected>{{ placeholder }}</option>
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </div>

    <span v-if="error" class="select-error-msg">{{ error }}</span>
  </div>
</template>

<style scoped>
.select-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
}

.select-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.required-star {
  color: var(--color-danger-600);
}

.select-box {
  position: relative;
  background-color: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.select-box:focus-within {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.has-error .select-box {
  border-color: var(--color-danger-500);
}

.select-control {
  width: 100%;
  padding: 0.625rem 2.25rem 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--text-main);
  border: none;
  background: transparent;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
}

.select-control:disabled {
  background-color: var(--color-neutral-100);
  cursor: not-allowed;
}

.select-error-msg {
  font-size: 0.75rem;
  color: var(--color-danger-600);
  font-weight: 500;
}
</style>
