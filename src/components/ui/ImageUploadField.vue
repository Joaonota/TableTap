<script setup lang="ts">
import { ref } from 'vue'
import { mediaService } from '@/services'
import type { MediaKind } from '@/services'
import { errorMessage } from '@/domain/errors'
import { ImagePlus, Trash2, Loader2, ImageOff } from 'lucide-vue-next'

/**
 * Envio de imagens para o Supabase Storage (bucket `media`).
 * O ficheiro fica em {empresa}/{restaurante|company}/{tipo}/… e o RLS do
 * Storage só aceita uploads da equipa autorizada dessa empresa.
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    tenantId: string
    restaurantId?: string
    kind: MediaKind
    /** Proporção da pré-visualização (ex.: 16/9 para capas). */
    aspect?: string
    hint?: string
  }>(),
  { modelValue: '', aspect: '4 / 3' }
)

const emit = defineEmits<{ (e: 'update:modelValue', url: string): void }>()

const input = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const error = ref('')
const broken = ref(false)

const pick = () => input.value?.click()

const onFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  error.value = ''
  isUploading.value = true
  try {
    const url = await mediaService.uploadImage(file, {
      tenantId: props.tenantId,
      restaurantId: props.restaurantId,
      kind: props.kind
    })
    broken.value = false
    emit('update:modelValue', url)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    isUploading.value = false
  }
}

/** Retira a imagem do formulário (o ficheiro só é apagado do Storage ao guardar, se aplicável). */
const clear = () => {
  error.value = ''
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="image-field">
    <span v-if="label" class="image-label">{{ label }}</span>
    <div class="image-box" :style="{ aspectRatio: aspect }">
      <img v-if="modelValue && !broken" :src="modelValue" alt="" @error="broken = true" />
      <div v-else class="image-empty">
        <ImageOff v-if="broken" :size="22" />
        <ImagePlus v-else :size="22" />
        <span>{{ broken ? 'Não foi possível carregar a imagem' : 'Sem imagem' }}</span>
      </div>
      <div v-if="isUploading" class="image-loading">
        <Loader2 :size="22" class="spin" />
        <span>A enviar…</span>
      </div>
    </div>
    <div class="image-actions">
      <button type="button" class="image-btn" :disabled="isUploading" @click="pick">
        <ImagePlus :size="15" />
        {{ modelValue ? 'Substituir' : 'Carregar imagem' }}
      </button>
      <button v-if="modelValue" type="button" class="image-btn image-btn--ghost" :disabled="isUploading" @click="clear">
        <Trash2 :size="15" />
        Remover
      </button>
    </div>
    <p v-if="error" class="image-error" role="alert">{{ error }}</p>
    <p v-else class="image-hint">{{ hint || 'JPG, PNG, WebP, GIF ou SVG, até 5 MB.' }}</p>
    <input ref="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" hidden @change="onFile" />
  </div>
</template>

<style scoped>
.image-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.image-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.image-box {
  position: relative;
  width: 100%;
  max-width: 360px;
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--color-neutral-50);
  overflow: hidden;
}

.image-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-empty,
.image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.image-loading {
  background: rgba(255, 255, 255, 0.85);
  color: var(--color-neutral-700);
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.image-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.image-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  background: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  cursor: pointer;
}

.image-btn:hover:not(:disabled) {
  background: var(--color-neutral-50);
}

.image-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.image-btn--ghost {
  border-color: transparent;
  color: var(--color-danger-600);
}

.image-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.image-error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-danger-600);
}
</style>
