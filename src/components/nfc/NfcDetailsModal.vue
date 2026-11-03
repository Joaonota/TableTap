<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NfcTag } from '@/types'
import { useNfcStore } from '@/stores/nfc'
import { useToastStore } from '@/stores/toast'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import NfcTimelineView from './NfcTimelineView.vue'
import {
  Radio,
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Clock,
  Cpu,
  Layers,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  History,
  RotateCcw,
  Sliders,
  Check
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
const isCopiedUid = ref(false)
const isCopiedUrl = ref(false)
const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tapmenu.co.mz'

const copyUid = () => {
  if (!props.tag) return
  navigator.clipboard.writeText(props.tag.uid)
  isCopiedUid.value = true
  toastStore.success('UID Copiado!', props.tag.uid)
  setTimeout(() => {
    isCopiedUid.value = false
  }, 2000)
}

const copyUrl = () => {
  if (!props.tag) return
  const full = props.tag.ndefPayload || `${window.location.origin}${props.tag.targetUrl}`
  navigator.clipboard.writeText(full)
  isCopiedUrl.value = true
  toastStore.success('URL Copiado!', full)
  setTimeout(() => {
    isCopiedUrl.value = false
  }, 2000)
}

const formatDate = (iso?: string) => {
  if (!iso) return 'Não registado'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return iso
  }
}

// Generate demonstrative raw hex bytes for NDEF representation
const demonstrativeHexBytes = computed(() => {
  if (!props.tag || props.tag.status === 'unprogrammed') {
    return '00 00 00 00 (Memória Virgem / Formatada)'
  }
  const prefix = '03 40 D1 01 3C 55 04'
  const slugBytes = '74 61 70 6D 65 6E 75 2E 63 6F 2E 6D 7A 2F 6D 65 6E 75'
  return `${prefix} ${slugBytes} FE 00 00`
})

