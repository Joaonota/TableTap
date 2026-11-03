<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NfcTag } from '@/types'
import { useNfcStore } from '@/stores/nfc'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Unlock,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  KeyRound,
  Radio
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  tag: NfcTag | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'unlocked', tag: NfcTag): void
  (e: 'request-write', tag: NfcTag): void
}>()

const nfcStore = useNfcStore()

const isUnlocking = ref(false)
const unlockProgress = ref(0)
const unlockStep = ref(0)
const unlockMessage = ref('')
const isCompleted = ref(false)
const adminPin = ref('ADMIN-NFC-2026')

const steps = [
  'A verificar credenciais de supervisor...',
  'A autenticar via PWD AUTH no circuito NTAG...',
  'A redefinir registos de proteção para Read/Write...',
  'Etiqueta desprotegida com sucesso!'
]

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      isUnlocking.value = false
      unlockProgress.value = 0
      unlockStep.value = 0
      unlockMessage.value = ''
      isCompleted.value = false
      adminPin.value = 'ADMIN-NFC-2026'
    }
  }
)

const startUnlockSimulation = () => {
  if (!props.tag) return
  isUnlocking.value = true
  unlockProgress.value = 15
  unlockStep.value = 0
  unlockMessage.value = steps[0]

  setTimeout(() => {
    unlockStep.value = 1
    unlockProgress.value = 50
    unlockMessage.value = steps[1]

    setTimeout(() => {
      unlockStep.value = 2
      unlockProgress.value = 85
      unlockMessage.value = steps[2]

      setTimeout(() => {
        unlockStep.value = 3
        unlockProgress.value = 100
        unlockMessage.value = steps[3]

        const res = nfcStore.unlockTag(props.tag!.id)
        if (res.success && res.tag) {
          isCompleted.value = true
          emit('unlocked', res.tag)
        }
      }, 700)
    }, 700)
  }, 600)
}

const handleClose = () => {
  if (isUnlocking.value && !isCompleted.value) return
  emit('close')
}

