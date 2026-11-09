<script setup lang="ts">
import { Copy, ExternalLink, QrCode } from 'lucide-vue-next'
import { copyToClipboard } from '@/services/qrCodeService'
import { useToastStore } from '@/stores/toast'

/** URL pública da mesa com ações: copiar, abrir/testar e QR Code. */
const props = withDefaults(defineProps<{ url: string; showQr?: boolean; compact?: boolean }>(), {
  showQr: true,
  compact: false
})
const emit = defineEmits<{ (e: 'show-qr'): void }>()
const toastStore = useToastStore()

const copy = async () => {
  const ok = await copyToClipboard(props.url)
  if (ok) toastStore.success('URL copiada', props.url)
  else toastStore.error('Não foi possível copiar', 'Selecione e copie a URL manualmente.')
}
</script>

<template>
  <div class="url-field" :class="{ 'is-compact': compact }">
    <code class="url-text" :title="url">{{ url }}</code>
    <div class="url-actions">
      <button type="button" class="url-btn" title="Copiar URL" aria-label="Copiar URL" @click="copy">
        <Copy :size="15" />
      </button>
      <a :href="url" target="_blank" rel="noopener" class="url-btn" title="Abrir / testar URL" aria-label="Abrir URL">
        <ExternalLink :size="15" />
      </a>
      <button v-if="showQr" type="button" class="url-btn" title="QR Code" aria-label="Gerar QR Code" @click="emit('show-qr')">
        <QrCode :size="15" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.url-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.375rem 0.375rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--color-neutral-50);
  min-width: 0;
}

.url-text {
  flex: 1;
  min-width: 0;
  font-size: 0.78rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.url-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.url-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--text-main);
  cursor: pointer;
}

.url-btn:hover {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border-color: var(--color-primary-200);
}

.is-compact {
  padding: 0.25rem 0.25rem 0.25rem 0.5rem;
}
</style>
