<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTableStore } from '@/stores/table'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { useNfcStore } from '@/stores/nfc'
import type { NfcTag } from '@/types'
import { buildMenuUrl, getPublicBaseUrl } from '@/services/nfc/nfcUrl'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import NFCStatus from '@/components/nfc/NFCStatus.vue'
import NfcWriteWizardModal from '@/components/nfc/NfcWriteWizardModal.vue'
import NfcLockModal from '@/components/nfc/NfcLockModal.vue'
import NfcUnlockModal from '@/components/nfc/NfcUnlockModal.vue'
import NfcDetailsModal from '@/components/nfc/NfcDetailsModal.vue'
import NfcDiagnostics from '@/components/nfc/NfcDiagnostics.vue'
import NFCHistory from '@/components/nfc/NFCHistory.vue'
import {
  Radio,
  QrCode,
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Printer,
  CheckCircle2,
  History,
  ShieldCheck,
  Search,
  RotateCcw,
  Eye,
  CircleDashed
} from 'lucide-vue-next'

const tableStore = useTableStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()
const nfcStore = useNfcStore()

// ---------- Navigation Tabs ----------
type TabMode = 'nfc' | 'history' | 'diagnostics' | 'qr'
const activeTab = ref<TabMode>('nfc')

// ---------- Filters ----------
const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'protected' | 'unassigned' | 'failed'>('all')

// ---------- Modais ----------
const selectedNfcTag = ref<NfcTag | null>(null)
const isWriteWizardOpen = ref(false)
const isLockModalOpen = ref(false)
const isUnlockModalOpen = ref(false)
const isDetailsModalOpen = ref(false)

// ---------- QR ----------
const selectedAccess = ref<{ id: string; tableNumber: string; url: string } | null>(null)
const isQrModalOpen = ref(false)
const qrDataUrl = ref('')

// ---------- Label do serial ----------
const serialLabel = (tag: NfcTag) => tag.serialNumber || 'Identificador físico não disponibilizado pelo navegador.'

onMounted(async () => {
  await tableStore.loadTables()
  nfcStore.loadRegistry()

  // Registo local honesto para todas as mesas do restaurante gerido
  const restaurant = tenantStore.currentRestaurant
  if (restaurant) {
    for (const table of tableStore.tables) {
      nfcStore.ensureRecordForTable({
        tenantId: restaurant.tenantId,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        tableId: table.id,
        tableNumber: table.number,
        tableArea: table.area,
        url: buildMenuUrl(restaurant, table)
      })
    }
  }
})

// ---------- Filtros de tabela ----------
const filteredNfcTags = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return nfcStore.records.filter(tag => {
    const matchesSearch =
      !q ||
      tag.tableNumber.toLowerCase().includes(q) ||
      tag.restaurantName.toLowerCase().includes(q) ||
      tag.url.toLowerCase().includes(q) ||
      (tag.serialNumber || '').toLowerCase().includes(q)
    if (!matchesSearch) return false

    if (statusFilter.value === 'all') return true
    return tag.status === statusFilter.value
  })
})

// ---------- Ações ----------
const openNewWriteWizard = () => {
  selectedNfcTag.value = null
  isWriteWizardOpen.value = true
}

const openWriteForTag = (tag: NfcTag) => {
  if (tag.status === 'protected') {
    toastStore.error('Etiqueta Protegida', 'Etiqueta protegida contra alterações — gravação desativada.')
    nfcStore.recordBlockedAttempt(
      tag.id,
      'Tentativa de gravação recusada: etiqueta protegida contra alterações (proteção no sistema).'
    )
    return
  }
  selectedNfcTag.value = tag
  isWriteWizardOpen.value = true
}

const openLockForTag = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isLockModalOpen.value = true
}

const openUnlockForTag = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isUnlockModalOpen.value = true
}

const openDetailsForTag = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isDetailsModalOpen.value = true
}

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text)
  toastStore.success(`${label} copiado!`, text)
}

