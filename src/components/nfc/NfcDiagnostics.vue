<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { NfcDiagnosticReport, NfcOpState, ParsedNfcRead } from '@/types'
import { NfcError } from '@/types'
import { nfcService, stateFromError } from '@/services/nfc/nfcService'
import { getAdapterAvailability } from '@/services/nfc/nfcAdapters'
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
  Smartphone,
  Radio,
  Activity,
  RefreshCw,
  ListChecks,
  AlertTriangle
} from 'lucide-vue-next'

const nfcStore = useNfcStore()

const report = ref<NfcDiagnosticReport | null>(null)
const isDiagnosing = ref(false)

const opState = ref<'idle' | 'ready' | 'success' | 'failed' | 'cancelled'>('idle')
const readResult = ref<ParsedNfcRead | null>(null)
const lastError = ref<NfcError | null>(null)

const adapterAvailability = computed(() => getAdapterAvailability())

const reportOpState = computed<NfcOpState>(() => {
  switch (opState.value) {
    case 'ready': return 'ready'
    case 'success': return 'verified'
    case 'cancelled': return 'cancelled'
    case 'failed': return 'failed'
    default: return 'idle'
  }
})

/** Executa apenas inspeção do ambiente — NUNCA grava nem lê etiquetas. */
const runDiagnostics = async () => {
  isDiagnosing.value = true
  try {
    report.value = await nfcService.getDiagnosticReport(reportOpState.value, lastError.value)
  } finally {
    isDiagnosing.value = false
  }
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
    opState.value = err.code === 'cancelled' ? 'cancelled' : 'failed'
  } finally {
    await runDiagnostics()
  }
}

const cancelRead = () => nfcService.cancelNfcSession()

const compatibilityVariant = computed(() => {
  switch (report.value?.compatibility) {
    case 'full': return 'success' as const
    case 'partial': return 'warning' as const
    case 'unsupported': return 'danger' as const
    default: return 'neutral' as const
  }
})

const compatibilityLabel = computed(() => {
  switch (report.value?.compatibility) {
    case 'full': return 'Compatível'
    case 'partial': return 'Parcialmente compatível'
    case 'unsupported': return 'Não compatível'
    default: return 'Por executar'
  }
})

const apiStateLabel = computed(() => {
  const r = report.value
  if (!r) return 'Por verificar'
  if (!r.webNfcApi) return 'NDEFReader não existe'
  if (!r.api.write) return 'API presente, escrita indisponível'
  return 'API presente'
})

const readStatusLabel = computed(() => {
  const r = report.value
  if (!r) return 'Por verificar'
  if (r.readStatus === 'available') return 'API disponível (não testada)'
  return 'Não disponível'
})

const writeStatusLabel = computed(() => {
  const r = report.value
  if (!r) return 'Por verificar'
  if (r.writeStatus !== 'available') return 'Não disponível'
  return r.writeTested ? 'Testada com sucesso nesta sessão' : 'API disponível (não testada)'
})

const browserLine = computed(() => {
  const b = report.value?.browser
  if (!b) return '—'
  return `${b.name}${b.version ? ` ${b.version}` : ''}${b.isWebView ? ' · WebView' : ''}`
})

const osLine = computed(() => {
  const o = report.value?.os
  if (!o) return '—'
  return `${o.name}${o.version ? ` ${o.version}` : ''}`
})

const deviceLine = computed(() => {
  const d = report.value?.device
  if (!d) return '—'
  const type = d.type === 'mobile' ? 'Telemóvel' : d.type === 'tablet' ? 'Tablet' : d.type === 'desktop' ? 'Desktop' : 'Desconhecido'
  return d.model ? `${type} · ${d.model}` : type
})

const operationStateLabel = computed(() => {
  switch (opState.value) {
    case 'ready': return 'A aguardar etiqueta (teste de leitura)'
    case 'success': return 'Leitura concluída'
    case 'failed': return 'Falhou'
    case 'cancelled': return 'Cancelada'
    default: return 'Inativa'
  }
})

const permissionLabel = computed(() => {
  switch (report.value?.permissionState) {
    case 'granted': return 'Concedida'
    case 'denied': return 'Recusada'
    case 'prompt': return 'Sob pedido'
    default: return 'Desconhecida (browser não expõe)'
  }
})

const formatDate = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch { return iso }
}

onMounted(() => { void runDiagnostics() })
onUnmounted(() => nfcService.cancelNfcSession())
</script>

