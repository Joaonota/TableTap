<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { NfcTag, ParsedNfcRead } from '@/types'
import { nfcService } from '@/services/nfc/nfcService'
import { translateNfcException } from '@/services/nfc/nfcErrors'
import { useNfcStore } from '@/stores/nfc'
import {
  Search,
  ScanLine,
  Radio,
  X,
  Cpu,
  ExternalLink,
  AlertTriangle,
  Link2
} from 'lucide-vue-next'

/**
 * NFCReader — leitura REAL de etiquetas ("Testar etiqueta").
 *
 * Não inventa UID: se o browser não fornecer o identificador físico, mostra
 * "Identificador físico não disponibilizado pelo navegador."
 */
const emit = defineEmits<{
  (e: 'read', read: ParsedNfcRead): void
}>()

const nfcStore = useNfcStore()

const isWaiting = ref(false)
const lastRead = ref<ParsedNfcRead | null>(null)
const errorMessage = ref<string | null>(null)
const errorHint = ref<string | null>(null)
const technical = ref<string | null>(null)

const isSupported = computed(() => nfcService.isSupported())

const startRead = async () => {
  errorMessage.value = null
  errorHint.value = null
  technical.value = null
  lastRead.value = null
  isWaiting.value = true
  try {
    const read = await nfcService.readTag()
    lastRead.value = read
    isWaiting.value = false
    emit('read', read)

    // Associação apenas quando o conteúdo físico corresponde a um registo
    const matched = read.url ? nfcStore.getRecordByUrl(read.url) : undefined
    if (matched) nfcStore.registerRead(matched, read)
  } catch (e) {
    isWaiting.value = false
    const err = translateNfcException(e)
    if (err.code !== 'cancelled') {
      errorMessage.value = err.message
      errorHint.value = err.hint
      technical.value = err.technical
    }
  }
}

const cancelRead = () => {
  nfcService.cancelNfcSession()
  isWaiting.value = false
}

onUnmounted(() => {
  if (isWaiting.value) nfcService.cancelNfcSession()
})

const matchedRecord = computed<NfcTag | null>(() => {
  if (!lastRead.value?.url) return null
  return nfcStore.getRecordByUrl(lastRead.value.url) ?? null
})

const isForeignUrl = computed(() => {
  const read = lastRead.value
  if (!read) return false
  if (!read.url) return false
  if (read.url.includes('tapmenu')) return false
  return !matchedRecord.value
})

const formatBits = (n: number) => `${n} bytes`

const serialOrFallback = computed(() => {
  const s = lastRead.value?.serialNumber
  return s ? s : 'Identificador físico não disponibilizado pelo navegador.'
})
</script>

<template>
  <div class="nfc-reader">
    <!-- Waiting state -->
    <div v-if="isWaiting" class="reader-waiting">
      <div class="reader-pulse">
        <span class="reader-wave wave-1"></span>
        <span class="reader-wave wave-2"></span>
        <span class="reader-wave wave-3"></span>
        <span class="reader-core"><ScanLine :size="26" /></span>
      </div>
      <div>
        <strong class="reader-wait-title">Aguardando etiqueta</strong>
        <p class="reader-wait-sub">Encoste a etiqueta NFC à parte traseira do dispositivo e mantenha o contacto.</p>
      </div>
      <button class="reader-cancel-btn" @click="cancelRead">
        <X :size="14" />
        Cancelar
      </button>
    </div>

    <!-- Action -->
    <div v-else class="reader-prompt">
      <button class="reader-btn" :disabled="!isSupported" @click="startRead">
        <template v-if="isSupported">
          <Search :size="16" />
          Testar etiqueta
        </template>
        <template v-else>
          <AlertTriangle :size="16" />
          NFC não suportado neste dispositivo
        </template>
      </button>
    </div>

    <!-- Error -->
    <div v-if="errorMessage" class="reader-error">
      <AlertTriangle :size="16" />
      <div>
        <p class="reader-error-text">{{ errorMessage }}</p>
        <p v-if="errorHint" class="reader-error-hint">{{ errorHint }}</p>
        <details v-if="technical" class="reader-tech-details">
          <summary>Detalhes técnicos</summary>
          <p class="reader-error-technical">{{ technical }}</p>
        </details>
      </div>
    </div>

    <!-- Result -->
    <div v-if="lastRead" class="reader-result">
      <div class="reader-result-header">
        <span class="reader-kind-badge" :class="`kind-${lastRead.messageKind}`">
          <Cpu :size="12" />
          Tipo de mensagem: {{ lastRead.messageKind }}
        </span>
        <span class="reader-timestamp">{{ new Date(lastRead.readAt).toLocaleTimeString() }}</span>
      </div>

      <div class="reader-rows">
        <div class="reader-row">
          <span class="reader-key">UID / Serial físico</span>
          <span class="reader-val font-mono">{{ serialOrFallback }}</span>
        </div>

        <div v-if="matchedRecord" class="reader-row matched">
          <span class="reader-key"><Link2 :size="12" /> Etiqueta associada</span>
          <span class="reader-val">
            <strong>{{ matchedRecord.restaurantName }}</strong>
            · Mesa {{ matchedRecord.tableNumber }}
            · {{ matchedRecord.status === 'active' ? 'Ativa' : matchedRecord.status === 'protected' ? 'Protegida (sistema)' : matchedRecord.status === 'failed' ? 'Falha na última gravação' : 'Não gravada' }}
          </span>
        </div>

        <div v-if="lastRead.url" class="reader-row">
          <span class="reader-key">URL lido</span>
          <a :href="lastRead.url" target="_blank" rel="noopener noreferrer" class="reader-url font-mono">
            {{ lastRead.url }}
            <ExternalLink :size="12" />
          </a>
        </div>
      </div>

      <div v-if="isForeignUrl" class="reader-foreign">
        <AlertTriangle :size="14" />
        Conteúdo externo — este URL não pertence ao TapMenu. Trate o conteúdo como dado de terceiros.
      </div>

      <div v-if="lastRead.records.length" class="reader-records">
        <span class="reader-seq-title">Registos NDEF ({{ lastRead.records.length }})</span>
        <div v-for="(rec, idx) in lastRead.records" :key="idx" class="reader-record-line">
          <span class="rec-type">{{ rec.recordType }}</span>
          <span class="rec-data font-mono">{{ rec.url || rec.text || `(payload ${formatBits(rec.payloadBytes) || '0 bytes'})` }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nfc-reader {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.reader-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.reader-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-200);
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 48px;
}

