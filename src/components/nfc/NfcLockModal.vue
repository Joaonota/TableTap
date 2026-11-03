<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NfcTag } from '@/types'
import { useNfcStore } from '@/stores/nfc'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Lock,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  ExternalLink,
  Flame
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  tag: NfcTag | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'locked', tag: NfcTag): void
}>()

const nfcStore = useNfcStore()

const isLocking = ref(false)
const lockProgress = ref(0)
const lockStep = ref(0)
const lockMessage = ref('')
const isCompleted = ref(false)

const steps = [
  'A aceder aos registos de configuração do chip...',
  'A queimar bits OTP estáticos e dinâmicos (Lock Bytes 02h & 03h)...',
  'A verificar proteção contra escrita por hardware...',
  'Etiqueta bloqueada com sucesso!'
]

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      isLocking.value = false
      lockProgress.value = 0
      lockStep.value = 0
      lockMessage.value = ''
      isCompleted.value = false
    }
  }
)

const startLockSimulation = () => {
  if (!props.tag) return
  isLocking.value = true
  lockProgress.value = 15
  lockStep.value = 0
  lockMessage.value = steps[0]

  setTimeout(() => {
    lockStep.value = 1
    lockProgress.value = 55
    lockMessage.value = steps[1]

    setTimeout(() => {
      lockStep.value = 2
      lockProgress.value = 85
      lockMessage.value = steps[2]

      setTimeout(() => {
        lockStep.value = 3
        lockProgress.value = 100
        lockMessage.value = steps[3]

        const res = nfcStore.lockTag(props.tag!.id)
        if (res.success && res.tag) {
          isCompleted.value = true
          emit('locked', res.tag)
        }
      }, 700)
    }, 800)
  }, 700)
}

const handleClose = () => {
  if (isLocking.value && !isCompleted.value) return
  emit('close')
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="isCompleted ? 'Etiqueta NFC Bloqueada' : 'Bloquear Etiqueta NFC'"
    :subtitle="isCompleted ? 'Proteção permanente ativada' : 'Simulação de proteção de escrita por hardware OTP'"
    max-width="500px"
    :prevent-close="isLocking && !isCompleted"
    @close="handleClose"
  >
    <div v-if="tag" class="lock-modal-body">
      <!-- State 1: Confirmation Form -->
      <div v-if="!isLocking && !isCompleted" class="confirmation-view">
        <div class="warning-alert-banner">
          <div class="warning-icon-box">
            <AlertTriangle :size="24" />
          </div>
          <div class="warning-text-content">
            <h4 class="warning-title">Operação Permanente e Irreversível</h4>
            <p class="warning-message">
              Tem a certeza de que pretende bloquear esta etiqueta? Depois do bloqueio, não será possível alterar o conteúdo gravado.
            </p>
          </div>
        </div>

        <div class="tag-summary-card">
          <div class="summary-header">
            <span class="chip-label">Dados do Chip Alvo</span>
            <span class="chip-uid font-mono">{{ tag.uid }}</span>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              <span class="item-label">Restaurante:</span>
              <span class="item-value font-medium">{{ tag.restaurantName }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Mesa Associada:</span>
              <span class="item-value font-bold">Mesa {{ tag.tableNumber }}</span>
            </div>

            <div class="summary-item full-width">
              <span class="item-label">URL Físico Gravado:</span>
              <span class="item-value font-mono url-val">{{ tag.targetUrl }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Modelo do Chip:</span>
              <span class="item-value">{{ tag.tagType }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Estado Atual:</span>
              <AppBadge :variant="tag.isLocked ? 'danger' : 'success'">
                {{ tag.isLocked ? 'Bloqueada' : 'Desbloqueada (Gravação permitida)' }}
              </AppBadge>
            </div>
          </div>
        </div>

        <div class="technical-note">
          <Cpu :size="16" class="note-icon" />
          <p>
            <strong>Como funciona o bloqueio:</strong> Simula a programação dos bytes OTP (One-Time Programmable) do circuito integrado NTAG. Uma vez selado, os leitores e smartphones só poderão ler a etiqueta, rejeitando qualquer tentativa de sobrescrita.
          </p>
        </div>
      </div>

      <!-- State 2: Burning / Locking Animation -->
      <div v-else-if="isLocking && !isCompleted" class="locking-animation-view">
        <div class="lock-pulse-graphic">
          <div class="pulse-ring ring-1"></div>
          <div class="pulse-ring ring-2"></div>
          <div class="lock-center-icon">
            <Flame v-if="lockStep === 1" :size="36" class="animate-burn" />
            <Lock v-else :size="36" class="animate-lock" />
          </div>
        </div>

        <div class="locking-status-info">
          <h3 class="locking-title">A Selar Memória do Chip NFC...</h3>
          <p class="locking-desc">{{ lockMessage }}</p>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: `${lockProgress}%` }"></div>
        </div>

        <div class="hex-memory-view">
          <div class="hex-line">
            <span class="hex-addr">Page 02h [Lock Bytes]:</span>
            <span class="hex-bytes" :class="{ 'bytes-burned': lockStep >= 1 }">
              {{ lockStep >= 1 ? '0xFF 0xFF (OTP LOCKED)' : '0x00 0x00 (UNLOCKED)' }}
            </span>
          </div>
          <div class="hex-line">
            <span class="hex-addr">Page E2h [Dyn Lock]:</span>
            <span class="hex-bytes" :class="{ 'bytes-burned': lockStep >= 2 }">
              {{ lockStep >= 2 ? '0x0F 0x00 (READ ONLY)' : '0x00 0x00 (READ/WRITE)' }}
            </span>
          </div>
        </div>
      </div>

      <!-- State 3: Final Locked Success Confirmation -->
      <div v-else class="locked-success-view">
        <div class="success-icon-badge">
          <Lock :size="34" class="locked-check-icon" />
        </div>

        <h3 class="success-title">Etiqueta Bloqueada com Sucesso</h3>
        
        <!-- Requirement message -->
        <div class="protected-notice-box">
          <ShieldCheck :size="20" class="text-danger" />
          <div class="protected-text">
            <strong>Etiqueta protegida — alterações não permitidas</strong>
            <p>O chip NTAG foi selado em modo Apenas Leitura (Read-Only). O URL do menu da Mesa {{ tag.tableNumber }} está blindado contra alterações.</p>
          </div>
        </div>

        <div class="locked-summary-box">
          <div class="locked-row">
            <span>UID da Etiqueta:</span>
            <strong class="font-mono">{{ tag.uid }}</strong>
          </div>
          <div class="locked-row">
            <span>Estado de Gravação:</span>
            <AppBadge variant="success">Gravada e Verificada</AppBadge>
          </div>
          <div class="locked-row">
            <span>Estado de Bloqueio:</span>
            <span class="locked-badge-pill">
              <Lock :size="12" />
              Bloqueada Permanente
            </span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="!isLocking && !isCompleted">
        <AppButton variant="secondary" @click="handleClose">
          Cancelar
        </AppButton>
        <AppButton variant="danger" @click="startLockSimulation">
          <template #icon-left>
            <Lock :size="16" />
          </template>
          Confirmar Bloqueio Permanente
        </AppButton>
      </template>

      <template v-else-if="isCompleted">
        <AppButton variant="primary" @click="handleClose">
          Concluir
        </AppButton>
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

/* Warning alert */
.warning-alert-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.125rem;
  background-color: var(--color-warning-50);
  border: 1px solid #fde68a;
  border-radius: var(--radius-lg);
  color: #92400e;
}

.warning-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background-color: #fef3c7;
  color: #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.warning-text-content {
  flex: 1;
}

.warning-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #92400e;
  margin-bottom: 0.25rem;
}

