<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTableStore } from '@/stores/table'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { useNfcStore } from '@/stores/nfc'
import type { DigitalAccess, NfcTag } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import NfcWriteWizardModal from '@/components/nfc/NfcWriteWizardModal.vue'
import NfcLockModal from '@/components/nfc/NfcLockModal.vue'
import NfcUnlockModal from '@/components/nfc/NfcUnlockModal.vue'
import NfcDetailsModal from '@/components/nfc/NfcDetailsModal.vue'
import NfcTimelineView from '@/components/nfc/NfcTimelineView.vue'
import {
  Radio,
  QrCode,
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldAlert,
  ShieldCheck,
  Search,
  RotateCcw,
  Sliders,
  Eye,
  Info,
  Layers,
  Cpu
} from 'lucide-vue-next'

const tableStore = useTableStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()
const nfcStore = useNfcStore()

// Navigation Tabs
type TabMode = 'nfc' | 'qr' | 'timeline'
const activeTab = ref<TabMode>('nfc')

// Filters and Search for NFC tags
const searchQuery = ref('')
const statusFilter = ref<'all' | 'programmed' | 'locked' | 'unprogrammed'>('all')

// Selected Tag for Details / Lock / Write Modals
const selectedNfcTag = ref<NfcTag | null>(null)
const isWriteWizardOpen = ref(false)
const isLockModalOpen = ref(false)
const isUnlockModalOpen = ref(false)
const isDetailsModalOpen = ref(false)

// QR Code Modal State
const selectedAccess = ref<DigitalAccess | null>(null)
const isQrModalOpen = ref(false)
const qrDataUrl = ref('')

onMounted(async () => {
  await tableStore.loadTables()
  nfcStore.loadTags()
})

const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tapmenu.co.mz'

// Filtered NFC tags list
const filteredNfcTags = computed(() => {
  return nfcStore.tags.filter(tag => {
    // Restaurant filter: if tenantStore has a currentRestaurant, let's keep all or filter by company
    // To allow rich demonstration, allow searching across restaurant or filter by current
    const matchesSearch =
      tag.tableNumber.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      tag.uid.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      tag.restaurantName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      tag.targetUrl.toLowerCase().includes(searchQuery.value.toLowerCase())

    if (!matchesSearch) return false

    if (statusFilter.value === 'all') return true
    if (statusFilter.value === 'locked') return tag.isLocked
    if (statusFilter.value === 'programmed') return tag.status === 'programmed' && !tag.isLocked
    if (statusFilter.value === 'unprogrammed') return tag.status === 'unprogrammed'

    return true
  })
})

// Quick actions
const openNewWriteWizard = () => {
  selectedNfcTag.value = null
  isWriteWizardOpen.value = true
}

const openWriteForTag = (tag: NfcTag) => {
  if (tag.isLocked) {
    // Prevent modification of locked tags
    toastStore.error('Etiqueta Protegida', 'Etiqueta protegida — alterações não permitidas.')
    nfcStore.recordRefusedModification(
      tag.id,
      'Tentativa de gravação recusada: Etiqueta bloqueada permanentemente contra alterações.'
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
  toastStore.success(`${label} Copiado!`, text)
}

const handleWizardCompleted = (tag: NfcTag) => {
  selectedNfcTag.value = tag
}

const handleRequestLockFromWizard = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isWriteWizardOpen.value = false
  setTimeout(() => {
    isLockModalOpen.value = true
  }, 200)
}

const handleRequestLockFromDetails = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isDetailsModalOpen.value = false
  setTimeout(() => {
    isLockModalOpen.value = true
  }, 200)
}

const handleRequestUnlockFromDetails = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isDetailsModalOpen.value = false
  setTimeout(() => {
    isUnlockModalOpen.value = true
  }, 200)
}

const handleRequestWriteFromUnlock = (tag: NfcTag) => {
  selectedNfcTag.value = tag
  isUnlockModalOpen.value = false
  setTimeout(() => {
    isWriteWizardOpen.value = true
  }, 200)
}

const handleRequestWriteFromDetails = (tag: NfcTag) => {
  if (tag.isLocked) {
    toastStore.error('Etiqueta Protegida', 'Etiqueta protegida — alterações não permitidas.')
    nfcStore.recordRefusedModification(tag.id)
    return
  }
  selectedNfcTag.value = tag
  isDetailsModalOpen.value = false
  setTimeout(() => {
    isWriteWizardOpen.value = true
  }, 200)
}

