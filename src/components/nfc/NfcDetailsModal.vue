<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NfcTag } from '@/types'
import { NfcError } from '@/types'
import { useNfcStore, HARDWARE_LOCK_NOTE } from '@/stores/nfc'
import { useToastStore } from '@/stores/toast'
import { nfcService } from '@/services/nfc/nfcService'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import NfcTimelineView from './NfcTimelineView.vue'
import NFCVerification from './NFCVerification.vue'
import {
  Radio,
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Clock,
  Cpu,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  History,
  Check,
  Search,
  Info
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  tag: NfcTag | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'request-write', tag: NfcTag): void
  (e: 'request-lock', tag: NfcTag): void
  (e: 'request-unlock', tag: NfcTag): void
}>()

const nfcStore = useNfcStore()
const toastStore = useToastStore()

const activeTab = ref<'details' | 'timeline'>('details')
const isCopiedSerial = ref(false)
const isCopiedUrl = ref(false)

// Verificação REAL (nova leitura + comparação)
const verifying = ref(false)
const verifyState = ref<'idle' | 'verifying' | 'verified' | 'different' | 'no_url' | 'verify_failed' | 'cancelled'>('idle')
const verifyFoundUrl = ref<string | null>(null)
const verifyTechnical = ref<string | null>(null)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      activeTab.value = 'details'
      isCopiedSerial.value = false
      isCopiedUrl.value = false
      verifying.value = false
      verifyState.value = 'idle'
      verifyFoundUrl.value = null
      verifyTechnical.value = null
    }
  }
)

const serialLine = (tag: NfcTag) =>
  tag.serialNumber || 'Identificador físico não disponibilizado pelo navegador.'

const copySerial = () => {
  if (!props.tag?.serialNumber) {
    toastStore.info('Sem serial físico', 'O navegador não disponibilizou o identificador da etiqueta.')
    return
  }
  navigator.clipboard.writeText(props.tag.serialNumber)
  isCopiedSerial.value = true
  toastStore.success('Serial copiado!', props.tag.serialNumber)
  setTimeout(() => { isCopiedSerial.value = false }, 2000)
}

const copyUrl = () => {
  if (!props.tag?.url) return
  navigator.clipboard.writeText(props.tag.url)
  isCopiedUrl.value = true
  toastStore.success('URL copiado!', props.tag.url)
  setTimeout(() => { isCopiedUrl.value = false }, 2000)
}

const formatDate = (iso?: string) => {
  if (!iso) return 'Não registado'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch {
    return iso
  }
}

/** Teste real da proteção do sistema: a recusa é registrada no histórico. */
const simulateProtectedModificationAttempt = () => {
  if (!props.tag) return
  nfcStore.recordBlockedAttempt(
    props.tag.id,
    'Tentativa de alteração recusada: etiqueta protegida contra alterações (proteção no sistema).'
  )
}

/** Leitura + verificação REAL: encoste a etiqueta para confirmar o conteúdo. */
const runReadAndVerify = async () => {
  const tag = props.tag
  if (!tag?.url) return
  verifying.value = true
  verifyState.value = 'verifying'
  verifyTechnical.value = null
  try {
    const result = await nfcService.verifyUrl(tag.url)
    verifyFoundUrl.value = result.foundUrl
    verifyState.value = result.status
    nfcStore.registerVerify(tag, result.status, result.foundUrl)
  } catch (e) {
    const err = e instanceof NfcError
      ? e
      : new NfcError('unknown', 'Falha na verificação.')
    if (err.code === 'cancelled') {
      verifyState.value = 'cancelled'
    } else {
      verifyState.value = 'verify_failed'
      verifyTechnical.value = err.technical
      toastStore.error('Verificação falhou', err.message)
    }
  } finally {
    verifying.value = false
  }
}

const statusLabel = (tag: NfcTag) => {
  switch (tag.status) {
    case 'protected': return 'Protegida (sistema)'
    case 'active': return 'Ativa'
    case 'failed': return 'Falha na última gravação'
    case 'unassigned': return 'Não gravada'
    default: return '—'
  }
}