<template>
  <div class="nfc-diagnostics">
    <!-- Diagnóstico -->
    <div class="diag-card">
      <div class="diag-head">
        <Activity :size="16" />
        <strong>Diagnóstico NFC</strong>
        <div class="diag-head-actions">
          <AppButton size="sm" variant="primary" :disabled="isDiagnosing" @click="runDiagnostics">
            <RefreshCw :size="14" :class="{ spin: isDiagnosing }" />
            Executar diagnóstico
          </AppButton>
        </div>
      </div>

      <p class="diag-caption">
        Inspeção apenas do ambiente e da API. Não lê nem grava etiquetas sem uma ação explícita sua.
      </p>

      <div v-if="report" class="compat-summary" :class="`compat-${report.compatibility}`">
        <component
          :is="report.compatibility === 'full' ? CheckCircle2 : report.compatibility === 'partial' ? ShieldQuestion : XCircle"
          :size="17"
        />
        <div>
          <strong>{{ report.compatibilitySummary }}</strong>
          <p v-if="report.lastError" class="compat-last-error">
            Último erro: {{ report.lastError.message }}
          </p>
        </div>
        <AppBadge :variant="compatibilityVariant" dot>{{ compatibilityLabel }}</AppBadge>
      </div>

      <div v-if="report" class="support-grid">
        <div class="support-row">
          <span class="support-icon"><Globe :size="15" /></span>
          <span>Navegador</span>
          <span class="support-val">{{ browserLine }}</span>
        </div>
        <div class="support-row">
          <span class="support-icon"><Monitor :size="15" /></span>
          <span>Sistema operativo</span>
          <span class="support-val">{{ osLine }}</span>
        </div>
        <div class="support-row">
          <span class="support-icon"><Smartphone :size="15" /></span>
          <span>Dispositivo</span>
          <span class="support-val">{{ deviceLine }}</span>
        </div>
        <div class="support-row" :class="{ ok: report.https, warn: !report.https }">
          <span class="support-icon"><component :is="report.https ? CheckCircle2 : XCircle" :size="15" /></span>
          <span>Contexto HTTPS</span>
          <span class="support-val">{{ report.https ? 'Ativo' : 'Não (HTTP)' }} · Contexto seguro: {{ report.secureContext ? 'sim' : 'não' }}</span>
        </div>
        <div class="support-row" :class="{ ok: report.webNfcApi, bad: !report.webNfcApi }">
          <span class="support-icon"><component :is="report.webNfcApi ? CheckCircle2 : XCircle" :size="15" /></span>
          <span>Web NFC API</span>
          <span class="support-val">{{ report.webNfcApi ? 'Disponível' : 'Não disponível' }}</span>
        </div>
        <div class="support-row" :class="{ ok: report.api.ndefReader, bad: !report.api.ndefReader }">
          <span class="support-icon"><component :is="report.api.ndefReader ? CheckCircle2 : XCircle" :size="15" /></span>
          <span>NDEFReader</span>
          <span class="support-val">{{ report.api.ndefReader ? 'Presente' : 'Ausente' }}</span>
        </div>
        <div class="support-row" :class="{ ok: report.api.scan, bad: !report.api.scan }">
          <span class="support-icon"><component :is="report.api.scan ? CheckCircle2 : XCircle" :size="15" /></span>
          <span>Leitura NDEF (scan)</span>
          <span class="support-val">{{ readStatusLabel }}</span>
        </div>
        <div class="support-row" :class="{ ok: report.api.write, bad: !report.api.write }">
          <span class="support-icon"><component :is="report.api.write ? CheckCircle2 : XCircle" :size="15" /></span>
          <span>Escrita NDEF (write)</span>
          <span class="support-val">{{ writeStatusLabel }}</span>
        </div>
        <div class="support-row warn">
          <span class="support-icon"><ShieldQuestion :size="15" /></span>
          <span>NFC físico</span>
          <span class="support-val">Não verificável pela Web NFC até operação real</span>
        </div>
        <div class="support-row" :class="{ ok: report.permissionState === 'granted', warn: report.permissionState !== 'denied', bad: report.permissionState === 'denied' }">
          <span class="support-icon"><component :is="report.permissionState === 'granted' ? CheckCircle2 : report.permissionState === 'denied' ? XCircle : ShieldQuestion" :size="15" /></span>
          <span>Permissão NFC</span>
          <span class="support-val">{{ permissionLabel }}</span>
        </div>
        <div class="support-row">
          <span class="support-icon"><Radio :size="15" /></span>
          <span>Estado da operação</span>
          <span class="support-val">{{ operationStateLabel }}</span>
        </div>
        <div class="support-row">
          <span class="support-icon"><Cpu :size="15" /></span>
          <span>Diagnóstico gerado</span>
          <span class="support-val">{{ formatDate(report.generatedAt) }}</span>
        </div>
      </div>

      <div v-if="report?.lastError" class="last-error-box">
        <XCircle :size="16" />
        <div>
          <strong>{{ report.lastError.message }}</strong>
          <details class="tech-details">
            <summary>Detalhes técnicos</summary>
            <pre class="error-tech font-mono">{{ report.lastError.technical }}</pre>
          </details>
        </div>
      </div>

      <div class="diag-columns">
        <div class="diag-list-card">
          <div class="diag-list-head"><ListChecks :size="14" /> Limitações</div>
          <ul>
            <li v-for="(item, i) in report?.limitations ?? []" :key="i">{{ item }}</li>
          </ul>
        </div>
        <div class="diag-list-card">
          <div class="diag-list-head"><CheckCircle2 :size="14" /> Recomendações</div>
          <ul>
            <li v-for="(item, i) in report?.recommendations ?? []" :key="i">{{ item }}</li>
          </ul>
        </div>
      </div>

      <div class="adapter-block">
        <div class="diag-list-head"><Radio :size="14" /> Métodos de gravação</div>
        <div v-for="adapter in adapterAvailability" :key="adapter.id" class="adapter-row">
          <span class="adapter-name">{{ adapter.label }}</span>
          <AppBadge :variant="adapter.id === 'web-nfc' && adapter.supported ? 'success' : 'neutral'">
            {{ adapter.id === 'web-nfc' && adapter.supported ? 'Disponível' : (adapter.implemented ? 'Indisponível' : 'Não implementado') }}
          </AppBadge>
          <span class="adapter-note">{{ adapter.note }}</span>
        </div>
      </div>
    </div>

    <!-- Teste de leitura -->
    <div class="diag-card">
      <div class="diag-head">
        <Search :size="16" />
        <strong>Teste de leitura NFC</strong>
      </div>

      <div v-if="opState === 'idle' || opState === 'failed' || opState === 'cancelled'" class="read-test-launch">
        <p class="read-hint">Ação explícita: encoste uma etiqueta NFC à parte traseira do dispositivo para lê-la.</p>
        <AppButton
          variant="primary"
          size="md"
          :disabled="!report?.api.scan || !report?.secureContext"
          @click="runReadTest"
        >
          <Search :size="16" />
          Testar leitura de etiqueta
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
        <AlertTriangle :size="16" />
        <div>
          <strong>{{ lastError.message }}</strong>
          <p v-if="lastError.hint" class="error-hint">{{ lastError.hint }}</p>
          <details class="tech-details">
            <summary>Detalhes técnicos</summary>
            <pre class="error-tech font-mono">{{ lastError.technical }}</pre>
          </details>
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
  flex-wrap: wrap;
}

