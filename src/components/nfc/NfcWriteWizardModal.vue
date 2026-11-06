<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { NfcTag, NfcOpState, ParsedNfcRead, Table } from '@/types'
import { NfcError } from '@/types'
import { useNfcStore } from '@/stores/nfc'
import { useTenantStore } from '@/stores/tenant'
import { useTableStore } from '@/stores/table'
import { useToastStore } from '@/stores/toast'
import { nfcService, stateFromError } from '@/services/nfc/nfcService'
import { buildMenuUrl } from '@/services/nfc/nfcUrl'
import { tableService } from '@/services'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import NFCVerification from './NFCVerification.vue'
import {
  Radio,
  Building2,
  ExternalLink,
  Lock,
  FileCode,
  QrCode,
  AlertCircle,
  MapPin,
  Users,
  Info,
  Copy,
  AlertTriangle
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  /** etiqueta existente (regravação) — determina restaurante/mesa iniciais */
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
const tableStore = useTableStore()
const toastStore = useToastStore()

// ---------- Estado do wizard ----------
type WizardPhase = 'config' | 'running' | 'result'
const phase = ref<WizardPhase>('config')
const opState = ref<NfcOpState>('idle')

const selectedRestaurantId = ref('')
const selectedTableId = ref('')
const tablesList = ref<Table[]>([])
const isLoadingTables = ref(false)
const confirmOverwrite = ref(false)
const qrDataUrl = ref('')

const savedRecord = ref<NfcTag | null>(null)
const errorMessage = ref<string | null>(null)
const technicalError = ref<string | null>(null)

/** Resultado real da verificação (null = ainda sem verificação). */
const verifyStatus = ref<'verified' | 'different' | 'no_url' | 'unreadable' | 'cancelled' | null>(null)
const verifyFoundUrl = ref<string | null>(null)
const verifyTechnical = ref<string | null>(null)
/** Último outcome físico bem-sucedido (para registo no store). */
const lastOutcome = ref<{ url: string; writtenAt: string; detections: ParsedNfcRead[] } | null>(null)

let detectionsRef: ParsedNfcRead[] = []

// ---------- Seletores ----------
const restaurantOptions = computed(() => {
  const list = tenantStore.allRestaurants.length > 0
    ? tenantStore.allRestaurants
    : tenantStore.currentRestaurant
      ? [tenantStore.currentRestaurant]
      : []
  return list.map(r => ({ label: `${r.name} (${r.address?.city || 'Moçambique'})`, value: r.id }))
})

const currentRestaurant = computed(() =>
  tenantStore.allRestaurants.find(r => r.id === selectedRestaurantId.value)
  || tenantStore.currentRestaurant
)

const currentCompanyName = computed(() => tenantStore.currentCompany?.name || '—')

const currentTable = computed(() => tablesList.value.find(t => t.id === selectedTableId.value) || null)

const tableOptions = computed(() =>
  tablesList.value.map(t => {
    const rec = nfcStore.getRecordByTable(selectedRestaurantId.value, t.id)
    const tagState = !rec
      ? 'sem registo'
      : rec.status === 'protected'
        ? 'protegida'
        : rec.status === 'active'
          ? 'ativa'
          : rec.status === 'failed'
            ? 'falha'
            : 'não gravada'
    return {
      label: `Mesa ${t.number} — ${t.area || 'Principal'} · ${t.capacity} lugares · etiqueta: ${tagState}`,
      value: t.id
    }
  })
)

/** Registo local existente para a mesa selecionada. */
const existingRecord = computed<NfcTag | null>(() => {
  if (!selectedRestaurantId.value || !selectedTableId.value) return null
  return nfcStore.getRecordByTable(selectedRestaurantId.value, selectedTableId.value) ?? null
})

const isRecordProtected = computed(() => existingRecord.value?.status === 'protected')
const isRewrite = computed(() => {
  const rec = existingRecord.value
  return (rec?.writeCount ?? 0) > 0 || !!rec?.lastWrittenAt
})

/** URL absoluto que será gravado — construído a partir dos dados reais. */
const menuUrl = computed(() => {
  if (!currentRestaurant.value || !currentTable.value) return ''
  return buildMenuUrl(currentRestaurant.value, currentTable.value)
})

const precheckError = computed(() => nfcService.checkPreconditions())
const isSupported = computed(() => nfcService.isSupported())
const isSecure = computed(() => nfcService.isSecureContext())

const canStartWrite = computed(() =>
  !currentRestaurant.value ||
  !currentTable.value ||
  isRecordProtected.value ||
  (isRewrite.value && !confirmOverwrite.value) ||
  !!precheckError.value
)

const tableStatusBadge = computed(() => {
  const rec = existingRecord.value
  if (isRecordProtected.value) return { text: 'Protegida (sistema)', variant: 'danger' as const }
  if (rec?.status === 'active') return { text: 'Ativa', variant: 'success' as const }
  if (rec?.status === 'failed') return { text: 'Falha na última gravação', variant: 'warning' as const }
  if (rec) return { text: 'Não gravada', variant: 'neutral' as const }
  return { text: 'Sem registo local', variant: 'neutral' as const }
})

// ---------- Carregamento de mesas ----------
const loadTablesForRestaurant = async (restId: string) => {
  if (!restId) {
    tablesList.value = []
    return
  }
  isLoadingTables.value = true
  try {
    tablesList.value = await tableService.getTables(restId)
  } catch (e) {
    console.error('Erro ao carregar mesas', e)
  } finally {
    isLoadingTables.value = false
  }
}

const onRestaurantChange = async () => {
  selectedTableId.value = ''
  confirmOverwrite.value = false
  await loadTablesForRestaurant(selectedRestaurantId.value)
  if (tablesList.value.length > 0) selectedTableId.value = tablesList.value[0].id
}

// QR Code sempre atualizado — alternativa funcional mesmo sem NFC
watch(menuUrl, async (url) => {
  qrDataUrl.value = url ? await tableStore.generateQrCode(url) : ''
}, { immediate: true })

// ---------- Ciclo de vida do modal ----------
watch(
  () => props.isOpen,
  async (open) => {
    if (!open) return
    nfcService.cancelNfcSession()
    phase.value = 'config'
    opState.value = 'idle'
    savedRecord.value = null
    errorMessage.value = null
    technicalError.value = null
    confirmOverwrite.value = false
    verifyStatus.value = null
    verifyFoundUrl.value = null
    verifyTechnical.value = null
    lastOutcome.value = null
    detectionsRef = []

    if (props.initialTag) {
      selectedRestaurantId.value = props.initialTag.restaurantId
      await loadTablesForRestaurant(props.initialTag.restaurantId)
      selectedTableId.value = props.initialTag.tableId
    } else {
      selectedRestaurantId.value =
        tenantStore.currentRestaurant?.id || tenantStore.allRestaurants[0]?.id || ''
      await loadTablesForRestaurant(selectedRestaurantId.value)
      selectedTableId.value = tablesList.value[0]?.id ?? ''
    }
  }
)

onUnmounted(() => nfcService.cancelNfcSession())

// ---------- Fluxo REAL de gravação ----------
const setState = (s: NfcOpState) => {
  opState.value = s
}

/** Verificação real: nova leitura + comparação do URL. */
const runVerification = async (record: NfcTag, outcome: { url: string; writtenAt: string; detections: ParsedNfcRead[] }) => {
  setState('verifying')
  try {
    const result = await nfcService.verifyUrl(outcome.url, {
      onWaiting: () => setState('verifying')
    })
    verifyStatus.value = result.status
    verifyFoundUrl.value = result.foundUrl
    verifyTechnical.value = null

    // Registo com verificação real (o store emite toasts/eventos)
    savedRecord.value = nfcStore.registerWrite({
      record,
      outcome,
      verification: result.status,
      foundUrl: result.foundUrl
    })
    setState(result.status === 'verified' ? 'verified' : 'verify_failed')
  } catch (e) {
    const err = e instanceof NfcError ? e : new NfcError('unknown', 'Falha na verificação.')
    // A escrita FÍSICA aconteceu — o que falhou foi a confirmação por leitura
    verifyStatus.value = err.code === 'cancelled' ? 'cancelled' : 'unreadable'
    verifyFoundUrl.value = null
    verifyTechnical.value = err.technical

    savedRecord.value = nfcStore.registerWrite({
      record,
      outcome,
      verification: err.code === 'cancelled' ? 'cancelled' : 'unreadable'
    })
    setState('verify_failed')
  }
}

const startWrite = async () => {
  const restaurant = currentRestaurant.value
  const table = currentTable.value
  if (!restaurant || !table) return

  // Registo local (criado honestamente como 'unassigned')
  const record = nfcStore.ensureRecordForTable({
    tenantId: restaurant.tenantId,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    tableId: table.id,
    tableNumber: table.number,
    tableArea: table.area,
    url: menuUrl.value
  })

  // Bloqueio lógico: etiqueta protegida não pode ser regravada
  if (record.protection === 'system' && record.status === 'protected') {
    nfcStore.recordBlockedAttempt(
      record.id,
      'Tentativa de gravação recusada — etiqueta protegida contra alterações (proteção no sistema).'
    )
    savedRecord.value = record
    phase.value = 'result'
    setState('failed')
    errorMessage.value = 'Etiqueta protegida contra alterações.'
    technicalError.value = null
    return
  }

  // Pré-condições físicas (suporte + HTTPS)
  const pre = precheckError.value
  if (pre) {
    phase.value = 'result'
    setState(stateFromError(pre))
    errorMessage.value = pre.message
    technicalError.value = pre.technical
    return
  }

  phase.value = 'running'
  errorMessage.value = null
  technicalError.value = null
  verifyStatus.value = null
  verifyFoundUrl.value = null
  verifyTechnical.value = null
  savedRecord.value = null
  detectionsRef = []
  setState('ready')

  try {
    // writeNdefUrl só resolve quando o navegador confirma a escrita física
    const outcome = await nfcService.writeNdefUrl(menuUrl.value, {
      onWaiting: () => setState('ready'),
      onTagDetected: (read) => {
        setState('tag_detected')
        detectionsRef.push(read)
      },
      onWriting: () => setState('writing'),
      onReadingError: () => {
        // erro transitório de leitura durante a sessão — o estado mantém-se
      }
    })

    // Escrita física CONCLUÍDA
    setState('written')
    lastOutcome.value = outcome

    // Serial físico apenas quando o browser o fornece
    const serial = outcome.detections.find(d => !!d.serialNumber)?.serialNumber ?? null
    if (serial) record.serialNumber = serial

    // Verificação honesta: nova leitura e comparação do URL
    await runVerification(record, outcome)
    emit('completed', savedRecord.value || record)
  } catch (e) {
    const err = e instanceof NfcError
      ? e
      : new NfcError('unknown', 'Erro inesperado na gravação NFC.')
    if (err.code === 'cancelled') {
      // Cancelada antes da escrita — sem escurecer o registo com falsas falhas
      setState('cancelled')
      errorMessage.value = 'Operação cancelada.'
      technicalError.value = null
      nfcStore.registerCancellation(record)
    } else {
      setState(stateFromError(err))
      errorMessage.value = err.message
      technicalError.value = err.technical
      // Registo honesto da falha — sem fingir sucesso
      nfcStore.registerWriteFailure(record, `${err.message} (detalhe técnico: ${err.technical})`)
      savedRecord.value = record
    }
    phase.value = 'result'
  }
}

const retryVerification = () => {
  const record = savedRecord.value
  const outcome = lastOutcome.value
  if (record && outcome) void runVerification(record, outcome)
}

const cancelOperation = () => {
  nfcService.cancelNfcSession()
}

const backToConfig = () => {
  nfcService.cancelNfcSession()
  phase.value = 'config'
  opState.value = 'idle'
  errorMessage.value = null
  technicalError.value = null
  verifyStatus.value = null
  verifyFoundUrl.value = null
  verifyTechnical.value = null
  savedRecord.value = null
}

const handleClose = () => {
  if (phase.value === 'running') return
  nfcService.cancelNfcSession()
  emit('close')
}

// ---------- Helpers de UI ----------
const copyUrl = async () => {
  if (!menuUrl.value) return
  try {
    await navigator.clipboard.writeText(menuUrl.value)
    toastStore.success('URL copiado', menuUrl.value)
  } catch {
    toastStore.error('Cópia falhou', 'Não foi possível copiar o URL.')
  }
}

const openMenu = () => {
  if (savedRecord.value?.url) window.open(savedRecord.value.url, '_blank')
  else if (menuUrl.value) window.open(menuUrl.value, '_blank')
}

const stateMessage = computed(() => {
  switch (opState.value) {
    case 'ready':
      return { title: 'Pronto para gravar', sub: 'Encoste a etiqueta NFC na parte traseira do dispositivo.' }
    case 'tag_detected':
      return { title: 'Etiqueta detectada', sub: 'A iniciar a escrita do registo NDEF…' }
    case 'writing':
      return { title: 'Gravando...', sub: 'Mantenha a etiqueta encostada até ao fim da escrita.' }
    case 'written':
      return { title: 'Gravação concluída', sub: 'A etiqueta foi escrita fisicamente com sucesso.' }
    case 'verifying':
      return { title: 'Verificando...', sub: 'Encoste novamente a etiqueta para confirmar o conteúdo gravado.' }
    default:
      return { title: 'A preparar NFC...', sub: '' }
  }
})

/** Estado exibido pelo bloco de verificação (inclui 'different'/'no_url'). */
const verifyDisplayState = computed(() => {
  if (verifyStatus.value === 'different') return 'different' as const
  if (verifyStatus.value === 'no_url') return 'no_url' as const
  return opState.value
})

/** Exibe resumo sempre que houve escrita física comprovada. */
const hasWrittenResult = computed(() =>
  !!savedRecord.value && ['verified', 'verify_failed'].includes(opState.value)
)

/** Falha ANTES da escrita física — oferece "Tentar novamente". */
const isFailureResult = computed(() =>
  ['failed', 'cancelled', 'unsupported', 'insecure_context'].includes(opState.value)
)

/** Verificação pode ser repetida (falhou por leitura/cancelamento, não por conteúdo). */
const canRetryVerify = computed(() =>
  hasWrittenResult.value
  && opState.value === 'verify_failed'
  && (verifyStatus.value === 'unreadable' || verifyStatus.value === 'cancelled')
)

const formatDateTime = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="phase === 'result'
      ? (isFailureResult ? 'Gravação não concluída' : 'Gravação NFC')
      : (isRewrite ? 'Regravar Etiqueta NFC' : 'Gravar Etiqueta NFC')"
    :subtitle="phase === 'running'
      ? 'Operação física em curso via Web NFC (NDEFReader)'
      : 'Etapa 1: Restaurante · Etapa 2: Mesa · Etapa 3: Endereço · Etapa 4/5: Gravação e verificação física'"
    max-width="620px"
    :prevent-close="phase === 'running'"
    @close="handleClose"
  >
    <div class="wizard-container">
      <!-- ============ CONFIGURAÇÃO ============ -->
      <template v-if="phase === 'config'">
        <!-- Etapa 1 -->
        <div class="step-head">
          <div class="step-head-icon"><Building2 :size="18" /></div>
          <div>
            <h4 class="step-head-title">Etapa 1 — Selecionar restaurante</h4>
            <p class="step-head-sub">
              Empresa: <strong>{{ currentCompanyName }}</strong> · Restaurantes disponíveis para o seu acesso.
            </p>
          </div>
        </div>

        <div class="form-row">
          <AppSelect
            id="nfc-wizard-restaurant"
            v-model="selectedRestaurantId"
            label="Restaurante"
            :options="restaurantOptions"
            required
            @update:model-value="onRestaurantChange"
          />
        </div>

        <!-- Etapa 2 -->
        <div class="step-head">
          <div class="step-head-icon"><MapPin :size="18" /></div>
          <div>
            <h4 class="step-head-title">Etapa 2 — Selecionar mesa</h4>
            <p class="step-head-sub">Área, código, capacidade e estado do ponto de acesso.</p>
          </div>
        </div>

        <div class="form-row">
          <AppSelect
            id="nfc-wizard-table"
            v-model="selectedTableId"
            label="Mesa"
            :options="tableOptions"
            :disabled="isLoadingTables || tablesList.length === 0"
            required
          />
        </div>

        <div v-if="currentTable" class="table-info-grid">
          <div class="table-info-cell">
            <span class="cell-label">Área</span>
            <span class="cell-val">{{ currentTable.area || 'Principal' }}</span>
          </div>
          <div class="table-info-cell">
            <span class="cell-label">Mesa</span>
            <span class="cell-val">{{ currentTable.number }}</span>
          </div>
          <div class="table-info-cell">
            <span class="cell-label">Código</span>
            <span class="cell-val font-mono">{{ currentTable.number }}</span>
          </div>
          <div class="table-info-cell">
            <span class="cell-label">Capacidade</span>
            <span class="cell-val"><Users :size="13" /> {{ currentTable.capacity }} lugares</span>
          </div>
          <div class="table-info-cell span-2">
            <span class="cell-label">Estado da etiqueta</span>
            <AppBadge :variant="tableStatusBadge.variant" dot>{{ tableStatusBadge.text }}</AppBadge>
          </div>
        </div>

        <div v-if="isRecordProtected" class="protected-banner">
          <Lock :size="16" />
          <div>
            <strong>Etiqueta protegida contra alterações.</strong>
            <p>A gravação está desativada. Para editar, remova a proteção em "Detalhes" (proteção no sistema).</p>
          </div>
        </div>

        <!-- Etapa 3 -->
        <div class="step-head">
          <div class="step-head-icon"><FileCode :size="18" /></div>
          <div>
            <h4 class="step-head-title">Etapa 3 — Endereço que será gravado</h4>
            <p class="step-head-sub">URL NDEF construído a partir do restaurante e da mesa — com QR Code alternativo.</p>
          </div>
        </div>

        <div class="url-preview-card">
          <div class="url-preview-row">
            <span class="url-preview-label">"Endereço que será gravado"</span>
            <div class="url-preview-actions">
              <a :href="menuUrl" target="_blank" rel="noopener" class="url-icon-btn" title="Abrir menu no browser">
                <ExternalLink :size="13" />
              </a>
              <button type="button" class="url-icon-btn" title="Copiar URL" @click="copyUrl">
                <Copy :size="13" />
              </button>
            </div>
          </div>
          <div v-if="menuUrl" class="url-preview-value font-mono">{{ menuUrl }}</div>
          <div v-else class="url-preview-value placeholder">Seleciona um restaurante e uma mesa…</div>
        </div>

        <div class="qr-preview-block">
          <div class="qr-img-frame">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code do menu" class="qr-img" />
            <QrCode v-else :size="72" class="text-muted" />
          </div>
          <p class="qr-note">QR Code atualizado em tempo real — continua funcional como alternativa ao NFC.</p>
        </div>

        <!-- Confirmação de regravação -->
        <div v-if="isRewrite" class="overwrite-confirm">
          <div class="overwrite-head">
            <AlertTriangle :size="16" />
            <strong>Esta operação substituirá o conteúdo atual da etiqueta NFC.</strong>
          </div>
          <label class="overwrite-check">
            <input v-model="confirmOverwrite" type="checkbox" />
            <span>Confirmo a substituição do conteúdo físico da etiqueta.</span>
          </label>
        </div>

        <!-- Etapa 4 -->
        <div class="step-head">
          <div class="step-head-icon"><Radio :size="18" /></div>
          <div>
            <h4 class="step-head-title">Etapa 4 — Preparar NFC</h4>
            <p class="step-head-sub">A gravação usa a Web NFC API do navegador — sem simulação.</p>
          </div>
        </div>

        <div class="requirements-box">
          <div class="req-item" :class="{ ok: isSupported, bad: !isSupported }">
            <span>{{ isSupported ? 'Web NFC API disponível neste navegador' : 'Web NFC API não disponível (requer Chrome/Edge no Android ou ChromeOS)' }}</span>
          </div>
          <div class="req-item" :class="{ ok: isSecure, bad: !isSecure }">
            <span>{{ isSecure ? 'Contexto seguro (HTTPS) OK' : 'A página precisa de HTTPS para o NFC' }}</span>
          </div>
          <div class="req-item ok">
            <span>NFC ativado no dispositivo + etiqueta NDEF compatível (ex.: NTAG213/215/216)</span>
          </div>
        </div>

        <div class="instruction-banner">
          <Info :size="16" />
          <span>Encoste a etiqueta NFC na <strong>parte traseira do dispositivo</strong> e mantenha o contacto até à conclusão.</span>
        </div>
      </template>

      <!-- ============ EXECUÇÃO FÍSICA ============ -->
      <template v-else-if="phase === 'running'">
        <div class="wave-block">
          <div class="wave-circle c1"></div>
          <div class="wave-circle c2"></div>
          <div class="wave-core"><Radio :size="32" /></div>
        </div>

        <h3 class="running-title">{{ stateMessage.title }}</h3>
        <p class="running-sub">{{ stateMessage.sub }}</p>

        <div class="step-tracker">
          <div class="tracker-item" :class="{ active: opState === 'ready', done: ['tag_detected','writing','written','verifying','verified','verify_failed'].includes(opState) }">
            Pronto para gravar
          </div>
          <div class="tracker-item" :class="{ active: opState === 'tag_detected', done: ['writing','written','verifying','verified','verify_failed'].includes(opState) }">
            Etiqueta detectada
          </div>
          <div class="tracker-item" :class="{ active: opState === 'writing', done: ['written','verifying','verified','verify_failed'].includes(opState) }">
            Gravando...
          </div>
          <div class="tracker-item" :class="{ active: opState === 'verifying', done: ['verified','verify_failed'].includes(opState) }">
            Verificando...
          </div>
          <div class="tracker-item" :class="{ done: opState === 'verified' }">
            Gravação concluída
          </div>
        </div>

        <div class="running-url font-mono">{{ menuUrl }}</div>
      </template>

      <!-- ============ RESULTADO ============ -->
      <template v-else>
        <template v-if="isFailureResult">
          <div class="error-card">
            <AlertCircle :size="20" />
            <div>
              <strong>{{ errorMessage || 'A operação não foi concluída.' }}</strong>
              <p class="error-technical font-mono" v-if="technicalError">{{ technicalError }}</p>
            </div>
          </div>
        </template>

        <template v-else-if="hasWrittenResult">
          <NFCVerification
            :state="verifyDisplayState"
            :expected-url="savedRecord?.url"
            :found-url="verifyFoundUrl"
            :technical="verifyTechnical"
          />

          <div class="result-summary">
            <div class="summary-row">
              <span>Restaurante</span>
              <strong>{{ savedRecord?.restaurantName }}</strong>
            </div>
            <div class="summary-row">
              <span>Mesa</span>
              <strong>Mesa {{ savedRecord?.tableNumber }}</strong>
            </div>
            <div class="summary-row">
              <span>URL gravado</span>
              <span class="font-mono url-line">{{ savedRecord?.url }}</span>
            </div>
            <div class="summary-row">
              <span>Serial físico</span>
              <span class="font-mono serial-line">{{ savedRecord?.serialNumber || 'Identificador físico não disponibilizado pelo navegador.' }}</span>
            </div>
            <div class="summary-row">
              <span>Gravações</span>
              <strong>{{ savedRecord?.writeCount }}</strong>
            </div>
            <div class="summary-row">
              <span>Data da gravação</span>
              <strong>{{ formatDateTime(savedRecord?.lastWrittenAt) }}</strong>
            </div>
          </div>

          <div v-if="canRetryVerify" class="retry-box">
            <AppButton variant="primary" size="md" @click="retryVerification">
              Verificar agora (encoste a etiqueta novamente)
            </AppButton>
          </div>
        </template>
      </template>
    </div>

    <template #footer>
      <!-- Config footer -->
      <template v-if="phase === 'config'">
        <AppButton variant="secondary" size="md" @click="handleClose">Cancelar</AppButton>
        <AppButton
          variant="primary"
          size="md"
          :disabled="canStartWrite"
          :title="isRecordProtected ? 'Etiqueta protegida contra alterações.' : undefined"
          @click="startWrite"
        >
          <Radio :size="16" />
          {{ isRewrite ? 'Regravar etiqueta NFC' : 'Gravar etiqueta NFC' }}
        </AppButton>
      </template>

      <!-- Running footer -->
      <template v-else-if="phase === 'running'">
        <AppButton variant="danger" size="md" @click="cancelOperation">
          Cancelar operação
        </AppButton>
      </template>

      <!-- Result footer -->
      <template v-else>
        <AppButton
          v-if="hasWrittenResult"
          variant="outline"
          size="md"
          @click="openMenu"
        >
          <ExternalLink :size="16" />
          Abrir menu
        </AppButton>
        <AppButton
          v-if="hasWrittenResult && opState === 'verified'"
          variant="warning"
          size="md"
          @click="emit('request-lock', savedRecord!); emit('close')"
        >
          <Lock :size="16" />
          Proteger etiqueta
        </AppButton>
        <AppButton
          variant="secondary"
          size="md"
          @click="isFailureResult ? backToConfig() : emit('close')"
        >
          {{ isFailureResult ? 'Tentar novamente' : 'Concluir' }}
        </AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.wizard-container {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.step-head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius-md);
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-100);
}