// QR Code handling
const openQrModal = async (access: DigitalAccess) => {
  selectedAccess.value = access
  const fullUrl = `${originUrl}${access.url}`
  qrDataUrl.value = await tableStore.generateQrCode(fullUrl)
  isQrModalOpen.value = true
}

const printSheet = () => window.print()

const formatDateShort = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="digital-access-page">
    <!-- Top Page Header -->
    <div class="page-top-header">
      <div class="header-titles">
        <h1 class="page-title">Acesso Digital — NFC Contactless & Códigos QR</h1>
        <p class="page-subtitle">
          Faça a gestão dos pontos de acesso físicos para abertura instantânea do menu nas mesas
        </p>
      </div>

      <div class="header-actions">
        <button
          class="btn-reset-demo"
          title="Repor etiquetas para o estado padrão de demonstração"
          @click="nfcStore.resetToDefault"
        >
          <RotateCcw :size="15" />
          <span>Repor Demonstração</span>
        </button>

        <AppButton variant="primary" @click="openNewWriteWizard">
          <template #icon-left>
            <Radio :size="16" />
          </template>
          Gravar NFC
        </AppButton>
      </div>
    </div>

    <!-- Technology Banner -->
    <div class="info-alert-card">
      <div class="alert-icon-box">
        <Radio :size="24" />
      </div>
      <div class="alert-content">
        <div class="alert-title-row">
          <h3 class="alert-title">Simulação de Gravação e Bloqueio NFC (NTAG213 / NTAG215)</h3>
          <span class="sim-badge">Demonstração Interativa</span>
        </div>
        <p class="alert-text">
          Grave o URL do menu no chip NFC com codificação NDEF URI e simule o <strong>bloqueio permanente OTP</strong> para proteger a etiqueta contra alterações físicas na mesa. O cliente aproxima o telemóvel contactless ou lê o QR Code.
        </p>
      </div>
    </div>

    <!-- Quick Metrics Row -->
    <div class="metrics-grid">
      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Total de Etiquetas</span>
          <div class="metric-icon bg-primary-soft">
            <Radio :size="18" class="text-primary" />
          </div>
        </div>
        <div class="metric-value">{{ nfcStore.metrics.total }}</div>
        <span class="metric-sub">Pontos físicos no catálogo</span>
      </div>

      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Etiquetas Gravadas</span>
          <div class="metric-icon bg-success-soft">
            <CheckCircle2 :size="18" class="text-success" />
          </div>
        </div>
        <div class="metric-value text-success">{{ nfcStore.metrics.programmed }}</div>
        <span class="metric-sub">Com URL do menu ativo (Desbloqueadas)</span>
      </div>

      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Etiquetas Bloqueadas</span>
          <div class="metric-icon bg-danger-soft">
            <Lock :size="18" class="text-danger" />
          </div>
        </div>
        <div class="metric-value text-danger">{{ nfcStore.metrics.locked }}</div>
        <span class="metric-sub">Protegidas por hardware (Read-Only)</span>
      </div>

      <div class="metric-box">
        <div class="metric-top">
          <span class="metric-label">Virgens / Não Gravadas</span>
          <div class="metric-icon bg-neutral-soft">
            <Cpu :size="18" class="text-neutral-600" />
          </div>
        </div>
        <div class="metric-value text-muted">{{ nfcStore.metrics.unprogrammed }}</div>
        <span class="metric-sub">Aguardando programação inicial</span>
      </div>
    </div>

    <!-- Navigation Tabs Switcher -->
    <div class="section-tabs">
      <button
        class="section-tab-btn"
        :class="{ 'is-active': activeTab === 'nfc' }"
        @click="activeTab = 'nfc'"
      >
        <Radio :size="16" />
        <span>1. Gestão de Etiquetas NFC</span>
        <span class="tab-count-pill">{{ nfcStore.tags.length }}</span>
      </button>

      <button
        class="section-tab-btn"
        :class="{ 'is-active': activeTab === 'timeline' }"
        @click="activeTab = 'timeline'"
      >
        <History :size="16" />
        <span>Histórico & Auditoria Global</span>
        <span class="tab-count-pill">{{ nfcStore.allTimelineEvents.length }}</span>
      </button>

      <button
        class="section-tab-btn"
        :class="{ 'is-active': activeTab === 'qr' }"
        @click="activeTab = 'qr'"
      >
        <QrCode :size="16" />
        <span>Códigos QR & Folhas de Mesa</span>
        <span class="tab-count-pill">{{ tableStore.accessList.length }}</span>
      </button>
    </div>

    <!-- TAB 1: NFC MANAGEMENT & TABLE -->
    <div v-if="activeTab === 'nfc'" class="tab-content-section">
      <div class="app-card nfc-management-card">
        <!-- Table Toolbar & Filters -->
        <div class="card-toolbar">
          <div class="toolbar-search">
            <Search :size="16" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Pesquisar por Mesa, UID (ex: 04:5A...) ou Restaurante..."
              class="search-input"
            />
          </div>

          <div class="toolbar-filters">
            <span class="filter-label">Estado:</span>
            <div class="filter-pills">
              <button
                class="pill-btn"
                :class="{ 'is-active': statusFilter === 'all' }"
                @click="statusFilter = 'all'"
              >
                Todas ({{ nfcStore.tags.length }})
              </button>
              <button
                class="pill-btn"
                :class="{ 'is-active': statusFilter === 'programmed' }"
                @click="statusFilter = 'programmed'"
              >
                Gravadas ({{ nfcStore.metrics.programmed }})
              </button>
              <button
                class="pill-btn"
                :class="{ 'is-active': statusFilter === 'locked' }"
                @click="statusFilter = 'locked'"
              >
                🔒 Bloqueadas ({{ nfcStore.metrics.locked }})
              </button>
              <button
                class="pill-btn"
                :class="{ 'is-active': statusFilter === 'unprogrammed' }"
                @click="statusFilter = 'unprogrammed'"
              >
                Virgens ({{ nfcStore.metrics.unprogrammed }})
              </button>
            </div>
          </div>
        </div>

        <!-- NFC Tags Data Table -->
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Identificador / UID</th>
                <th>Restaurante</th>
                <th>Mesa Associada</th>
                <th>URL de Destino</th>
                <th>Estado da Etiqueta</th>
                <th>Data de Gravação</th>
                <th>Estado de Bloqueio</th>
                <th class="text-right">Ações NFC</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tag in filteredNfcTags"
                :key="tag.id"
                class="nfc-table-row"
                :class="{ 'row-locked': tag.isLocked }"
                @click="openDetailsForTag(tag)"
              >
                <!-- UID -->
                <td>
                  <div class="uid-cell">
                    <span class="uid-code font-mono">{{ tag.uid }}</span>
                    <span class="chip-type-tag">{{ tag.tagType.split(' ')[1] || 'NTAG' }}</span>
                  </div>
                </td>

                <!-- Restaurant -->
                <td>
                  <span class="restaurant-name-cell">{{ tag.restaurantName }}</span>
                </td>

                <!-- Table -->
                <td>
                  <span class="table-pill-main">Mesa {{ tag.tableNumber }}</span>
                </td>

                <!-- Target URL -->
                <td @click.stop>
                  <div class="url-cell-wrapper">
                    <span class="url-code font-mono" :title="tag.targetUrl">
                      {{ tag.targetUrl }}
                    </span>
                    <button
                      class="btn-icon-tiny"
                      title="Copiar URL Completo"
                      @click="copyToClipboard(`${originUrl}${tag.targetUrl}`, 'URL')"
                    >
                      <Copy :size="12" />
                    </button>
                    <a
                      :href="tag.targetUrl"
                      target="_blank"
                      class="btn-icon-tiny"
                      title="Testar URL do Menu"
                    >
                      <ExternalLink :size="12" />
                    </a>
                  </div>
                </td>

                <!-- Tag Status -->
                <td>
                  <AppBadge
                    :variant="
                      tag.status === 'locked' ? 'danger' :
                      tag.status === 'programmed' ? 'success' : 'neutral'
                    "
                  >
                    {{
                      tag.status === 'locked' ? 'Bloqueada' :
                      tag.status === 'programmed' ? 'Gravada' : 'Não gravada'
                    }}
                  </AppBadge>
                </td>

                <!-- Date of Writing -->
                <td>
                  <span class="date-text">
                    {{ tag.writtenAt ? formatDateShort(tag.writtenAt) : 'Ainda não gravada' }}
                  </span>
                </td>

                <!-- Lock Status -->
                <td>
                  <div class="lock-status-cell">
                    <span
                      v-if="tag.isLocked"
                      class="lock-pill-badge pill-locked"
                      title="Protegida contra escrita"
                    >
                      <Lock :size="12" />
                      <span>Bloqueada</span>
                    </span>
                    <span
                      v-else
                      class="lock-pill-badge pill-unlocked"
                      title="Gravação e edição ativas"
                    >
                      <Unlock :size="12" />
                      <span>Desbloqueada</span>
                    </span>
                  </div>
                </td>

                <!-- Row Actions -->
                <td class="text-right" @click.stop>
                  <div class="row-actions-group">
                    <!-- Detalhes button -->
                    <button
                      class="btn-action-sm btn-details"
                      title="Ver Detalhes do Chip & NDEF"
                      @click="openDetailsForTag(tag)"
                    >
                      <Eye :size="13" />
                      <span>Detalhes</span>
                    </button>

                    <!-- Write / Rewrite button -->
                    <button
                      v-if="!tag.isLocked"
                      class="btn-action-sm btn-write"
                      :title="tag.status === 'programmed' ? 'Regravar URL na Tag' : 'Gravar Tag NFC'"
                      @click="openWriteForTag(tag)"
                    >
                      <Radio :size="13" />
                      <span>{{ tag.status === 'programmed' ? 'Regravar' : 'Gravar' }}</span>
                    </button>

                    <!-- Unprotect button when locked -->
                    <button
                      v-if="tag.isLocked"
                      class="btn-action-sm btn-unlock"
                      title="Desproteger etiqueta para permitir futuras alterações"
                      @click="openUnlockForTag(tag)"
                    >
                      <Unlock :size="13" />
                      <span>Desproteger</span>
                    </button>

                    <!-- Lock button (if programmed and unlocked) -->
                    <button
                      v-if="tag.status === 'programmed' && !tag.isLocked"
                      class="btn-action-sm btn-lock"
                      title="Bloquear permanentemente contra escrita"
                      @click="openLockForTag(tag)"
                    >
                      <Lock :size="13" />
                      <span>Bloquear</span>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredNfcTags.length === 0">
                <td colspan="8" class="empty-table-state">
                  <div class="empty-box">
                    <Radio :size="32" class="text-muted" />
                    <p>Nenhuma etiqueta NFC encontrada com os filtros selecionados.</p>
                    <AppButton size="sm" variant="outline" @click="statusFilter = 'all'; searchQuery = ''">
                      Limpar Filtros
                    </AppButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: AUDITORIA & LINHA TEMPORAL GLOBAL -->
    <div v-else-if="activeTab === 'timeline'" class="tab-content-section">
      <div class="app-card timeline-card-wrapper">
        <div class="timeline-card-header">
          <div>
            <h2 class="card-title">Linha Temporal de Operações NFC & Auditoria</h2>
            <p class="card-subtitle">
              Registo contínuo de gravações, verificações de integridade, bloqueios permanentes e tentativas de alteração recusadas.
            </p>
          </div>
          <span class="badge badge-primary">
            {{ nfcStore.allTimelineEvents.length }} Eventos Registados
          </span>
        </div>

        <div class="timeline-body-wrapper">
          <NfcTimelineView :events="nfcStore.allTimelineEvents" :show-tag-context="true" />
        </div>
      </div>
    </div>

    <!-- TAB 3: QR CODES & FOLHAS DE MESA (PRESERVED) -->
    <div v-else-if="activeTab === 'qr'" class="tab-content-section">
      <div class="app-card access-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Códigos QR para Impressão de Mesas</h2>
            <p class="card-subtitle">
              Gere e imprima cartazes de mesa com código QR de alta densidade
            </p>
          </div>
          <span class="badge badge-primary">{{ tableStore.accessList.length }} Mesas Ativas</span>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mesa</th>
                <th>URL do Menu Digital</th>
                <th>Total de Scans</th>
                <th>Último Acesso</th>
                <th class="text-right">Ações QR</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="access in tableStore.accessList" :key="access.id">
                <td>
                  <span class="table-number-pill">Mesa {{ access.tableNumber }}</span>
                </td>

                <td>
                  <span class="url-snippet" :title="`${originUrl}${access.url}`">
                    {{ access.url }}
                  </span>
                </td>

                <td>
                  <strong>{{ access.scanCount || 0 }}</strong> leituras
                </td>

                <td class="text-xs text-muted">
                  {{ access.lastScannedAt ? formatDateShort(access.lastScannedAt) : 'Sem registo' }}
                </td>

                <td class="text-right">
                  <div class="actions-row">
                    <button class="btn-action" title="Gerar e Ver QR Code" @click="openQrModal(access)">
                      <QrCode :size="15" />
                      <span>Ver QR Code</span>
                    </button>

                    <button
                      class="btn-icon"
                      title="Copiar URL"
                      @click="copyToClipboard(`${originUrl}${access.url}`, 'URL')"
                    >
                      <Copy :size="15" />
                    </button>

                    <a :href="access.url" target="_blank" class="btn-icon" title="Abrir Menu">
                      <ExternalLink :size="15" />
                    </a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ALL NFC MODALS -->
    <!-- 1. NFC Write Wizard Modal -->
    <NfcWriteWizardModal
      :is-open="isWriteWizardOpen"
      :initial-tag="selectedNfcTag"
      @close="isWriteWizardOpen = false"
      @completed="handleWizardCompleted"
      @request-lock="handleRequestLockFromWizard"
    />

    <!-- 2. NFC Lock Confirmation Modal -->
    <NfcLockModal
      :is-open="isLockModalOpen"
      :tag="selectedNfcTag"
      @close="isLockModalOpen = false"
      @locked="(updated) => selectedNfcTag = updated"
    />

    <!-- 3. NFC Details & Specs Modal -->
    <NfcDetailsModal
      :is-open="isDetailsModalOpen"
      :tag="selectedNfcTag"
      @close="isDetailsModalOpen = false"
      @request-write="handleRequestWriteFromDetails"
      @request-lock="handleRequestLockFromDetails"
      @request-unlock="handleRequestUnlockFromDetails"
    />

    <!-- 4. NFC Unlock Confirmation Modal -->
    <NfcUnlockModal
      :is-open="isUnlockModalOpen"
      :tag="selectedNfcTag"
      @close="isUnlockModalOpen = false"
      @unlocked="(updated) => selectedNfcTag = updated"
      @request-write="handleRequestWriteFromUnlock"
    />

    <!-- QR Code Modal (Preserved) -->
    <AppModal
      :is-open="isQrModalOpen"
      :title="`Código QR — Mesa ${selectedAccess?.tableNumber}`"
      subtitle="Gerado localmente pelo TapMenu em SVG/PNG de alta densidade"
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
          <span>{{ originUrl }}{{ selectedAccess.url }}</span>
          <button class="btn-copy-sm" @click="copyToClipboard(`${originUrl}${selectedAccess.url}`, 'URL')">
            <Copy :size="14" />
          </button>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isQrModalOpen = false">Fechar</AppButton>
        <AppButton variant="primary" @click="printSheet">
          <template #icon-left>
            <Printer :size="16" />
          </template>
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
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
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