.warning-message {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #78350f;
  margin: 0;
  font-weight: 500;
}

/* Summary Card */
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

.summary-item.full-width {
  grid-column: span 2;
}

.item-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: uppercase;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.technical-note {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-neutral-100);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--color-neutral-700);
  line-height: 1.45;
}

.note-icon {
  color: var(--color-neutral-600);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

/* Locking Animation View */
.locking-animation-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 0;
  gap: 1.25rem;
}

.lock-pulse-graphic {
  position: relative;
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid #ef4444;
  opacity: 0.6;
  animation: pulse-ring-anim 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

.pulse-ring.ring-2 {
  animation-delay: 0.6s;
  border-color: #f59e0b;
}

.lock-center-icon {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

@keyframes pulse-ring-anim {
  0% {
    transform: scale(0.7);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

.animate-burn {
  animation: flicker 0.6s ease-in-out infinite alternate;
}

@keyframes flicker {
  from { transform: scale(0.95); opacity: 0.85; }
  to { transform: scale(1.05); opacity: 1; }
}

.animate-lock {
  animation: lock-bounce 0.8s ease infinite alternate;
}

@keyframes lock-bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-2px); }
}

.locking-title {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.locking-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: var(--color-neutral-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  transition: width 0.4s ease;
  border-radius: var(--radius-full);
}

.hex-memory-view {
  width: 100%;
  background-color: #0f172a;
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  font-family: monospace;
  font-size: 0.75rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hex-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hex-addr {
  color: #94a3b8;
}

.hex-bytes {
  color: #38bdf8;
  font-weight: bold;
}

.bytes-burned {
  color: #f87171;
  text-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
}

/* Success View */
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
  background-color: #fef2f2;
  border: 2px solid #fecaca;
  color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.protected-notice-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background-color: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-lg);
  text-align: left;
  color: #991b1b;
}

.protected-text strong {
  display: block;
  font-size: 0.9375rem;
  margin-bottom: 0.25rem;
  color: #991b1b;
}

.protected-text p {
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #b91c1c;
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
  background-color: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}
</style>

