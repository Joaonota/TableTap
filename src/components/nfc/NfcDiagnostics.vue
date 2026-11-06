<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { NfcPermissionState, ParsedNfcRead } from '@/types'
import { NfcError } from '@/types'
import { nfcService, stateFromError } from '@/services/nfc/nfcService'
import { queryNfcPermissionState } from '@/services/nfc/nfcCapabilities'
import { useNfcStore } from '@/stores/nfc'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Search,
  CheckCircle2,
  XCircle,
  ShieldQuestion,
  Monitor,
  Globe,
  Cpu,
  Smartphone
} from 'lucide-vue-next'

const nfcStore = useNfcStore()

const apiSupported = computed(() => nfcService.isSupported())
const secureContext = computed(() => nfcService.isSecureContext())
const isChromium = /Chrom(e|ium)|Edg\//i.test(navigator.userAgent)
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS/i.test(navigator.userAgent)
const isSafari = /Safari/i.test(navigator.userAgent) && !isChromium
const isFirefox = /Firefox/i.test(navigator.userAgent)
const browserName = isChromium ? 'Chromium (Chrome/Edge)' : isFirefox ? 'Firefox' : isSafari ? 'Safari/WebKit' : 'Desconhecido'
const browserCompatible = computed(() => isChromium && !isIos)

const permissionState = ref<NfcPermissionState>('unknown')
const permissionLoading = ref(false)

const checksLoad = ref(false)
const opState = ref<'idle' | 'ready' | 'success' | 'failed' | 'cancelled'>('idle')
const readResult = ref<ParsedNfcRead | null>(null)
const lastError = ref<NfcError | null>(null)

const refreshPermission = async () => {
  permissionLoading.value = true
  permissionState.value = await queryNfcPermissionState()
  permissionLoading.value = false
}

const runReadTest = async () => {
  lastError.value = null
  readResult.value = null
  opState.value = 'ready'
  try {
    const read = await nfcService.readTag({ onWaiting: () => { opState.value = 'ready' } })
    readResult.value = read
    opState.value = 'success'

    const record = read.url ? nfcStore.getRecordByUrl(read.url) : undefined
    if (record) nfcStore.registerRead(record, read)
  } catch (e) {
    const err = e instanceof NfcError ? e : new NfcError('unknown', 'Erro inesperado.')
    lastError.value = err
    opState.value = err.code === 'cancelled' ? 'cancelled' : stateFromError(err) as 'failed'
  }
}

const cancelRead = () => nfcService.cancelNfcSession()

const permissionLabel = computed(() => {
  switch (permissionState.value) {
    case 'granted': return 'Concedida'
    case 'denied': return 'Recusada'
    case 'prompt': return 'Sob pedido (teste fornece gesto)'
    default: return 'Desconhecido (browser não expõe)'
  }
})

const permissionVariant = computed(() => {
  switch (permissionState.value) {
    case 'granted': return 'success' as const
    case 'denied': return 'danger' as const
    case 'prompt': return 'warning' as const
    default: return 'neutral' as const
  }
})

const formatDate = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}

onMounted(() => { void refreshPermission() })
onUnmounted(() => nfcService.cancelNfcSession())
</script>

