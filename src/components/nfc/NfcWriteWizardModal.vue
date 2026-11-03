<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { NfcTag, Restaurant, Table } from '@/types'
import { useNfcStore, generateRealisticNfcUid, calculateNdefUriSize } from '@/stores/nfc'
import { useTenantStore } from '@/stores/tenant'
import { tableService } from '@/services'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Radio,
  Cpu,
  CheckCircle2,
  ExternalLink,
  Lock,
  Sparkles,
  Layers,
  FileCode,
  ShieldCheck,
  AlertCircle
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  initialTag?: NfcTag | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'completed', tag: NfcTag): void
  (e: 'request-lock', tag: NfcTag): void
}>()

const nfcStore = useNfcStore()
const tenantStore = useTenantStore()

// Wizard Form States
const selectedRestaurantId = ref('')
const selectedTableId = ref('')
const tablesList = ref<Table[]>([])
const isLoadingTables = ref(false)
const generatedUid = ref('')
const selectedTagType = ref('NXP NTAG213 (180 Bytes)')

// Simulation animation state
const isSimulating = ref(false)
const currentStepIndex = ref(0)
const progressPercent = ref(0)
const simulationMessage = ref('')
const isCompleted = ref(false)
const savedTag = ref<NfcTag | null>(null)
const writeError = ref<string | null>(null)

const stepMessages = [
  'A preparar etiqueta...',
  'A gravar conteúdo...',
  'A verificar conteúdo...',
  'Gravação concluída!'
]

const tagTypeOptions = [
  { label: 'NXP NTAG213 • 180 Bytes (Padrão)', value: 'NXP NTAG213 (180 Bytes)' },
  { label: 'NXP NTAG215 • 540 Bytes (Alta Densidade)', value: 'NXP NTAG215 (540 Bytes)' },
  { label: 'NXP NTAG216 • 924 Bytes (Máxima Capacidade)', value: 'NXP NTAG216 (924 Bytes)' }
]

const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tapmenu.co.mz'

// Computed Restaurants options
const restaurantOptions = computed(() => {
  const list = tenantStore.allRestaurants.length > 0
    ? tenantStore.allRestaurants
    : (tenantStore.currentRestaurant ? [tenantStore.currentRestaurant] : [])

  return list.map(r => ({
    label: `${r.name} (${r.address?.city || 'Moçambique'})`,
    value: r.id
  }))
})

// Current selected restaurant object
const currentSelectedRestaurant = computed(() => {
  return tenantStore.allRestaurants.find(r => r.id === selectedRestaurantId.value) || tenantStore.currentRestaurant
})

// Computed Table options
const tableOptions = computed(() => {
  return tablesList.value.map(t => {
    const existingTag = nfcStore.getTagByTable(selectedRestaurantId.value, t.id)
    const tagStatus = existingTag?.isLocked
      ? '🔒 Bloqueada'
      : existingTag?.status === 'programmed'
        ? '✓ Gravada'
        : '○ Virgem'

    return {
      label: `Mesa ${t.number} — ${t.area || 'Principal'} (${t.capacity} lugares) [${tagStatus}]`,
      value: t.id
    }
  })
})

// Current selected table object
const currentSelectedTable = computed(() => {
  return tablesList.value.find(t => t.id === selectedTableId.value)
})

// Check if current selected table has a locked tag
const isCurrentTableLocked = computed(() => {
  if (!selectedRestaurantId.value || !selectedTableId.value) return false
  const tag = nfcStore.getTagByTable(selectedRestaurantId.value, selectedTableId.value)
  return tag?.isLocked || false
})

// Auto generated menu URL
const generatedMenuUrl = computed(() => {
  if (!currentSelectedRestaurant.value || !currentSelectedTable.value) {
    return '/menu/...'
  }
  return `/menu/${currentSelectedRestaurant.value.slug}/${currentSelectedTable.value.number}`
})

const fullMenuUrl = computed(() => {
  return `${originUrl}${generatedMenuUrl.value}`
})

