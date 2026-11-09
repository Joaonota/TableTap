<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'
import PublicUrlField from './PublicUrlField.vue'
import { Download, Loader2 } from 'lucide-vue-next'
import { generateQrDataUrl, downloadDataUrl } from '@/services/qrCodeService'

const props = defineProps<{
  isOpen: boolean
  url: string
  title: string
  subtitle?: string
  /** Nome do ficheiro PNG (sem extensão). */
  filename: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const dataUrl = ref('')
const isGenerating = ref(false)
const failed = ref(false)

watch(
  () => [props.isOpen, props.url] as const,
  async ([open, url]) => {
    if (!open || !url) return
    isGenerating.value = true
    failed.value = false
    try {
      dataUrl.value = await generateQrDataUrl(url, 480)
    } catch {
      failed.value = true
      dataUrl.value = ''
    } finally {
      isGenerating.value = false
    }
  },
  { immediate: true }
)
</script>

<template>
  <AppModal :is-open="isOpen" :title="title" :subtitle="subtitle" max-width="420px" @close="emit('close')">
    <div class="qr-content">
      <div class="qr-frame">
        <Loader2 v-if="isGenerating" :size="28" class="spin" />
        <p v-else-if="failed" class="qr-error">Não foi possível gerar o QR Code.</p>
        <img v-else :src="dataUrl" alt="QR Code da URL da mesa" class="qr-image" />
      </div>
      <PublicUrlField :url="url" :show-qr="false" />
      <p class="qr-note">O QR Code contém a mesma URL gravada na etiqueta NFC da mesa.</p>
    </div>
    <template #footer>
      <AppButton variant="secondary" @click="emit('close')">Fechar</AppButton>
      <AppButton variant="primary" :disabled="!dataUrl" @click="downloadDataUrl(dataUrl, `${filename}.png`)">
        <template #icon-left><Download :size="16" /></template>
        Descarregar PNG
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.qr-content {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.qr-frame {
  align-self: center;
  width: 240px;
  max-width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: #fff;
}

.qr-image {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-lg);
}

.qr-error {
  font-size: 0.8125rem;
  color: var(--color-danger-600);
  text-align: center;
  padding: 1rem;
}

.qr-note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

.spin {
  color: var(--text-muted);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