.diag-head-actions { margin-left: auto; }

.diag-caption {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.spin { animation: diag-spin 0.9s linear infinite; }
@keyframes diag-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.compat-summary {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  border-radius: var(--radius-md);
  padding: 0.7rem 0.9rem;
  font-size: 0.8rem;
  line-height: 1.45;
}

.compat-summary :deep(svg) { flex-shrink: 0; margin-top: 0.1rem; }
.compat-summary > div { flex: 1; min-width: 0; }
.compat-summary p { margin: 0.25rem 0 0; font-size: 0.74rem; }
.compat-full { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.compat-partial { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.compat-unsupported { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

.compat-last-error { opacity: 0.85; }

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

.support-icon { display: inline-flex; flex-shrink: 0; }
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
  min-width: 0;
}

.last-error-box {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  padding: 0.7rem 0.9rem;
  color: #991b1b;
  font-size: 0.8rem;
}

.last-error-box :deep(svg) { flex-shrink: 0; margin-top: 0.1rem; }

.tech-details { margin-top: 0.3rem; font-size: 0.72rem; }
.tech-details summary { cursor: pointer; font-weight: 700; user-select: none; }

.error-tech {
  margin: 0.3rem 0 0;
  font-size: 0.68rem;
  opacity: 0.85;
  word-break: break-all;
  white-space: pre-wrap;
}

.diag-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.diag-list-card {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.7rem 0.9rem;
  background: #fcfdff;
}

.diag-list-head {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 800;
  font-size: 0.72rem;
  text-transform: uppercase;
  color: var(--color-neutral-700);
  margin-bottom: 0.4rem;
}

.diag-list-card ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.diag-list-card li {
  font-size: 0.74rem;
  line-height: 1.45;
  color: var(--color-neutral-700);
}

.adapter-block {
  border-top: 1px dashed var(--border-subtle);
  padding-top: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.adapter-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.75rem;
  flex-wrap: wrap;
}

.adapter-name { font-weight: 700; color: var(--color-neutral-800); }
.adapter-note { color: var(--text-muted); flex: 1; min-width: 180px; }

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

.error-hint { margin: 0.25rem 0 0; font-size: 0.74rem; opacity: 0.9; }

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (max-width: 720px) {
  .diag-columns { grid-template-columns: 1fr; }
  .support-val { text-align: right; }
}
</style>