.step-head-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  background: var(--color-primary-800);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-head-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--color-primary-950);
}

.step-head-sub {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  color: var(--color-primary-900);
}

.form-row {
  display: flex;
  flex-direction: column;
}

.table-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.table-info-cell {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  background: #fcfdff;
}

.table-info-cell.span-2 { grid-column: span 2; }

.cell-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.cell-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.protected-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-md);
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  font-size: 0.8125rem;
}

.protected-banner p {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
}

/* URL preview */
.url-preview-card {
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #ffffff;
}

.url-preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.9rem;
  background: var(--color-primary-50);
  border-bottom: 1px solid var(--color-primary-100);
}

.url-preview-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-primary-800);
  text-transform: uppercase;
}

.url-preview-actions {
  display: inline-flex;
  gap: 0.3rem;
}

.url-icon-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-sm);
  background: #ffffff;
  color: var(--color-primary-800);
  cursor: pointer;
}

.url-preview-value {
  padding: 0.7rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary-900);
  word-break: break-all;
}

.url-preview-value.placeholder {
  font-weight: 500;
  color: var(--text-muted);
}

/* QR preview */
.qr-preview-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.qr-img-frame {
  width: 150px;
  height: 150px;
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  padding: 0.5rem;
}

.qr-img { width: 100%; height: 100%; object-fit: contain; }