<template>
  <div class="nfc-diagnostics">
    <!-- Matriz de suporte -->
    <div class="diag-card">
      <div class="diag-head">
        <Cpu :size="16" />
        <strong>Matriz de suporte NFC</strong>
      </div>
      <div class="support-grid">
        <div class="support-row" :class="{ ok: apiSupported, bad: !apiSupported }">
          <span class="support-icon"><component :is="apiSupported ? CheckCircle2 : XCircle" :size="15" /></span>
          <span>NFC Web API (NDEFReader)</span>
          <span class="support-val">{{ apiSupported ? 'Disponível' : 'Não disponível' }}</span>
        </div>
        <div class="support-row" :class="{ ok: secureContext, bad: !secureContext }">
          <span class="support-icon"><component :is="secureContext ? CheckCircle2 : XCircle" :size="15" /></span>
          <span>Contexto seguro (HTTPS)</span>
          <span class="support-val">{{ secureContext ? 'Ativo' : 'Inativo — página precisa de HTTPS' }}</span>
        </div>
        <div class="support-row" :class="{ ok: browserCompatible, bad: !browserCompatible }">
          <span class="support-icon"><component :is="browserCompatible ? CheckCircle2 : ShieldQuestion" :size="15" /></span>
          <span>Navegador compatível</span>
          <span class="support-val">{{ browserName }}{{ browserCompatible ? ' — compatível' : ' — Web NFC não suportado' }}</span>
        </div>
        <div class="support-row" :class="{ ok: permissionState === 'granted', warn: permissionState === 'prompt' || permissionState === 'unknown', bad: permissionState === 'denied' }">
          <span class="support-icon"><component :is="permissionState === 'granted' ? CheckCircle2 : permissionState === 'denied' ? XCircle : ShieldQuestion" :size="15" /></span>
          <span>Permissão NFC</span>
          <span class="support-val">
            {{ permissionLabel }}
            <button type="button" class="refresh-btn" :disabled="permissionLoading" @click="refreshPermission" title="Verificar novamente">↻</button>
          </span>
        </div>
        <div class="support-row ok">
          <span class="support-icon"><Smartphone :size="15" /></span>
          <span>NFC ativado no dispositivo</span>
          <span class="support-val">Verificar nas definições do telefone</span>
        </div>
      </div>

      <div class="explain-box">
        <Monitor :size="14" />
        <span>
          Web NFC está disponível apenas em navegadores baseados em Chromium (Chrome/Edge) no
          Android ou ChromeOS, com HTTPS. Safari/Firefox (incluindo iOS) NÃO suportam gravação NFC
          pelo navegador — o QR Code permanece como alternativa.
        </span>
      </div>
    </div>

    <!-- Teste de leitura -->
    <div class="diag-card">
      <div class="diag-head">
        <Search :size="16" />
        <strong>Teste de leitura NFC</strong>
      </div>

      <div v-if="opState === 'idle' || opState === 'failed' || opState === 'cancelled'" class="read-test-launch">
        <p class="read-hint">Encoste uma etiqueta NFC à parte traseira do dispositivo para lê-la.</p>
        <AppButton variant="primary" size="md" :disabled="!apiSupported || !secureContext" @click="runReadTest">
          <Search :size="16" />
          Testar etiqueta NFC
        </AppButton>
      </div>

      <div v-else-if="opState === 'ready'" class="read-waiting">
        <div class="waiting-pulse">
          <div class="pulse-ring r1"></div>
          <div class="pulse-ring r2"></div>
          <div class="pulse-core"><Search :size="24" /></div>
        </div>
        <p><strong>Aguardando etiqueta…</strong> mantenha a etiqueta encostada até à leitura completa.</p>
        <AppButton variant="secondary" size="sm" @click="cancelRead">Cancelar</AppButton>
      </div>

      <div v-else-if="opState === 'success' && readResult" class="read-result">
        <div class="result-row">
          <span class="result-key">Estado:</span>
          <AppBadge variant="success" dot>Leitura concluída</AppBadge>
        </div>
        <div class="result-row">
          <span class="result-key">Serial físico:</span>
          <span class="font-mono result-val">{{ readResult.serialNumber || 'Identificador físico não disponibilizado pelo navegador.' }}</span>
        </div>
        <div class="result-row">
          <span class="result-key">URL encontrado:</span>
          <span class="font-mono result-val">{{ readResult.url || 'Nenhum registo URL' }}</span>
        </div>
        <div class="result-row" v-if="readResult.text">
          <span class="result-key">Texto:</span>
          <span class="result-val">{{ readResult.text }}</span>
        </div>
        <div class="result-row">
          <span class="result-key">Hora da leitura:</span>
          <span class="result-val">{{ formatDate(readResult.readAt) }}</span>
        </div>
        <div class="ndef-detail" v-if="readResult.records.length > 0">
          <div class="ndef-detail-head"><Globe :size="12" /> Registos NDEF lidos</div>
          <div v-for="(rec, idx) in readResult.records" :key="idx" class="ndef-detail-row">
            <span class="font-mono">{{ rec.recordType }}{{ rec.mediaType ? ` (${rec.mediaType})` : '' }}</span>
            <span class="font-mono detail-val">{{ rec.url || rec.text || `${rec.payloadBytes} bytes` }}</span>
          </div>
        </div>
        <AppButton variant="secondary" size="sm" @click="runReadTest">Ler novamente</AppButton>
      </div>

      <div v-if="lastError" class="read-error">
        <XCircle :size="16" />
        <div>
          <strong>{{ lastError.message }}</strong>
          <span v-if="lastError.technical" class="font-mono error-tech">{{ lastError.technical }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nfc-diagnostics {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.diag-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.diag-head {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.875rem;
  color: var(--color-neutral-900);
}

.support-grid {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.support-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.7rem;
  font-size: 0.8rem;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
}

.support-icon {
  display: inline-flex;
  flex-shrink: 0;
}

.support-row.ok { color: #166534; }
.support-row.bad { color: #991b1b; }
.support-row.warn { color: #92400e; }

.support-row :deep(svg) { flex-shrink: 0; }

.support-val {
  margin-left: auto;
  font-weight: 600;
  text-align: right;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.refresh-btn {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: inherit;
  padding: 0;
}

.explain-box {
  display: flex;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  background: var(--color-neutral-50);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.8rem;
  line-height: 1.45;
}

.explain-box :deep(svg) { flex-shrink: 0; margin-top: 0.1rem; }

/* Read test */
.read-test-launch,
.read-waiting,
.read-result,
.read-error {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.read-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.waiting-pulse {
  position: relative;
  width: 92px;
  height: 92px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--color-primary-600);
  animation: wpulse 1.8s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
}

.pulse-ring.r2 { animation-delay: 0.6s; }

@keyframes wpulse {
  0% { transform: scale(0.55); opacity: 0.85; }
  100% { transform: scale(1.55); opacity: 0; }
}

.pulse-core {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--color-primary-800);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.read-waiting p {
  margin: 0;
  text-align: center;
  font-size: 0.82rem;
  color: var(--color-neutral-700);
}

.read-waiting .app-btn { align-self: center; }

.result-row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  font-size: 0.8rem;
}

.result-key {
  min-width: 110px;
  font-weight: 700;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  padding-top: 0.1rem;
}

.result-val {
  word-break: break-all;
  color: var(--color-neutral-800);
}

.ndef-detail {
  border-top: 1px dashed var(--border-subtle);
  padding-top: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ndef-detail-head {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  font-size: 0.72rem;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ndef-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.72rem;
  background: var(--color-neutral-50);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.5rem;
}

.detail-val { color: var(--color-primary-800); word-break: break-all; text-align: right; }

.read-error {
  flex-direction: row;
  align-items: flex-start;
  gap: 0.6rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  padding: 0.7rem 0.9rem;
  color: #991b1b;
  font-size: 0.8rem;
}

.error-tech {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.68rem;
  opacity: 0.85;
  word-break: break-all;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