const handleWizardCompleted = (tag: NfcTag) => {
  selectedNfcTag.value = tag
}

const openLockFromWizard = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isWriteWizardOpen.value = false
  setTimeout(() => { isLockModalOpen.value = true }, 200)
}

const openRequestWriteFrom = (tag: NfcTag) => {
  if (tag.status === 'protected') {
    toastStore.error('Etiqueta Protegida', 'Etiqueta protegida contra alterações.')
    nfcStore.recordBlockedAttempt(tag.id)
    return
  }
  selectedNfcTag.value = tag
  isDetailsModalOpen.value = false
  isUnlockModalOpen.value = false
  setTimeout(() => { isWriteWizardOpen.value = true }, 200)
}

// ---------- QR ----------
const openQrModal = async (access: { id: string; tableNumber: string; url: string }) => {
  selectedAccess.value = access
  qrDataUrl.value = await tableStore.generateQrCode(access.url)
  isQrModalOpen.value = true
}

const printSheet = () => window.print()

/** URL completo a partir de um caminho relativo (usado no ecrã de QR). */
const fullUrlFromPath = (path: string) => `${getPublicBaseUrl()}${path}`

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

const formatDateShort = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}
</script>

<template>
  <div class="digital-access-page">
    <!-- header -->
    <div class="page-top-header">
      <div class="header-titles">
        <h1 class="page-title">Acesso Digital — NFC Real & Códigos QR</h1>
        <p class="page-subtitle">
          Gravação física via Web NFC, verificação por leitura real e histórico audível — QR Code como alternativa
        </p>
      </div>

      <div class="header-actions">
        <button class="btn-reset-demo" title="Remover registos locais de etiquetas e histórico deste dispositivo" @click="nfcStore.resetLocalRegistry">
          <RotateCcw :size="15" />
          <span>Limpar Registo Local</span>
        </button>

        <AppButton variant="primary" @click="openNewWriteWizard">
          <Radio :size="16" />
          Gravar NFC
        </AppButton>
      </div>
    </div>

    <!-- Banner de capacidades reais -->
    <NFCStatus />

    <!-- Métricas -->
    <div class="metrics-grid">
      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Etiquetas registadas</span>
          <div class="metric-icon bg-primary-soft"><Radio :size="18" class="text-primary" /></div>
        </div>
        <div class="metric-value">{{ nfcStore.metrics.total }}</div>
        <span class="metric-sub">Registos locais no sistema</span>
      </div>

      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Ativas</span>
          <div class="metric-icon bg-success-soft"><CheckCircle2 :size="18" class="text-success" /></div>
        </div>
        <div class="metric-value text-success">{{ nfcStore.metrics.active }}</div>
        <span class="metric-sub">Com URL gravado fisicamente</span>
      </div>

      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Protegidas</span>
          <div class="metric-icon bg-danger-soft"><Lock :size="18" class="text-danger" /></div>
        </div>
        <div class="metric-value text-danger">{{ nfcStore.metrics.protected }}</div>
        <span class="metric-sub">Proteção no sistema (gravação bloqueada)</span>
      </div>

      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Verificadas</span>
          <div class="metric-icon bg-success-soft"><ShieldCheck :size="18" class="text-success" /></div>
        </div>
        <div class="metric-value">{{ nfcStore.metrics.verified }}</div>
        <span class="metric-sub">Conteúdo confirmado por leitura real</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="section-tabs">
      <button class="section-tab-btn" :class="{ 'is-active': activeTab === 'nfc' }" @click="activeTab = 'nfc'">
        <Radio :size="16" />
        <span>Gestão de Etiquetas NFC</span>
        <span class="tab-count-pill">{{ nfcStore.records.length }}</span>
      </button>

      <button class="section-tab-btn" :class="{ 'is-active': activeTab === 'history' }" @click="activeTab = 'history'">
        <History :size="16" />
        <span>Histórico & Auditoria</span>
        <span class="tab-count-pill">{{ nfcStore.allTimelineEvents.length }}</span>
      </button>

      <button class="section-tab-btn" :class="{ 'is-active': activeTab === 'diagnostics' }" @click="activeTab = 'diagnostics'">
        <Search :size="16" />
        <span>Testar NFC</span>
      </button>

      <button class="section-tab-btn" :class="{ 'is-active': activeTab === 'qr' }" @click="activeTab = 'qr'">
        <QrCode :size="16" />
        <span>Códigos QR & Folhas de Mesa</span>
        <span class="tab-count-pill">{{ tableStore.accessList.length }}</span>
      </button>
    </div>

    <!-- TAB: gestão NFC -->
    <div v-if="activeTab === 'nfc'" class="tab-content-section">
      <div class="app-card nfc-management-card">
        <!-- toolbar -->
        <div class="card-toolbar">
          <div class="toolbar-search">
            <Search :size="16" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Pesquisar por Mesa, Serial físico, Restaurante ou URL..."
              class="search-input"
            />
          </div>

          <div class="toolbar-filters">
            <span class="filter-label">Estado:</span>
            <div class="filter-pills">
              <button class="pill-btn" :class="{ 'is-active': statusFilter === 'all' }" @click="statusFilter = 'all'">
                Todas ({{ nfcStore.metrics.total }})
              </button>
              <button class="pill-btn" :class="{ 'is-active': statusFilter === 'active' }" @click="statusFilter = 'active'">
                Ativas ({{ nfcStore.metrics.active }})
              </button>
              <button class="pill-btn" :class="{ 'is-active': statusFilter === 'protected' }" @click="statusFilter = 'protected'">
                Protegidas ({{ nfcStore.metrics.protected }})
              </button>
              <button class="pill-btn" :class="{ 'is-active': statusFilter === 'unassigned' }" @click="statusFilter = 'unassigned'">
                Não gravadas ({{ nfcStore.metrics.unassigned }})
              </button>
              <button class="pill-btn" :class="{ 'is-active': statusFilter === 'failed' }" @click="statusFilter = 'failed'">
                Falhas ({{ nfcStore.metrics.failed }})
              </button>
            </div>
          </div>
        </div>

        <!-- Tabela -->
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Restaurante</th>
                <th>Mesa Associada</th>
                <th>URL do Menu</th>
                <th>Estado</th>
                <th>Última Gravação</th>
                <th>Gravações</th>
                <th class="text-right">Ações NFC</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tag in filteredNfcTags"
                :key="tag.id"
                class="nfc-table-row"
                :class="{ 'row-locked': tag.status === 'protected' }"
                @click="openDetailsForTag(tag)"
              >
                <!-- serial -->
                <td>
                  <div class="uid-cell">
                    <span class="uid-code font-mono">{{ serialLabel(tag) }}</span>
                    <span v-if="tag.serialNumber" class="chip-type-tag">serial físico real</span>
                    <span v-else class="chip-type-tag">aguarda leitura com serial</span>
                  </div>
                </td>

                <!-- restauratne -->
                <td><span class="restaurant-name-cell">{{ tag.restaurantName }}</span></td>

                <!-- mesa -->
                <td><span class="table-pill-main">Mesa {{ tag.tableNumber }}</span></td>

                <!-- URL -->
                <td @click.stop>
                  <div class="url-cell-wrapper">
                    <span class="url-code font-mono" :title="tag.url">{{ tag.url }}</span>
                    <button class="btn-icon-tiny" title="Copiar URL" @click="copyToClipboard(tag.url, 'URL')">
                      <Copy :size="12" />
                    </button>
                    <a :href="tag.url" target="_blank" rel="noopener" class="btn-icon-tiny" title="Testar URL do Menu">
                      <ExternalLink :size="12" />
                    </a>
                  </div>
                </td>

                <!-- Estado -->
                <td><AppBadge :variant="statusVariant(tag)" dot>{{ statusLabel(tag) }}</AppBadge></td>

                <!-- gravação -->
                <td>
                  <span class="date-text">
                    {{ tag.lastWrittenAt ? formatDateShort(tag.lastWrittenAt) : 'Ainda não gravada' }}
                  </span>
                </td>

                <td><strong>{{ tag.writeCount }}</strong></td>

                <!-- Ações -->
                <td class="text-right" @click.stop>
                  <div class="row-actions-group">
                    <button class="btn-action-sm btn-details" title="Ver detalhes, verificar e proteger" @click="openDetailsForTag(tag)">
                      <Eye :size="13" />
                      <span>Detalhes</span>
                    </button>

                    <button
                      v-if="tag.status !== 'protected'"
                      class="btn-action-sm btn-write"
                      :title="tag.lastWrittenAt ? 'Regravar conteúdo físico via Web NFC' : 'Gravar etiqueta NFC física'"
                      @click="openWriteForTag(tag)"
                    >
                      <Radio :size="13" />
                      <span>{{ tag.lastWrittenAt ? 'Regravar' : 'Gravar' }}</span>
                    </button>

                    <button
                      v-else
                      class="btn-action-sm btn-unlock"
                      title="Remover proteção no sistema para permitir gravação"
                      @click="openUnlockForTag(tag)"
                    >
                      <Unlock :size="13" />
                      <span>Desproteger</span>
                    </button>

                    <button
                      v-if="tag.status !== 'protected'"
                      class="btn-action-sm btn-lock"
                      title="Proteger no sistema contra alterações"
                      @click="openLockForTag(tag)"
                    >
                      <Lock :size="13" />
                      <span>Proteger</span>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredNfcTags.length === 0">
                <td colspan="8" class="empty-table-state">
                  <div class="empty-box">
                    <CircleDashed :size="32" class="text-muted" />
                    <p>Nenhuma etiqueta encontrada com os filtros selecionados.</p>
                    <AppButton size="sm" variant="outline" @click="statusFilter = 'all'; searchQuery = ''">
                      Limpar filtros
                    </AppButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB: Histórico -->
    <div v-else-if="activeTab === 'history'" class="tab-content-section">
      <div class="app-card timeline-card-wrapper">
        <div class="timeline-card-header">
          <div>
            <h2 class="card-title">Histórico de Operações NFC</h2>
            <p class="card-subtitle">
              Registo honesto de gravações reais, verificações físicas, proteções do sistema e tentativas bloqueadas.
            </p>
          </div>
        </div>
        <NFCHistory :events="nfcStore.allTimelineEvents" :show-tag-context="true" :with-filter="true" />
      </div>
    </div>

    <!-- TAB: Testar NFC -->
    <div v-else-if="activeTab === 'diagnostics'" class="tab-content-section">
      <div class="app-card waveform">
        <NfcDiagnostics />
      </div>
    </div>

    <!-- TAB: QR -->
    <div v-else-if="activeTab === 'qr'" class="tab-content-section">
      <div class="app-card access-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Códigos QR para Impressão de Mesas</h2>
            <p class="card-subtitle">Gere e imprime cartazes com QR de alta densidade — alternativa universal ao NFC</p>
          </div>
          <AppButton variant="outline" @click="printSheet">
            <Printer :size="16" />
            Imprimir
          </AppButton>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mesa</th>
                <th>URL do Menu Digital</th>
                <th class="text-right">Ações QR</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="access in tableStore.accessList" :key="access.id">
                <td><span class="table-pill-main">Mesa {{ access.tableNumber }}</span></td>
                <td>
                  <span class="url-snippet font-mono" :title="access.url">{{ access.url }}</span>
                </td>
                <td class="text-right">
                  <div class="actions-row">
                    <button class="btn-action" title="Gerar e Ver QR Code" @click="openQrModal({ id: access.id, tableNumber: access.tableNumber, url: fullUrlFromPath(access.url) })">
                      <QrCode :size="15" />
                      <span>Ver QR Code</span>
                    </button>
                    <button
                      class="btn-icon"
                      title="Copiar URL"
                      @click="copyToClipboard(fullUrlFromPath(access.url), 'URL')"
                    >
                      <Copy :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAIS NFC -->
    <NfcWriteWizardModal
      :is-open="isWriteWizardOpen"
      :initial-tag="selectedNfcTag"
      @close="isWriteWizardOpen = false"
      @completed="handleWizardCompleted"
      @request-lock="openLockFromWizard"
    />

    <NfcLockModal
      :is-open="isLockModalOpen"
      :tag="selectedNfcTag"
      @close="isLockModalOpen = false"
      @protected="(updated) => (selectedNfcTag = updated)"
    />

    <NfcDetailsModal
      :is-open="isDetailsModalOpen"
      :tag="selectedNfcTag"
      @close="isDetailsModalOpen = false"
      @request-write="openRequestWriteFrom"
      @request-lock="openLockForTag"
      @request-unlock="openUnlockForTag"
    />

    <NfcUnlockModal
      :is-open="isUnlockModalOpen"
      :tag="selectedNfcTag"
      @close="isUnlockModalOpen = false"
      @unprotected="(updated) => (selectedNfcTag = updated)"
      @request-write="openRequestWriteFrom"
    />

    <!-- QR Modal -->
    <AppModal
      :is-open="isQrModalOpen"
      :title="`Código QR — Mesa ${selectedAccess?.tableNumber}`"
      subtitle="Gerado localmente — funciona em qualquer câmara (alternativa ao NFC)"
      max-width="420px"
      @close="isQrModalOpen = false"
    >
      <div v-if="selectedAccess" class="qr-preview-box">
        <div class="qr-render-frame">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="qr-canvas" />
          <div class="qr-footer-text">
            <strong>{{ tenantStore.currentRestaurant?.name }}</strong>
            <p>Mesa {{ selectedAccess.tableNumber }}</p>
          </div>
        </div>

        <div class="modal-url-display">
          <span>{{ selectedAccess.url }}</span>
          <button class="btn-copy-sm" @click="copyToClipboard(selectedAccess.url, 'URL')">
            <Copy :size="14" />
          </button>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isQrModalOpen = false">Fechar</AppButton>
        <AppButton variant="primary" @click="printSheet">
          <Printer :size="16" />
          Imprimir Folha de Mesa
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.digital-access-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0.2rem 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-reset-demo {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.9rem;
  border-radius: var(--radius-md);
  background-color: var(--color-neutral-100);
  border: 1px solid var(--border-medium);
  color: var(--color-neutral-700);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-reset-demo:hover {
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-900);
}