const statusVariant = (tag: NfcTag) => {
  switch (tag.status) {
    case 'protected': return 'danger' as const
    case 'active': return 'success' as const
    case 'failed': return 'warning' as const
    case 'unassigned': return 'neutral' as const
    default: return 'neutral' as const
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="`Etiqueta NFC — Mesa ${tag?.tableNumber || ''}`"
    subtitle="Especificações reais do registo, verificação física e auditoria"
    max-width="640px"
    @close="emit('close')"
  >
    <div v-if="tag" class="details-modal-wrapper">
      <!-- Tabs -->
      <div class="tabs-nav">
        <button
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'details' }"
          @click="activeTab = 'details'"
        >
          <Cpu :size="16" />
          <span>Detalhes & NDEF</span>
        </button>

        <button
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'timeline' }"
          @click="activeTab = 'timeline'"
        >
          <History :size="16" />
          <span>Histórico & Linha Temporal</span>
          <span class="tab-badge">{{ tag.timeline.length }}</span>
        </button>
      </div>

      <!-- Tab: Detalhes -->
      <div v-if="activeTab === 'details'" class="tab-pane">
        <!-- Estado -->
        <div
          class="status-feature-card"
          :class="{ 'card-locked': tag.status === 'protected', 'card-unlocked': tag.status !== 'protected' }"
        >
          <div class="status-feature-left">
            <div class="feature-icon-box">
              <Lock v-if="tag.status === 'protected'" :size="24" />
              <Unlock v-else :size="24" />
            </div>
            <div>
              <div class="status-badge-row">
                <span class="status-badge-main">
                  {{ statusLabel(tag) }}
                </span>
                <span class="status-mode-pill">
                  {{ tag.status === 'protected' ? 'Protegida (sistema)' : tag.lastWrittenAt ? 'Gravação permitida' : 'Sem conteúdo físico confirmado' }}
                </span>
              </div>
              <p v-if="tag.status === 'protected'" class="locked-text-highlight">
                <strong>Etiqueta protegida — alterações não permitidas.</strong>
                Clientes continuam a ler o menu normalmente; a gravação pelo TapMenu está bloqueada.
              </p>
              <p v-else class="unlocked-text-highlight">
                Gravação permitida. {{ tag.lastWrittenAt ? 'Pode atualizar o URL ou aplicar proteção.' : 'Encoste um etiqueta com "Gravar NFC" para registar o conteúdo físico.' }}
              </p>
            </div>
          </div>

          <div class="status-feature-actions">
            <button
              v-if="tag.status === 'protected'"
              class="btn-sm-unlock"
              title="Remover proteção para permitir alterações"
              @click="emit('request-unlock', tag)"
            >
              <Unlock :size="14" />
              <span>Desproteger</span>
            </button>

            <button
              v-if="tag.status === 'protected'"
              class="btn-sm-test-reject"
              title="Testar recusa de gravação (registrada no histórico)"
              @click="simulateProtectedModificationAttempt"
            >
              <ShieldAlert :size="14" />
              <span>Testar Recusa</span>
            </button>

            <AppButton
              v-else
              size="sm"
              variant="warning"
              @click="emit('request-lock', tag)"
            >
              <Lock :size="14" />
              Proteger
            </AppButton>
          </div>
        </div>

        <!-- Specs -->
        <div class="specs-grid">
          <div class="spec-card">
            <span class="spec-label">Serial físico (browser)</span>
            <div class="spec-val-row">
              <strong class="font-mono text-primary serial-text">{{ serialLine(tag) }}</strong>
              <button class="btn-copy-chip" title="Copiar serial" :disabled="!tag.serialNumber" @click="copySerial">
                <Check v-if="isCopiedSerial" :size="13" class="text-success" />
                <Copy v-else :size="13" />
              </button>
            </div>
            <span class="spec-hint">Fornecido pelo Web NFC quando disponível — nunca inventado</span>
          </div>

          <div class="spec-card">
            <span class="spec-label">Restaurante & Mesa</span>
            <div class="spec-val-row">
              <strong class="text-dark">{{ tag.restaurantName }}</strong>
            </div>
            <span class="spec-hint font-bold text-primary">Mesa {{ tag.tableNumber }}{{ tag.tableArea ? ` · ${tag.tableArea}` : '' }}</span>
          </div>

          <div class="spec-card">
            <span class="spec-label">Estado do registo</span>
            <div class="spec-val-row">
              <AppBadge :variant="statusVariant(tag)" dot>{{ statusLabel(tag) }}</AppBadge>
            </div>
            <span class="spec-hint">Proteção: {{ tag.protection === 'system' ? 'protegida no sistema' : 'nenhuma' }}</span>
          </div>

          <div class="spec-card">
            <span class="spec-label">Gravações físicas</span>
            <div class="spec-val-row">
              <strong class="text-success">{{ tag.writeCount }}</strong>
            </div>
            <span class="spec-hint">Tipo NDEF: {{ tag.ndefType }}</span>
          </div>
        </div>

        <!-- NDEF content -->
        <div class="ndef-content-box">
          <div class="ndef-header">
            <span class="ndef-title">
              <FileCode :size="15" />
              Conteúdo NDEF recomendado (URL)
            </span>
            <span class="ndef-tag-badge">URI (Well-Known RTD)</span>
          </div>

          <div class="ndef-body">
            <div class="ndef-field">
              <span class="ndef-key">URL Gravado:</span>
              <div class="ndef-url-row">
                <span class="ndef-url-text font-mono">
                  {{ tag.url || '—' }}
                </span>
                <button v-if="tag.url" class="btn-copy-chip" title="Copiar URL" @click="copyUrl">
                  <Check v-if="isCopiedUrl" :size="13" class="text-success" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <div class="ndef-meta-grid">
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Última gravação:</span>
                <span class="ndef-meta-val">{{ formatDate(tag.lastWrittenAt) }}</span>
              </div>
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Última verificação:</span>
                <span class="ndef-meta-val">{{ formatDate(tag.lastVerifiedAt) }}</span>
              </div>
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Criado em:</span>
                <span class="ndef-meta-val">{{ formatDate(tag.createdAt) }}</span>
              </div>
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Última operação:</span>
                <span class="ndef-meta-val">{{ tag.lastOperation ? `${tag.lastOperation} · ${formatDate(tag.lastOperationAt)}` : '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Verificação real -->
        <div class="verify-section">
          <div class="verify-head">
            <span class="verify-title">
              <Search :size="15" />
              Verificação física (leitura real)
            </span>
            <AppButton
              size="sm"
              variant="secondary"
              :disabled="!tag.url || verifying"
              :loading="verifying"
              @click="runReadAndVerify"
            >
              <Search :size="14" />
              Ler & Verificar
            </AppButton>
          </div>

          <NFCVerification
            v-if="tag.url && verifyState !== 'idle'"
            :state="verifyState"
            :expected-url="tag.url"
            :found-url="verifyFoundUrl"
            :technical="verifyTechnical"
          />
          <p v-else class="verify-hint">
            Lê o conteúdo físico da etiqueta e compara o URL com o esperado — a leitura confirma apenas conteúdo real.
          </p>
        </div>

        <!-- Proteção honesta -->
        <div class="physical-note">
          <Info :size="16" />
          <p>
            <strong>Nota técnica:</strong> {{ HARDWARE_LOCK_NOTE }} A proteção significa que o
            TapMenu recusa gravar nesta etiqueta e registra tentativas bloqueadas.
          </p>
        </div>
      </div>

      <!-- Tab: Timeline -->
      <div v-else class="tab-pane">
        <NfcTimelineView :events="tag.timeline" />
      </div>
    </div>

    <template #footer>
      <div class="details-footer-row">
        <a
          v-if="tag?.url"
          :href="tag.url"
          target="_blank"
          rel="noopener"
          class="app-btn app-btn--secondary app-btn--md"
          title="Abrir menu digital correspondente"
        >
          <ExternalLink :size="16" />
          <span>Testar URL</span>
        </a>

        <AppButton
          v-if="tag && tag.status === 'protected'"
          variant="primary"
          @click="emit('request-unlock', tag)"
        >
          <Unlock :size="16" />
          Desproteger
        </AppButton>

        <AppButton
          v-else-if="tag"
          variant="primary"
          @click="emit('request-write', tag)"
        >
          <Radio :size="16" />
          {{ tag.lastWrittenAt ? 'Regravar NFC' : 'Gravar NFC' }}
        </AppButton>

        <AppButton
          v-if="tag && tag.status !== 'protected'"
          variant="warning"
          @click="emit('request-lock', tag)"
        >
          <Lock :size="16" />
          Proteger
        </AppButton>

        <AppButton variant="secondary" @click="emit('close')">Fechar</AppButton>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.details-modal-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tabs-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-neutral-600);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.tab-btn.is-active {
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  border-color: var(--color-primary-200);
}

.tab-badge {
  font-size: 0.6875rem;
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-700);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-full);
}