/* Info Alert Card */
.info-alert-card {
  background: linear-gradient(135deg, var(--color-primary-50), #f0f7ff);
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-xl);
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
}

.alert-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-800);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(30, 64, 175, 0.25);
}

.alert-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.35rem;
}

.alert-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--color-primary-950);
}

.sim-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  background-color: #dbeafe;
  color: #1e40af;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
}

.alert-text {
  font-size: 0.8125rem;
  color: var(--color-primary-900);
  line-height: 1.5;
  margin: 0;
}

/* Metrics Grid */
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
.bg-neutral-soft { background-color: var(--color-neutral-100); }

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

/* Section Tabs */
.section-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 2px solid var(--border-subtle);
  padding-bottom: 0.25rem;
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

/* NFC Management Card */
.nfc-management-card {
  padding: 0;
  overflow: hidden;
}

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

/* Data Table Styling */
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
}

.uid-code {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.chip-type-tag {
  font-size: 0.6875rem;
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
}

.lock-status-cell {
  display: inline-flex;
}

.lock-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
}

.pill-locked {
  background-color: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.pill-unlocked {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
  border: 1px solid var(--border-subtle);
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

.btn-disabled {
  background-color: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
  cursor: not-allowed;
  opacity: 0.85;
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

/* Timeline Tab */
.timeline-card-wrapper {
  padding: 1.5rem;
}

.timeline-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.card-subtitle {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

/* QR Tab preserved styles */
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

/* QR Code Modal */
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
  box-shadow: var(--shadow-sm);
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
  font-family: monospace;
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

.table-number-pill {
  font-weight: 700;
  color: var(--color-neutral-900);
}

.url-snippet {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--color-primary-800);
  background: var(--color-primary-50);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
    min-width: 860px;
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