/* Metrics */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.metric-box {
  background-color: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.metric-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-primary-soft { background-color: var(--color-primary-50); }
.bg-success-soft { background-color: var(--color-success-50); }
.bg-danger-soft { background-color: var(--color-danger-50); }

.metric-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  line-height: 1.1;
  margin-top: 0.25rem;
}

.metric-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.text-primary { color: var(--color-primary-800); }
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }
.text-muted { color: var(--text-muted); }

/* Tabs */
.section-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 2px solid var(--border-subtle);
  padding-bottom: 0.25rem;
  flex-wrap: wrap;
}

.section-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  cursor: pointer;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  border-bottom: 3px solid transparent;
  margin-bottom: -0.25rem;
  transition: all var(--transition-fast);
}

.section-tab-btn:hover {
  color: var(--color-neutral-900);
  background-color: var(--color-neutral-50);
}

.section-tab-btn.is-active {
  color: var(--color-primary-800);
  border-bottom-color: var(--color-primary-800);
  background-color: var(--color-primary-50);
}

.tab-count-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-full);
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-700);
}

.section-tab-btn.is-active .tab-count-pill {
  background-color: var(--color-primary-800);
  color: #ffffff;
}

.tab-content-section {
  display: flex;
  flex-direction: column;
}

.app-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
}