const estimatedPayloadSize = computed(() => {
  return calculateNdefUriSize(fullMenuUrl.value)
})

// Watch restaurant changes to load tables
watch(
  selectedRestaurantId,
  async (newRestId) => {
    if (!newRestId) {
      tablesList.value = []
      selectedTableId.value = ''
      return
    }
    isLoadingTables.value = true
    try {
      tablesList.value = await tableService.getTables(newRestId)
      // If previous table is not in this restaurant, select first table
      if (!tablesList.value.some(t => t.id === selectedTableId.value)) {
        selectedTableId.value = tablesList.value[0]?.id || ''
      }
    } catch (e) {
      console.error('Erro ao carregar mesas', e)
    } finally {
      isLoadingTables.value = false
    }
  }
)

// Initialize wizard when opened
watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      isSimulating.value = false
      currentStepIndex.value = 0
      progressPercent.value = 0
      simulationMessage.value = ''
      isCompleted.value = false
      savedTag.value = null
      writeError.value = null
      generatedUid.value = generateRealisticNfcUid()

      // If initialTag was supplied
      if (props.initialTag) {
        selectedRestaurantId.value = props.initialTag.restaurantId
        generatedUid.value = props.initialTag.uid
        selectedTagType.value = props.initialTag.tagType || 'NXP NTAG213 (180 Bytes)'
        await loadTablesForRestaurant(props.initialTag.restaurantId)
        selectedTableId.value = props.initialTag.tableId
      } else {
        // Defaults to current restaurant from tenantStore
        const defaultRestId = tenantStore.currentRestaurant?.id || tenantStore.allRestaurants[0]?.id || ''
        selectedRestaurantId.value = defaultRestId
        await loadTablesForRestaurant(defaultRestId)
        if (tablesList.value.length > 0 && !selectedTableId.value) {
          selectedTableId.value = tablesList.value[0].id
        }
      }
    }
  }
)

const loadTablesForRestaurant = async (restId: string) => {
  if (!restId) return
  isLoadingTables.value = true
  try {
    tablesList.value = await tableService.getTables(restId)
  } catch (e) {
    console.error('Erro ao carregar mesas', e)
  } finally {
    isLoadingTables.value = false
  }
}

// Start NFC Writing Simulation
const startSimulation = () => {
  if (!currentSelectedRestaurant.value || !currentSelectedTable.value) return

  // Check if locked
  if (isCurrentTableLocked.value) {
    writeError.value = 'Esta mesa possui uma etiqueta protegida permanentemente. Não é permitida a sobrescrita.'
    nfcStore.recordRefusedModification(
      nfcStore.getTagByTable(selectedRestaurantId.value, selectedTableId.value)!.id,
      'Tentativa de gravação recusada pelo assistente NFC: etiqueta bloqueada.'
    )
    return
  }

  writeError.value = null
  isSimulating.value = true
  currentStepIndex.value = 0
  progressPercent.value = 15
  simulationMessage.value = stepMessages[0]

  // Step 1: A preparar etiqueta (800ms)
  setTimeout(() => {
    currentStepIndex.value = 1
    progressPercent.value = 50
    simulationMessage.value = stepMessages[1]

    // Step 2: A gravar conteúdo (900ms)
    setTimeout(() => {
      currentStepIndex.value = 2
      progressPercent.value = 85
      simulationMessage.value = stepMessages[2]

      // Step 3: A verificar conteúdo (800ms)
      setTimeout(() => {
        currentStepIndex.value = 3
        progressPercent.value = 100
        simulationMessage.value = stepMessages[3]

        // Commit to store
        const result = nfcStore.writeTag({
          tagId: props.initialTag?.id,
          restaurantId: currentSelectedRestaurant.value!.id,
          restaurantName: currentSelectedRestaurant.value!.name,
          tenantId: currentSelectedRestaurant.value!.tenantId,
          tableId: currentSelectedTable.value!.id,
          tableNumber: currentSelectedTable.value!.number,
          targetUrl: generatedMenuUrl.value,
          tagType: selectedTagType.value
        })

        if (result.success && result.tag) {
          savedTag.value = result.tag
          setTimeout(() => {
            isCompleted.value = true
            emit('completed', result.tag!)
          }, 400)
        } else {
          isSimulating.value = false
          writeError.value = result.message || 'Erro durante a gravação'
        }
      }, 800)
    }, 900)
  }, 800)
}