// Trigger a test of the protection on a locked tag
const simulateProtectedModificationAttempt = () => {
  if (!props.tag) return
  nfcStore.recordRefusedModification(
    props.tag.id,
    'Tentativa de alteração recusada: O chip NFC está bloqueado e protegido contra escrita. Alteração impedida pelo sistema.',
    'Terminal do Garçom (Simulado)'
  )
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="`Etiqueta NFC — Mesa ${tag?.tableNumber || ''}`"
    subtitle="Especificações de hardware, payload NDEF e auditoria de segurança"
    max-width="640px"
    @close="$emit('close')"
  >
    <div v-if="tag" class="details-modal-wrapper">
      <!-- Top Pill Tabs -->
      <div class="tabs-nav">
        <button
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'details' }"
          @click="activeTab = 'details'"
        >
          <Cpu :size="16" />
          <span>Especificações & NDEF</span>
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

      <!-- Tab 1: Details & NDEF -->
      <div v-if="activeTab === 'details'" class="tab-pane">
        <!-- Status & Locking Header Banner -->
        <div
          class="status-feature-card"
          :class="{ 'card-locked': tag.isLocked, 'card-unlocked': !tag.isLocked }"
        >
          <div class="status-feature-left">
            <div class="feature-icon-box">
              <Lock v-if="tag.isLocked" :size="24" />
              <Unlock v-else :size="24" />
            </div>
            <div>
              <div class="status-badge-row">
                <span class="status-badge-main">
                  {{ tag.isLocked ? 'Etiqueta Bloqueada' : tag.status === 'programmed' ? 'Etiqueta Gravada' : 'Etiqueta Virgem' }}
                </span>
                <span class="status-mode-pill">
                  {{ tag.isLocked ? 'Read-Only Permanente' : 'Read/Write Aberto' }}
                </span>
              </div>
              <p v-if="tag.isLocked" class="locked-text-highlight">
                <strong>Etiqueta protegida — alterações não permitidas</strong>
              </p>
              <p v-else class="unlocked-text-highlight">
                Gravação ativa. Pode atualizar o URL ou bloquear o chip permanentemente.
              </p>
            </div>
          </div>

          <div class="status-feature-actions">
            <!-- If locked: allow unprotecting or test rejection -->
            <button
              v-if="tag.isLocked"
              class="btn-sm-unlock"
              title="Remover proteção de escrita para permitir alterações"
              @click="$emit('request-unlock', tag)"
            >
              <Unlock :size="14" />
              <span>Desproteger NFC</span>
            </button>

            <button
              v-if="tag.isLocked"
              class="btn-sm-test-reject"
              title="Testar proteção contra alterações"
              @click="simulateProtectedModificationAttempt"
            >
              <ShieldAlert :size="14" />
              <span>Testar Recusa</span>
            </button>

            <!-- If programmed and unlocked: quick lock button -->
            <AppButton
              v-else-if="tag.status === 'programmed'"
              size="sm"
              variant="warning"
              @click="$emit('request-lock', tag)"
            >
              <template #icon-left>
                <Lock :size="14" />
              </template>
              Bloquear NFC
            </AppButton>

            <!-- If unprogrammed: write button -->
            <AppButton
              v-else
              size="sm"
              variant="primary"
              @click="$emit('request-write', tag)"
            >
              <template #icon-left>
                <Radio :size="14" />
              </template>
              Gravar NFC
            </AppButton>
          </div>
        </div>

        <!-- Hardware & Table Associations Card -->
        <div class="specs-grid">
          <div class="spec-card">
            <span class="spec-label">Identificador UID Físico</span>
            <div class="spec-val-row">
              <strong class="font-mono text-primary">{{ tag.uid }}</strong>
              <button class="btn-copy-chip" title="Copiar UID" @click="copyUid">
                <Check v-if="isCopiedUid" :size="13" class="text-success" />
                <Copy v-else :size="13" />
              </button>
            </div>
            <span class="spec-hint">ISO/IEC 14443-3A 7-Byte Cascade</span>
          </div>

          <div class="spec-card">
            <span class="spec-label">Restaurante & Mesa</span>
            <div class="spec-val-row">
              <strong class="text-dark">{{ tag.restaurantName }}</strong>
            </div>
            <span class="spec-hint font-bold text-primary">Mesa {{ tag.tableNumber }}</span>
          </div>

          <div class="spec-card">
            <span class="spec-label">Modelo do Chip Integrado</span>
            <div class="spec-val-row">
              <strong>{{ tag.tagType }}</strong>
            </div>
            <span class="spec-hint">Frequência RF: 13.56 MHz (HF)</span>
          </div>

          <div class="spec-card">
            <span class="spec-label">Total de Leituras Registadas</span>
            <div class="spec-val-row">
              <strong class="text-success">{{ tag.scanCount || 0 }} leituras</strong>
            </div>
            <span class="spec-hint">Último scan: {{ formatDate(tag.lastScannedAt) }}</span>
          </div>
        </div>

        <!-- NDEF Demonstrative Content -->
        <div class="ndef-content-box">
          <div class="ndef-header">
            <span class="ndef-title">
              <FileCode :size="15" />
              Conteúdo NDEF Demonstrativo (NFC Data Exchange Format)
            </span>
            <span class="ndef-tag-badge">NFC Forum Type 2</span>
          </div>

          <div class="ndef-body">
            <div class="ndef-field">
              <span class="ndef-key">URL Gravado:</span>
              <div class="ndef-url-row">
                <span class="ndef-url-text font-mono">
                  {{ tag.ndefPayload || `${originUrl}${tag.targetUrl}` }}
                </span>
                <button class="btn-copy-chip" title="Copiar URL" @click="copyUrl">
                  <Check v-if="isCopiedUrl" :size="13" class="text-success" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <div class="ndef-meta-grid">
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Tipo de Registo:</span>
                <span class="ndef-meta-val">URI (Well-Known RTD: 0x55)</span>
              </div>
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Prefixo URI:</span>
                <span class="ndef-meta-val font-mono">{{ tag.ndefPrefix || '0x04 (https://)' }}</span>
              </div>
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Tamanho Estimado:</span>
                <span class="ndef-meta-val font-mono">{{ tag.ndefSize || 64 }} Bytes</span>
              </div>
              <div class="ndef-meta-item">
                <span class="ndef-meta-label">Codificação:</span>
                <span class="ndef-meta-val">UTF-8 / US-ASCII</span>
              </div>
            </div>

            <div class="ndef-raw-preview">
              <span class="raw-title">Bytes Hexadecimais no Chip (Páginas 04 a 19):</span>
              <div class="raw-hex-code font-mono">{{ demonstrativeHexBytes }}</div>
            </div>
          </div>
        </div>

        <!-- Timestamps History Table -->
        <div class="operations-log-box">
          <div class="log-row">
            <span class="log-label">
              <Clock :size="13" />
              Data de Criação da Tag:
            </span>
            <span class="log-time">{{ formatDate(tag.createdAt) }}</span>
          </div>
          <div class="log-row">
            <span class="log-label">
              <Radio :size="13" />
              Data da Última Gravação:
            </span>
            <span class="log-time">{{ formatDate(tag.writtenAt) }}</span>
          </div>
          <div class="log-row">
            <span class="log-label">
              <Lock :size="13" />
              Data de Bloqueio OTP:
            </span>
            <span class="log-time font-bold" :class="tag.isLocked ? 'text-danger' : 'text-muted'">
              {{ tag.isLocked ? formatDate(tag.lockedAt) : 'Desbloqueada (Não bloqueada)' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Tab 2: Timeline View -->
      <div v-else class="tab-pane">
        <NfcTimelineView :events="tag.timeline" />
      </div>
    </div>

    <template #footer>
      <div class="details-footer-row">
        <!-- Test URL Button -->
        <a
          v-if="tag?.targetUrl"
          :href="tag.targetUrl"
          target="_blank"
          class="app-btn app-btn--secondary app-btn--md"
          title="Abrir menu digital correspondente"
        >
          <ExternalLink :size="16" />
          <span>Testar URL</span>
        </a>

        <!-- Action if locked: Unprotect button -->
        <AppButton
          v-if="tag && tag.isLocked"
          variant="primary"
          @click="$emit('request-unlock', tag)"
        >
          <template #icon-left>
            <Unlock :size="16" />
          </template>
          Desproteger NFC
        </AppButton>

        <!-- Secondary Action: Lock or Write depending on state -->
        <AppButton
          v-else-if="tag && !tag.isLocked && tag.status === 'programmed'"
          variant="warning"
          @click="$emit('request-lock', tag)"
        >
          <template #icon-left>
            <Lock :size="16" />
          </template>
          Bloquear NFC
        </AppButton>

        <AppButton
          v-else-if="tag && !tag.isLocked && tag.status === 'unprogrammed'"
          variant="primary"
          @click="$emit('request-write', tag)"
        >
          <template #icon-left>
            <Radio :size="16" />
          </template>
          Gravar NFC
        </AppButton>

        <!-- Close Button -->
        <AppButton variant="secondary" @click="$emit('close')">
          Fechar
        </AppButton>
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

/* Tabs */
.tabs-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0.5rem;
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

/* Status Feature Card */
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
  font-size: 0.8125rem;
  color: #b91c1c;
  margin: 0;
}

.unlocked-text-highlight {
  font-size: 0.8125rem;
  color: #15803d;
  margin: 0;
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

/* Specs Grid */
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

.spec-hint {
  font-size: 0.75rem;
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
}

.btn-copy-chip:hover {
  color: var(--color-neutral-900);
}

/* NDEF Box */
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
}

.ndef-meta-label {
  color: var(--text-muted);
}

.ndef-meta-val {
  font-weight: 600;
  color: var(--color-neutral-800);
}

.ndef-raw-preview {
  margin-top: 0.25rem;
  background-color: #0f172a;
  border-radius: var(--radius-sm);
  padding: 0.625rem 0.875rem;
}

.raw-title {
  display: block;
  font-size: 0.6875rem;
  color: #94a3b8;
  margin-bottom: 0.25rem;
}

.raw-hex-code {
  font-size: 0.6875rem;
  color: #38bdf8;
  letter-spacing: 0.05em;
  word-break: break-all;
}

/* Operations Log Box */
.operations-log-box {
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.75rem;
}

.log-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.log-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-muted);
}

.log-time {
  color: var(--color-neutral-800);
  font-variant-numeric: tabular-nums;
}

.details-footer-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}

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
</style>