.qr-note {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* Confirmção de overwrite */
.overwrite-confirm {
  border: 1px solid #fde68a;
  background: #fffbeb;
  border-radius: var(--radius-lg);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.overwrite-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #92400e;
  font-size: 0.8125rem;
}

.overwrite-check {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.78rem;
  color: #78350f;
  cursor: pointer;
}

.overwrite-check input {
  width: 18px;
  height: 18px;
  accent-color: #b45309;
}

/* Pré-requisitos */
.requirements-box {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.req-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.65rem;
}

.req-item::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.req-item.ok { background: #f0fdf4; color: #166534; }
.req-item.bad { background: #fef2f2; color: #991b1b; }

.instruction-banner {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border-radius: var(--radius-md);
  background: var(--color-neutral-100);
  padding: 0.6rem 0.9rem;
  font-size: 0.78rem;
  color: var(--color-neutral-700);
}

/* Animação da execução física */
.wave-block {
  position: relative;
  width: 110px;
  height: 110px;
  margin: 0.5rem auto 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wave-circle {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--color-primary-600);
  opacity: 0.7;
  animation: wave 2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
}

.wave-circle.c2 { animation-delay: 0.65s; }

@keyframes wave {
  0% { transform: scale(0.55); opacity: 0.85; }
  100% { transform: scale(1.65); opacity: 0; }
}

.wave-core {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary-800), var(--color-primary-950));
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: 0 4px 14px rgba(30, 64, 175, 0.4);
}

.running-title {
  margin: 0;
  text-align: center;
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.running-sub {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.running-url {
  text-align: center;
  font-size: 0.72rem;
  color: var(--color-primary-800);
  background: var(--color-primary-50);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.7rem;
  word-break: break-all;
}

/* Step tracker */
.step-tracker {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
}

.tracker-item {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-full);
  background: var(--color-neutral-100);
  color: var(--color-neutral-500);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.tracker-item.active {
  background: var(--color-primary-800);
  color: #ffffff;
}

.tracker-item.done {
  background: #dcfce7;
  color: #16a34a;
}

/* Resultado */
.error-card {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  border-radius: var(--radius-lg);
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  align-items: flex-start;
}

.error-technical {
  margin: 0.3rem 0 0;
  font-size: 0.7rem;
  word-break: break-all;
  opacity: 0.85;
}

.result-summary {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #fcfdff;
}

.summary-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8125rem;
}

.summary-row > span:first-child {
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 700;
  flex-shrink: 0;
  padding-top: 0.1rem;
}

.url-line {
  word-break: break-all;
  color: var(--color-primary-800);
  text-align: right;
  font-size: 0.75rem;
}

.serial-line {
  word-break: break-all;
  text-align: right;
  font-size: 0.75rem;
}

.retry-box {
  display: flex;
  justify-content: center;
}

.text-muted { color: var(--text-muted); }

@media (max-width: 640px) {
  .table-info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .table-info-cell.span-2 { grid-column: span 2; }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