const handleClose = () => {
  if (isSimulating.value && !isCompleted.value) return
  emit('close')
}

const proceedToLock = () => {
  if (savedTag.value) {
    emit('request-lock', savedTag.value)
    emit('close')
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="isCompleted ? 'Gravação NFC Concluída' : 'Assistente de Gravação NFC'"
    :subtitle="isCompleted ? 'Etiqueta programada e pronta para leitura' : 'Configurar e simular gravação NDEF em tag física'"
    max-width="560px"
    :prevent-close="isSimulating && !isCompleted"
    @close="handleClose"
  >
    <div class="wizard-container">
      <!-- Error notice if locked -->
      <div v-if="writeError" class="error-notice-card">
        <AlertCircle :size="20" class="text-danger" />
        <div class="error-text">
          <strong>Gravação Recusada</strong>
          <p>{{ writeError }}</p>
        </div>
      </div>

      <!-- State 1: Configuration Form (Before Simulation) -->
      <div v-if="!isSimulating && !isCompleted" class="config-view">
        <div class="step-guide-intro">
          <div class="guide-icon">
            <Radio :size="20" />
          </div>
          <div>
            <h4 class="guide-title">Gravação NDEF Contactless (ISO 14443-A)</h4>
            <p class="guide-text">
              Gere o link dinâmico da mesa e grave no formato NDEF URI padrão para abertura rápida no telemóvel dos clientes.
            </p>
          </div>
        </div>

        <div class="form-grid">
          <!-- 1. Select Restaurant -->
          <div class="form-group">
            <AppSelect
              id="nfc-restaurant-select"
              v-model="selectedRestaurantId"
              label="1. Seleccionar Restaurante"
              :options="restaurantOptions"
              required
            />
          </div>

          <!-- 2. Select Table -->
          <div class="form-group">
            <AppSelect
              id="nfc-table-select"
              v-model="selectedTableId"
              label="2. Seleccionar Mesa Alvo"
              :options="tableOptions"
              :disabled="isLoadingTables || tablesList.length === 0"
              required
            />
          </div>

          <!-- Chip Type Selection -->
          <div class="form-group">
            <AppSelect
              id="nfc-chip-type"
              v-model="selectedTagType"
              label="Tipo de Chip NFC"
              :options="tagTypeOptions"
            />
          </div>
        </div>

        <!-- Warning if selected table is locked -->
        <div v-if="isCurrentTableLocked" class="locked-warning-pill">
          <Lock :size="16" />
          <span>Atenção: A Mesa {{ currentSelectedTable?.number }} já possui uma etiqueta <strong>BLOQUEADA</strong>. Para alterar, é necessário alocar outra etiqueta virgem.</span>
        </div>

        <!-- 3 & 4. Generated Menu URL & Data to be Written -->
        <div class="payload-preview-box">
          <div class="preview-header">
            <span class="preview-title">
              <FileCode :size="15" />
              3. Dados a Gravar na Etiqueta (NDEF URI Record)
            </span>
            <span class="payload-size font-mono">~{{ estimatedPayloadSize }} Bytes</span>
          </div>

          <div class="preview-body">
            <div class="data-row">
              <span class="data-key">URL Gerado:</span>
              <span class="data-val font-mono url-highlight">{{ fullMenuUrl }}</span>
            </div>

            <div class="meta-subgrid">
              <div class="meta-col">
                <span class="meta-label">UID Estimado:</span>
                <span class="meta-val font-mono">{{ generatedUid }}</span>
              </div>
              <div class="meta-col">
                <span class="meta-label">Tipo de Registo:</span>
                <span class="meta-val">NDEF URI (0x55) • Type 'U'</span>
              </div>
              <div class="meta-col">
                <span class="meta-label">Protocolo:</span>
                <span class="meta-val">NFC Forum Type 2</span>
              </div>
              <div class="meta-col">
                <span class="meta-label">Estado Inicial:</span>
                <span class="meta-val text-success">✓ Desbloqueada (R/W)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- State 2: Active Simulation Animation -->
      <div v-else-if="isSimulating && !isCompleted" class="simulation-animation-view">
        <div class="nfc-radar-pulse">
          <div class="radar-circle circle-1"></div>
          <div class="radar-circle circle-2"></div>
          <div class="radar-circle circle-3"></div>
          <div class="radar-core">
            <Radio :size="38" class="radar-radio-icon" />
          </div>
        </div>

        <div class="sim-text-block">
          <h3 class="sim-main-title">{{ simulationMessage }}</h3>
          <p class="sim-sub-desc">
            Sintonia a 13.56 MHz • Gravando Mesa {{ currentSelectedTable?.number }}
          </p>
        </div>

        <!-- Step indicators -->
        <div class="sim-steps-tracker">
          <div
            v-for="(stepText, idx) in stepMessages"
            :key="idx"
            class="tracker-step"
            :class="{
              'is-active': currentStepIndex === idx,
              'is-done': currentStepIndex > idx
            }"
          >
            <div class="step-dot">
              <CheckCircle2 v-if="currentStepIndex > idx" :size="12" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span class="step-label">{{ stepText }}</span>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="sim-progress-track">
          <div class="sim-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <!-- State 3: Final Success Confirmation Screen -->
      <div v-else class="success-screen-view">
        <div class="success-circle-icon">
          <CheckCircle2 :size="42" class="icon-pulse" />
        </div>

        <h3 class="success-title">Gravação Concluída!</h3>
        <p class="success-subtitle">
          A etiqueta NFC da <strong>Mesa {{ savedTag?.tableNumber }}</strong> foi configurada com sucesso e validada pelo simulador.
        </p>

        <div class="success-details-card">
          <div class="success-row">
            <span class="row-label">UID do Chip:</span>
            <span class="row-val font-mono">{{ savedTag?.uid }}</span>
          </div>
          <div class="success-row">
            <span class="row-label">Restaurante:</span>
            <span class="row-val font-medium">{{ savedTag?.restaurantName }}</span>
          </div>
          <div class="success-row">
            <span class="row-label">Mesa:</span>
            <span class="row-val font-bold">Mesa {{ savedTag?.tableNumber }}</span>
          </div>
          <div class="success-row">
            <span class="row-label">URL Gravado:</span>
            <span class="row-val font-mono text-xs text-primary">{{ savedTag?.ndefPayload }}</span>
          </div>
          <div class="success-row">
            <span class="row-label">Estado de Proteção:</span>
            <AppBadge variant="success">Desbloqueada (Aberta para modificações)</AppBadge>
          </div>
        </div>

        <div class="recommend-box">
          <Sparkles :size="18" class="text-primary" />
          <p class="text-xs">
            <strong>Próximo passo recomendado:</strong> Pode testar a abertura do menu agora ou selar a etiqueta através do botão <strong>"Bloquear NFC"</strong> para impedir que terceiros reprogramem o chip.
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <!-- Config state footer -->
      <template v-if="!isSimulating && !isCompleted">
        <AppButton variant="secondary" @click="handleClose">
          Cancelar
        </AppButton>
        <AppButton
          variant="primary"
          :disabled="!selectedRestaurantId || !selectedTableId || isCurrentTableLocked"
          @click="startSimulation"
        >
          <template #icon-left>
            <Radio :size="16" />
          </template>
          5. Iniciar Gravação
        </AppButton>
      </template>

      <!-- Completed state footer -->
      <template v-else-if="isCompleted">
        <a
          v-if="savedTag?.targetUrl"
          :href="savedTag.targetUrl"
          target="_blank"
          class="app-btn app-btn--secondary app-btn--md"
        >
          <ExternalLink :size="16" />
          <span>Testar URL</span>
        </a>

        <AppButton variant="warning" @click="proceedToLock">
          <template #icon-left>
            <Lock :size="16" />
          </template>
          Bloquear NFC Agora
        </AppButton>

        <AppButton variant="primary" @click="handleClose">
          Concluir
        </AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.wizard-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.step-guide-intro {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  background-color: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.guide-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background-color: var(--color-primary-800);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.guide-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-primary-900);
  margin-bottom: 0.2rem;
}

