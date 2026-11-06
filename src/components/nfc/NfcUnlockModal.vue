<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NfcTag } from '@/types'
import { useNfcStore } from '@/stores/nfc'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Unlock, CheckCircle2, Radio } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  tag: NfcTag | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'unprotected', tag: NfcTag): void
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

/** Remove a proteção do sistema — passa a permitir regravação via wizard. */
const confirmUnprotect = () => {
  if (!props.tag) return
  const res = nfcStore.unprotectRecord(props.tag.id)
  if (res.record) {
    isCompleted.value = true
    emit('unprotected', res.record)
  }
}

const proceedToWrite = () => {
  if (props.tag) {
    emit('request-write', props.tag)
    emit('close')
  }
}

const serialLine = (tag: NfcTag) =>
  tag.serialNumber || 'Identificador físico não disponibilizado pelo navegador.'
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="isCompleted ? 'Proteção Removida' : 'Remover Proteção'"
    :subtitle="isCompleted ? 'Gravação voltou a ser permitida no sistema' : 'Permitir futuras alterações de conteúdo'"
    max-width="500px"
    @close="emit('close')"
  >
    <div v-if="tag" class="unlock-modal-body">
      <!-- Confirmação -->
      <div v-if="!isCompleted" class="confirmation-view">
        <div class="unlock-info-banner">
          <div class="unlock-icon-box">
            <Unlock :size="24" />
          </div>
          <div class="unlock-text-content">
            <h4 class="unlock-title">Remover proteção no sistema</h4>
            <p class="unlock-message">
              A etiqueta voltará a permitir gravações a partir do TapMenu (via wizard de gravação),
              incluindo atualizações do URL do menu.
            </p>
          </div>
        </div>

        <div class="tag-summary-card">
          <div class="summary-header">
            <span class="chip-label">Etiqueta a desproteger</span>
            <span class="chip-uid font-mono">{{ tag.tableNumber }}</span>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              <span class="item-label">Restaurante:</span>
              <span class="item-value">{{ tag.restaurantName }}</span>
            </div>

            <div class="summary-item">
              <span class="item-label">Mesa:</span>
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
              <span class="item-label">Estado Atual:</span>
              <AppBadge variant="danger" dot>Protegida (sistema)</AppBadge>
            </div>

            <div class="summary-item">
              <span class="item-label">Gravações:</span>
              <span class="item-value">{{ tag.writeCount }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sucesso -->
      <div v-else class="unlocked-success-view">
        <div class="success-icon-badge">
          <CheckCircle2 :size="38" />
        </div>

        <h3 class="success-title">Proteção removida</h3>
        <p class="success-subtitle">
          A etiqueta da <strong>Mesa {{ tag.tableNumber }}</strong> voltou ao modo
          <strong>Ativa</strong>. Use "Gravar Etiqueta NFC" para atualizar o conteúdo físico
          — o wizard confirma a substituição antes de regravar.
        </p>

        <div class="unlocked-summary-box">
          <div class="unlocked-row">
            <span>Estado:</span>
            <AppBadge variant="success" dot>Ativa (gravação permitida)</AppBadge>
          </div>
          <div class="unlocked-row">
            <span>Proteção:</span>
            <span class="unprotected-label">Nenhuma</span>
          </div>
          <div class="unlocked-row">
            <span>Serial físico:</span>
            <span class="font-mono serial-val">{{ serialLine(tag) }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="!isCompleted">
        <AppButton variant="secondary" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="primary" @click="confirmUnprotect">
          <Unlock :size="16" />
          Remover proteção
        </AppButton>
      </template>

      <template v-else>
        <AppButton variant="secondary" @click="proceedToWrite">
          <Radio :size="16" />
          Gravar etiqueta agora
        </AppButton>
        <AppButton variant="primary" @click="emit('close')">Concluir</AppButton>
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

.unlock-text-content { flex: 1; }

.unlock-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #115e59;
  margin: 0 0 0.25rem;
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
  color: var(--color-success-600);
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

.success-subtitle {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
  line-height: 1.5;
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
  gap: 0.75rem;
}

.unprotected-label {
  font-weight: 700;
  color: var(--color-neutral-700);
}

.serial-val {
  font-size: 0.72rem;
  word-break: break-all;
  text-align: right;
  color: var(--color-neutral-600);
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