.tab-btn.is-active .tab-badge {
  background-color: var(--color-primary-800);
  color: #ffffff;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Status card */
.status-feature-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.125rem;
  border-radius: var(--radius-lg);
  gap: 1rem;
  flex-wrap: wrap;
}

.card-locked {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.card-unlocked {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.status-feature-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.feature-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-locked .feature-icon-box {
  background-color: #fee2e2;
  color: #dc2626;
}

.card-unlocked .feature-icon-box {
  background-color: #dcfce7;
  color: #16a34a;
}

.status-badge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
}

.status-badge-main {
  font-size: 0.9375rem;
  font-weight: 800;
}

.status-mode-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
  background-color: rgba(0, 0, 0, 0.06);
}

.locked-text-highlight {
  font-size: 0.78rem;
  color: #b91c1c;
  margin: 0;
}

.unlocked-text-highlight {
  font-size: 0.78rem;
  color: #15803d;
  margin: 0;
}

.status-feature-actions {
  display: inline-flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-sm-unlock {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 700;
  background-color: #ccfbf1;
  border: 1px solid #99f6e4;
  color: #0f766e;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-sm-unlock:hover {
  background-color: #99f6e4;
  color: #115e59;
}

.btn-sm-test-reject {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 700;
  background-color: #fee2e2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-sm-test-reject:hover {
  background-color: #fca5a5;
  color: #7f1d1d;
}

/* Specs */
.specs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.spec-card {
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.spec-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text-muted);
}

