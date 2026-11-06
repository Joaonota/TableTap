<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NfcTag } from '@/types'
import { useNfcStore, HARDWARE_LOCK_NOTE } from '@/stores/nfc'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Lock,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Info
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  tag: NfcTag | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'protected', tag: NfcTag): void
  (e: 'request-write', tag: NfcTag): void
}>()

const nfcStore = useNfcStore()
const isCompleted = ref(false)

watch(
  () => props.isOpen,
  (open) => {
    if (open) isCompleted.value = false
  }
)

/**
 * Proteção aplicada apenas NO SISTEMA (registo local).
 * O bloqueio físico por hardware não é suportado pela Web NFC — o
 * aviso é apresentado de forma honesta ao utilizador.
 */
const confirmProtection = () => {
  if (!props.tag) return
  const res = nfcStore.protectRecord(props.tag.id)
  if (res.record) {
    isCompleted.value = true
    emit('protected', res.record)
  }
}

const proceedToWrite = () => {
  if (props.tag) {
    emit('request-write', props.tag)
    emit('close')
  }
}

const openMenu = () => {
  if (props.tag?.url) window.open(props.tag.url, '_blank')
}

const serialLine = (tag: NfcTag) =>
  tag.serialNumber || 'Identificador físico não disponibilizado pelo navegador.'
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="isCompleted ? 'Proteção Aplicada' : 'Proteger Etiqueta NFC'"
    :subtitle="isCompleted ? 'Proteção no sistema ativa' : 'Impedir a regravação a partir do TapMenu'"
    max-width="500px"
    @close="emit('close')"
  >
    <div v-if="tag" class="lock-modal-body">
      <!-- Confirmação -->
      <div v-if="!isCompleted" class="confirmation-view">
        <div class="warning-alert-banner">
          <div class="warning-icon-box">
            <AlertTriangle :size="24" />
          </div>
          <div class="warning-text-content">
            <h4 class="warning-title">Aplicar proteção no sistema</h4>
            <p class="warning-message">
              A etiqueta deixará de poder ser gravada a partir do TapMenu. Para voltar a gravar, será
              necessário remover a proteção em "Detalhes".
            </p>
          </div>
        </div>

        <div class="tag-summary-card">
          <div class="summary-header">
            <span class="chip-label">Etiqueta a proteger</span>
            <span class="chip-uid font-mono">{{ tag.tableNumber }}</span>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              <span class="item-label">Restaurante:</span>
              <span class="item-value">{{ tag.restaurantName }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Mesa Associada:</span>
              <span class="item-value">Mesa {{ tag.tableNumber }}</span>
            </div>

            <div class="summary-item full-width">
              <span class="item-label">URL Gravado:</span>
              <span class="item-value font-mono url-val">{{ tag.url }}</span>
            </div>

            <div class="summary-item full-width">
              <span class="item-label">Serial físico:</span>
              <span class="item-value font-mono">{{ serialLine(tag) }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Gravações:</span>
              <span class="item-value">{{ tag.writeCount }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Estado Atual:</span>
              <AppBadge variant="success">Ativa — gravação permitida</AppBadge>
            </div>
          </div>
        </div>

        <!-- Aviso honesto sobre limitação física -->
        <div class="physical-note">
          <Info :size="16" />
          <p>
            <strong>Nota técnica:</strong> {{ HARDWARE_LOCK_NOTE }} A proteção aplicada aqui é
            <strong>no sistema</strong>: o próprio chip físico continua a poder ser escrito por outras
            aplicações ou ferramentas NFC fora do TapMenu. A leitura do menu pela web não é afetada.
          </p>
        </div>
      </div>

      <!-- Sucesso -->
      <div v-else class="locked-success-view">
        <div class="success-icon-badge">
          <ShieldCheck :size="34" />
        </div>

        <h3 class="success-title">Etiqueta protegida</h3>

        <div class="protected-notice-box">
          <Lock :size="18" />
          <div class="protected-text">
            <strong>Proteção no sistema ativa</strong>
            <p>
              O TapMenu recusa gravações nesta etiqueta e registra tentativas bloqueadas no histórico.
              Os clientes podem continuar a ler o menu da Mesa {{ tag.tableNumber }} normalmente.
            </p>
          </div>
        </div>

        <div class="locked-summary-box">
          <div class="locked-row">
            <span>Estado de Gravação:</span>
            <AppBadge variant="neutral" dot>{{ tag.writeCount > 0 ? `Gravada (${tag.writeCount}×)` : 'Sem gravações' }}</AppBadge>
          </div>
          <div class="locked-row">
            <span>Proteção:</span>
            <span class="locked-badge-pill">
              <Lock :size="12" />
              Protegida (sistema)
            </span>
          </div>
          <div class="locked-row">
            <span>Leitura do menu:</span>
            <button type="button" class="link-btn" @click="openMenu">
              <ExternalLink :size="12" /> Abrir URL
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="!isCompleted">
        <AppButton variant="secondary" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="danger" @click="confirmProtection">
          <Lock :size="16" />
          Aplicar proteção
        </AppButton>
      </template>

      <template v-else>
        <AppButton variant="secondary" @click="proceedToWrite">
          <ShieldCheck :size="16" />
          Gerir etiqueta
        </AppButton>
        <AppButton variant="primary" @click="emit('close')">Concluir</AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.lock-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.warning-alert-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.125rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-lg);
  color: #991b1b;
}

.warning-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background-color: #fee2e2;
  color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.warning-text-content { flex: 1; }

.warning-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #991b1b;
  margin: 0 0 0.25rem;
}

.warning-message {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #b91c1c;
  margin: 0;
  font-weight: 500;
}

.tag-summary-card {
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 0.75rem;
}

.chip-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-neutral-600);
}

.chip-uid {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-primary-800);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem 1rem;
  font-size: 0.8125rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.summary-item.full-width { grid-column: span 2; }

.item-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 700;
}

.item-value {
  color: var(--color-neutral-900);
}

.url-val {
  font-size: 0.75rem;
  background-color: #ffffff;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  word-break: break-all;
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
  margin: 0;
}

.physical-note p { margin: 0; }

.physical-note :deep(svg) {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: var(--color-neutral-600);
}

.locked-success-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.success-icon-badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--color-primary-50);
  border: 2px solid var(--color-primary-200);
  color: var(--color-primary-800);
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.protected-notice-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-lg);
  text-align: left;
  color: #1e40af;
}

.protected-text strong {
  display: block;
  font-size: 0.9375rem;
  margin-bottom: 0.25rem;
}

.protected-text p {
  font-size: 0.8125rem;
  line-height: 1.45;
  margin: 0;
}

.locked-summary-box {
  width: 100%;
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0.875rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-size: 0.8125rem;
}

.locked-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.locked-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background-color: #eff6ff;
  color: var(--color-primary-800);
  border: 1px solid #bfdbfe;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  color: var(--color-primary-700);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}
</style>