.nfc-management-card {
  padding: 0;
  overflow: hidden;
}

/* Toolbar */
.card-toolbar {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  background-color: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.toolbar-search {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-neutral-400);
}

.search-input {
  width: 100%;
  padding: 0.55rem 0.75rem 0.55rem 2.25rem;
  font-size: 0.8125rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: #ffffff;
  outline: none;
}

.search-input:focus {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.filter-pills {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.pill-btn {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
  background-color: #ffffff;
  color: var(--color-neutral-700);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pill-btn:hover {
  background-color: var(--color-neutral-100);
}

.pill-btn.is-active {
  background-color: var(--color-primary-800);
  color: #ffffff;
  border-color: var(--color-primary-800);
}

/* Table */
.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.data-table th {
  background: var(--color-neutral-50);
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  border-bottom: 1px solid var(--border-medium);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.data-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.nfc-table-row {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.nfc-table-row:hover {
  background-color: #f8fafc;
}

.nfc-table-row.row-locked {
  background-color: #fffdfd;
}

.nfc-table-row.row-locked:hover {
  background-color: #fef2f2;
}

.uid-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-width: 240px;
}

.uid-code {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  word-break: break-all;
}

.chip-type-tag {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.restaurant-name-cell {
  font-weight: 500;
  color: var(--color-neutral-700);
  font-size: 0.8125rem;
}

.table-pill-main {
  font-weight: 700;
  color: var(--color-neutral-900);
  background-color: var(--color-neutral-100);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  display: inline-block;
}

.url-cell-wrapper {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.url-code {
  font-size: 0.75rem;
  color: var(--color-primary-800);
  background: var(--color-primary-50);
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-sm);
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.date-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.row-actions-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.btn-action-sm {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn-details {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.btn-details:hover {
  background-color: var(--color-neutral-200);
}

.btn-write {
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  border-color: var(--color-primary-200);
}

.btn-write:hover {
  background-color: var(--color-primary-800);
  color: #ffffff;
}

.btn-lock {
  background-color: var(--color-warning-50);
  color: #b45309;
  border-color: #fde68a;
}

.btn-lock:hover {
  background-color: #f59e0b;
  color: #ffffff;
}

.btn-unlock {
  background-color: #f0fdfa;
  color: #0d9488;
  border-color: #99f6e4;
}

.btn-unlock:hover {
  background-color: #0d9488;
  color: #ffffff;
}

.btn-icon-tiny {
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-neutral-600);
  cursor: pointer;
}

.btn-icon-tiny:hover {
  background-color: var(--color-neutral-100);
}

.empty-table-state {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
}

/* Histórico */
.timeline-card-wrapper {
  padding: 1.5rem;
}

.timeline-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.card-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.card-subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

/* QR tab */
.access-card {
  padding: 0;
  overflow: hidden;
}

.card-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  color: var(--color-neutral-700);
  transition: all var(--transition-fast);
}

.btn-action:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
  color: var(--color-primary-800);
}

.btn-icon {
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-neutral-600);
}

.btn-icon:hover {
  background: var(--color-neutral-100);
}

.text-right {
  text-align: right;
}

/* QR Modal */
.qr-preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.qr-render-frame {
  background: #ffffff;
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  text-align: center;
}

.qr-canvas {
  width: 240px;
  height: 240px;
  display: block;
  margin: 0 auto 0.75rem;
}

.qr-footer-text strong {
  font-size: 1rem;
  color: var(--color-neutral-900);
}

.qr-footer-text p {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.modal-url-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.modal-url-display span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-copy-sm {
  background: transparent;
  border: none;
  color: var(--color-primary-800);
  cursor: pointer;
}

.url-snippet {
  font-size: 0.75rem;
  color: var(--color-primary-800);
  background: var(--color-primary-50);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (max-width: 1024px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .data-table {
    min-width: 900px;
  }

  .card-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-search {
    max-width: 100%;
  }
}
</style>