.guide-text {
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--color-primary-900);
  margin: 0;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.locked-warning-pill {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
}

/* Preview Box */
.payload-preview-box {
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0.5rem;
}

.preview-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-800);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.payload-size {
  font-size: 0.6875rem;
  color: var(--color-primary-800);
  background: var(--color-primary-50);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
}

.preview-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.data-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.data-key {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.url-highlight {
  font-size: 0.8125rem;
  background-color: #ffffff;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  color: var(--color-primary-800);
  word-break: break-all;
}

.meta-subgrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-subtle);
}

.meta-col {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.meta-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.meta-val {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-800);
}

/* Simulation Animation Screen */
.simulation-animation-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 0;
  gap: 1.5rem;
}

.nfc-radar-pulse {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radar-circle {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--color-primary-600);
  opacity: 0.6;
  animation: radar-wave 2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
}

.radar-circle.circle-2 {
  animation-delay: 0.65s;
}

.radar-circle.circle-3 {
  animation-delay: 1.3s;
}

.radar-core {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary-800), var(--color-primary-950));
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: 0 4px 14px rgba(30, 64, 175, 0.4);
}

.radar-radio-icon {
  animation: pulse-icon 1s infinite alternate;
}

@keyframes radar-wave {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

@keyframes pulse-icon {
  from { transform: scale(0.9); }
  to { transform: scale(1.1); }
}

.sim-main-title {
  font-size: 1.1875rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.sim-sub-desc {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.sim-steps-tracker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.5rem;
}

.tracker-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
  opacity: 0.45;
  transition: all 0.3s ease;
}

.tracker-step.is-active {
  opacity: 1;
  transform: translateY(-2px);
}

.tracker-step.is-done {
  opacity: 0.9;
}

.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-700);
  font-size: 0.6875rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tracker-step.is-active .step-dot {
  background-color: var(--color-primary-800);
  color: #ffffff;
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.tracker-step.is-done .step-dot {
  background-color: var(--color-success-600);
  color: #ffffff;
}

.step-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  text-align: center;
  line-height: 1.2;
}

.sim-progress-track {
  width: 100%;
  height: 8px;
  background-color: var(--color-neutral-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.sim-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary-600), var(--color-primary-800));
  transition: width 0.35s ease;
  border-radius: var(--radius-full);
}

/* Success Screen View */
.success-screen-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.success-circle-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: var(--color-success-50);
  border: 2px solid var(--color-success-200);
  color: var(--color-success-600);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-pulse {
  animation: pulse-check 0.5s ease-out;
}

@keyframes pulse-check {
  0% { transform: scale(0.6); opacity: 0; }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

.success-title {
  font-size: 1.375rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.success-subtitle {
  font-size: 0.875rem;
  color: var(--color-neutral-600);
  max-width: 420px;
  line-height: 1.45;
  margin: 0;
}

.success-details-card {
  width: 100%;
  background-color: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-size: 0.8125rem;
  text-align: left;
}

.success-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.row-label {
  color: var(--text-muted);
}

.row-val {
  color: var(--color-neutral-900);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-md);
  text-align: left;
  color: #166534;
}

.error-notice-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-lg);
  color: #991b1b;
}

.error-text strong {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 0.2rem;
}

.error-text p {
  font-size: 0.8125rem;
  margin: 0;
}
</style>