.reader-btn:hover {
  background-color: var(--color-primary-800);
  color: #ffffff;
}

.reader-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Waiting */
.reader-waiting {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-lg);
  background-color: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
}

.reader-pulse {
  position: relative;
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reader-wave {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--color-primary-600);
  animation: reader-wave-anim 1.8s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
}

.wave-2 { animation-delay: 0.55s; }
.wave-3 { animation-delay: 1.1s; }

@keyframes reader-wave-anim {
  0% { transform: scale(0.55); opacity: 0.9; }
  100% { transform: scale(1.5); opacity: 0; }
}

.reader-core {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary-800);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.reader-wait-title {
  display: block;
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--color-primary-900);
}

.reader-wait-sub {
  font-size: 0.8125rem;
  color: var(--color-primary-900);
  margin: 0.15rem 0 0;
}

.reader-cancel-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-200);
  background: #ffffff;
  color: var(--color-neutral-700);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.reader-cancel-btn:hover {
  background-color: var(--color-neutral-100);
}

/* Error */
.reader-error {
  display: flex;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.reader-error-text {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
}

.reader-error-hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: #7f1d1d;
  line-height: 1.45;
}

.reader-tech-details {
  margin-top: 0.3rem;
  font-size: 0.72rem;
  color: #b91c1c;
}

.reader-tech-details summary {
  cursor: pointer;
  font-weight: 700;
  user-select: none;
}

.reader-error-technical {
  margin: 0.2rem 0 0;
  font-size: 0.7rem;
  font-family: monospace;
  color: #b91c1c;
  opacity: 0.8;
  word-break: break-all;
  white-space: pre-wrap;
}

/* Result card */
.reader-result {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #fcfdff;
}

.reader-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.reader-kind-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
}

.kind-url { background: #e0f2fe; color: #0369a1; }
.kind-text { background: #ecfccb; color: #4d7c0f; }
.kind-unknown { background: var(--color-neutral-100); color: var(--color-neutral-700); }

.reader-timestamp {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.reader-rows {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.reader-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8125rem;
  flex-wrap: wrap;
}

.reader-row.matched {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.6rem;
}

.reader-key {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding-top: 0.1rem;
}

.reader-val {
  color: var(--color-neutral-900);
  text-align: right;
  min-width: 0;
}

.reader-url {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-primary-800);
  font-size: 0.78rem;
  text-decoration: underline;
  word-break: break-all;
}

.reader-foreign {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.7rem;
}

.reader-records {
  border-top: 1px dashed var(--border-subtle);
  padding-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.reader-seq-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.reader-record-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  flex-wrap: wrap;
}

.rec-type {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
  font-weight: 700;
  padding: 0.12rem 0.45rem;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.rec-data {
  color: var(--color-neutral-700);
  word-break: break-all;
  min-width: 0;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