const proceedToWrite = () => {
  if (props.tag) {
    emit('request-write', props.tag)
    emit('close')
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="isCompleted ? 'Etiqueta Desprotegida' : 'Desproteger Etiqueta NFC'"
    :subtitle="isCompleted ? 'Modo Leitura e Escrita ativo' : 'Autorização de administrador para futuras alterações'"
    max-width="500px"
    :prevent-close="isUnlocking && !isCompleted"
    @close="handleClose"
  >
    <div v-if="tag" class="unlock-modal-body">
      <!-- State 1: Confirmation Form -->
      <div v-if="!isUnlocking && !isCompleted" class="confirmation-view">
        <div class="unlock-info-banner">
          <div class="unlock-icon-box">
            <Unlock :size="24" />
          </div>
          <div class="unlock-text-content">
            <h4 class="unlock-title">Remover Proteção de Escrita</h4>
            <p class="unlock-message">
              Tem a certeza de que pretende desproteger esta etiqueta? Ao remover o bloqueio, a etiqueta voltará ao modo <strong>Leitura e Escrita (Read/Write)</strong>, permitindo futuras alterações e atualizações de URL.
            </p>
          </div>
        </div>

        <div class="tag-summary-card">
          <div class="summary-header">
            <span class="chip-label">Etiqueta a Desproteger</span>
            <span class="chip-uid font-mono">{{ tag.uid }}</span>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              <span class="item-label">Restaurante:</span>
              <span class="item-value font-medium">{{ tag.restaurantName }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Mesa:</span>
              <span class="item-value font-bold">Mesa {{ tag.tableNumber }}</span>
            </div>

            <div class="summary-item full-width">
              <span class="item-label">URL Físico Atual:</span>
              <span class="item-value font-mono url-val">{{ tag.targetUrl }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Modelo:</span>
              <span class="item-value">{{ tag.tagType }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Estado Atual:</span>
              <AppBadge variant="danger">
                🔒 Bloqueada (Read-Only)
              </AppBadge>
            </div>
          </div>
        </div>

        <div class="auth-credential-box">
          <div class="cred-header">
            <KeyRound :size="15" class="text-primary" />
            <span class="cred-title">Autorização de Supervisor</span>
          </div>
          <input
            v-model="adminPin"
            type="text"
            readonly
            class="cred-input font-mono"
            title="Credencial de desbloqueio autorizada"
          />
          <span class="cred-hint">Simulação de comando PWD AUTH com chave mestre de 32 bits.</span>
        </div>
      </div>

      <!-- State 2: Unlocking Animation -->
      <div v-else-if="isUnlocking && !isCompleted" class="unlocking-animation-view">
        <div class="unlock-pulse-graphic">
          <div class="pulse-ring ring-teal-1"></div>
          <div class="pulse-ring ring-teal-2"></div>
          <div class="unlock-center-icon">
            <Unlock :size="36" class="animate-unlock" />
          </div>
        </div>

        <div class="unlocking-status-info">
          <h3 class="unlocking-title">A Desproteger Chip NFC...</h3>
          <p class="unlocking-desc">{{ unlockMessage }}</p>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar-teal" :style="{ width: `${unlockProgress}%` }"></div>
        </div>

        <div class="hex-memory-view">
          <div class="hex-line">
            <span class="hex-addr">AUTH Status:</span>
            <span class="hex-bytes" :class="{ 'bytes-unlocked': unlockStep >= 1 }">
              {{ unlockStep >= 1 ? 'PACK 0x0F0F (AUTHORIZED)' : '0x0000 (PENDING)' }}
            </span>
          </div>
          <div class="hex-line">
            <span class="hex-addr">Write Permission:</span>
            <span class="hex-bytes" :class="{ 'bytes-unlocked': unlockStep >= 2 }">
              {{ unlockStep >= 2 ? 'ENABLED (READ/WRITE UNLOCKED)' : 'PROTECTED' }}
            </span>
          </div>
        </div>
      </div>

      <!-- State 3: Success Screen -->
      <div v-else class="unlocked-success-view">
        <div class="success-icon-badge">
          <CheckCircle2 :size="38" class="text-success" />
        </div>

        <h3 class="success-title">Etiqueta Desprotegida com Sucesso!</h3>
        <p class="success-subtitle">
          A proteção de escrita da <strong>Mesa {{ tag.tableNumber }}</strong> foi removida. O chip está agora apto para receber novas gravações e atualizações.
        </p>

        <div class="unlocked-summary-box">
          <div class="unlocked-row">
            <span>UID da Etiqueta:</span>
            <strong class="font-mono">{{ tag.uid }}</strong>
          </div>
          <div class="unlocked-row">
            <span>Novo Estado:</span>
            <AppBadge variant="success">
              Desbloqueada (Gravação permitida)
            </AppBadge>
          </div>
          <div class="unlocked-row">
            <span>Permissões:</span>
            <span class="text-success font-bold">Leitura & Escrita (R/W)</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="!isUnlocking && !isCompleted">
        <AppButton variant="secondary" @click="handleClose">
          Cancelar
        </AppButton>
        <AppButton variant="primary" @click="startUnlockSimulation">
          <template #icon-left>
            <Unlock :size="16" />
          </template>
          Confirmar Desbloqueio
        </AppButton>
      </template>

      <template v-else-if="isCompleted">
        <AppButton variant="secondary" @click="proceedToWrite">
          <template #icon-left>
            <Radio :size="16" />
          </template>
          Regravar Agora
        </AppButton>

        <AppButton variant="primary" @click="handleClose">
          Concluir
        </AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.unlock-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.unlock-info-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.125rem;
  background-color: #f0fdfa;
  border: 1px solid #99f6e4;
  border-radius: var(--radius-lg);
  color: #0f766e;
}

.unlock-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background-color: #ccfbf1;
  color: #0d9488;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.unlock-text-content {
  flex: 1;
}

.unlock-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #115e59;
  margin-bottom: 0.25rem;
}

.unlock-message {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #0f766e;
  margin: 0;
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

.auth-credential-box {
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.cred-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.cred-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-700);
}

.cred-input {
  width: 100%;
  padding: 0.45rem 0.75rem;
  background-color: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--color-primary-900);
  font-weight: 600;
  outline: none;
}

.cred-hint {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

/* Animation View */
.unlocking-animation-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 0;
  gap: 1.25rem;
}

.unlock-pulse-graphic {
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
  border: 2px solid #0d9488;
  opacity: 0.6;
  animation: pulse-ring-anim 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

.ring-teal-2 {
  animation-delay: 0.6s;
  border-color: #14b8a6;
}

.unlock-center-icon {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.35);
}

.animate-unlock {
  animation: unlock-swing 0.8s ease infinite alternate;
}

@keyframes unlock-swing {
  from { transform: rotate(0deg); }
  to { transform: rotate(15deg); }
}

@keyframes pulse-ring-anim {
  0% { transform: scale(0.7); opacity: 0.8; }
  100% { transform: scale(1.4); opacity: 0; }
}

.unlocking-title {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.unlocking-desc {
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

.progress-bar-teal {
  height: 100%;
  background: linear-gradient(90deg, #14b8a6, #0d9488);
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
  color: #64748b;
  font-weight: bold;
}

.bytes-unlocked {
  color: #2dd4bf;
  text-shadow: 0 0 6px rgba(45, 212, 191, 0.4);
}

/* Success View */
.unlocked-success-view {
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
  background-color: var(--color-success-50);
  border: 2px solid var(--color-success-200);
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.success-subtitle {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
  line-height: 1.45;
  margin: 0;
}

.unlocked-summary-box {
  width: 100%;
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0.875rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-size: 0.8125rem;
  text-align: left;
}

.unlocked-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>