.spec-val-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.serial-text {
  font-size: 0.75rem;
}

.spec-hint {
  font-size: 0.72rem;
  color: var(--color-neutral-600);
}

.btn-copy-chip {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-neutral-500);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem;
}

.btn-copy-chip:hover:not(:disabled) {
  color: var(--color-neutral-900);
}

.btn-copy-chip:disabled {
  opacity: 0.4;
  cursor: default;
}

/* NDEF box */
.ndef-content-box {
  background-color: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
}

.ndef-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 0.75rem;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ndef-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.ndef-tag-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  background-color: var(--color-neutral-100);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
}

.ndef-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ndef-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ndef-key {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ndef-url-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.65rem;
}

.ndef-url-text {
  font-size: 0.75rem;
  color: var(--color-primary-800);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ndef-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem 1rem;
  font-size: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-subtle);
}

.ndef-meta-item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.ndef-meta-label {
  color: var(--text-muted);
}

.ndef-meta-val {
  font-weight: 600;
  color: var(--color-neutral-800);
  text-align: right;
}

/* Verificação */
.verify-section {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #fcfdff;
}

.verify-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.verify-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.verify-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.physical-note {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-neutral-100);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--color-neutral-700);
  line-height: 1.5;
}

.physical-note p { margin: 0; }

.physical-note :deep(svg) {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: var(--color-neutral-600);
}

.details-footer-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
  flex-wrap: wrap;
}

.text-muted { color: var(--text-muted); }
.text-primary { color: var(--color-primary-800); }
.text-dark { color: var(--color-neutral-900); }
.text-success { color: #16a34a; }

@media (max-width: 640px) {
  .specs-grid {
    grid-template-columns: 1fr;
  }

  .status-feature-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .ndef-meta-grid {
    grid-template-columns: 1fr;
  }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
