<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTableStore } from '@/stores/table'
import { useTenantStore } from '@/stores/tenant'
import { useOrderStore } from '@/stores/order'
import { useServiceRequestStore } from '@/stores/serviceRequest'
import { useNotificationStore } from '@/stores/notification'
import { useToastStore } from '@/stores/toast'
import { tableSessionService, orderService } from '@/services'
import type { Table, TableStatus, TableSession, Order, ServiceRequest, OrderStatus, ServiceRequestStatus, PaymentMethod } from '@/types'

import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import TableDetailModal from '@/components/tables/TableDetailModal.vue'

import {
  Grid,
  List,
  Plus,
  QrCode,
  ExternalLink,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  BellRing,
  Receipt,
  UtensilsCrossed,
  Layers,
  AlertTriangle
} from 'lucide-vue-next'

const tableStore = useTableStore()
const tenantStore = useTenantStore()
const orderStore = useOrderStore()
const serviceRequestStore = useServiceRequestStore()
const notificationStore = useNotificationStore()
const toastStore = useToastStore()

const viewMode = ref<'grid' | 'table'>('grid')
const statusFilter = ref<string>('all')
const areaFilter = ref<string>('all')

// Table Edit / Add Modal
const isEditModalOpen = ref(false)
const formId = ref<string | undefined>(undefined)
const formNumber = ref('')
const formName = ref('')
const formArea = ref<any>('Sala Principal')
const formCapacity = ref(4)

// QR Code Modal
const isQrModalOpen = ref(false)
const selectedTableForQr = ref<Table | null>(null)
const generatedQrDataUrl = ref('')

// Table Detail / Session Modal
const isDetailModalOpen = ref(false)
const activeDetailTable = ref<Table | null>(null)
const activeDetailSession = ref<TableSession | null>(null)
const activeDetailOrders = ref<Order[]>([])
const activeDetailRequests = ref<ServiceRequest[]>([])
const isClosingSession = ref(false)

const areaOptions = [
  'Sala Principal',
  'Esplanada',
  'Varanda',
  'Bar',
  'Piso 1',
  'Privado'
]

const originUrl = typeof window !== 'undefined' ? window.location.origin : ''

onMounted(async () => {
  await reloadAll()
})

const reloadAll = async () => {
  await Promise.all([
    tableStore.loadTables(),
    orderStore.loadOrders(),
    serviceRequestStore.loadRequests(),
    notificationStore.loadNotifications()
  ])
}

// Counter Summary Metrics
const metrics = computed(() => {
  const tables = tableStore.tables
  return {
    total: tables.length,
    free: tables.filter(t => t.status === 'free').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    hasOrder: tables.filter(t => t.status === 'has_order').length,
    waitingService: tables.filter(t => t.status === 'waiting_service').length,
    waitingBill: tables.filter(t => t.status === 'waiting_bill').length,
    unavailable: tables.filter(t => t.status === 'unavailable').length
  }
})

// Filtered Tables
const filteredTables = computed(() => {
  return tableStore.tables.filter(tbl => {
    const matchesStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'active' ? (tbl.status === 'occupied' || tbl.status === 'has_order' || tbl.status === 'waiting_service' || tbl.status === 'waiting_bill') : tbl.status === statusFilter.value)

    const matchesArea = areaFilter.value === 'all' || tbl.area === areaFilter.value
    return matchesStatus && matchesArea
  })
})

const getTablePendingRequests = (tableId: string) => {
  return serviceRequestStore.requests.filter(
    r => r.tableId === tableId && (r.status === 'new' || r.status === 'in_progress')
  )
}

const getTableActiveOrdersCount = (tableId: string) => {
  return orderStore.orders.filter(
    o => o.tableId === tableId && o.status !== 'delivered' && o.status !== 'cancelled'
  ).length
}

const getElapsedMinutes = (startedAt?: string) => {
  if (!startedAt) return ''
  const diffMs = Date.now() - new Date(startedAt).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60000))
  if (mins < 60) return `há ${mins}m`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return `há ${hours}h ${rem}m`
}

// Open Detail Modal
const openTableDetail = async (tbl: Table) => {
  activeDetailTable.value = tbl
  isDetailModalOpen.value = true

  // Load active session from mock repository
  const session = await tableSessionService.getActiveSessionByTable(tbl.id)
  activeDetailSession.value = session

  if (session && tenantStore.currentRestaurant) {
    const allOrders = await orderService.getOrders(tenantStore.currentRestaurant.id)
    activeDetailOrders.value = allOrders.filter(
      o => session.orderIds.includes(o.id) || o.tableSessionId === session.id
    )
  } else {
    activeDetailOrders.value = []
  }

  // Load service requests for this table
  activeDetailRequests.value = serviceRequestStore.requests.filter(r => r.tableId === tbl.id)
}

// Quick status change safeguard
const handleQuickStatusChange = async (tbl: Table, newStatus: TableStatus) => {
  if (newStatus === 'free' && (tbl.status === 'occupied' || tbl.status === 'has_order' || tbl.status === 'waiting_service' || tbl.status === 'waiting_bill')) {
    // Check if session exists
    const session = await tableSessionService.getActiveSessionByTable(tbl.id)
    if (session && session.status !== 'closed') {
      toastStore.warning(
        'Sessão em Andamento',
        `A Mesa ${tbl.number} possui uma sessão ativa de ${session.customerName}. Por favor, clique em "Ver Detalhes" para fechar a conta e encerrar a sessão de forma segura.`
      )
      return
    }
  }

  await tableStore.updateTableStatus(tbl.id, newStatus)
}

// Session Order Status Update from modal
const handleUpdateOrderStatus = async (payload: { orderId: string; status: OrderStatus }) => {
  try {
    await orderStore.updateOrderStatus(payload.orderId, payload.status, 'Balcão')
    if (activeDetailTable.value) {
      await openTableDetail(activeDetailTable.value)
    }
  } catch (e) {
    console.error('Erro ao atualizar status do pedido', e)
  }
}

// Service Request status update from modal
const handleUpdateRequestStatus = async (payload: { requestId: string; status: ServiceRequestStatus }) => {
  try {
    await serviceRequestStore.updateRequestStatus(payload.requestId, payload.status)
    if (activeDetailTable.value) {
      await openTableDetail(activeDetailTable.value)
      await tableStore.loadTables()
    }
  } catch (e) {
    console.error('Erro ao atualizar atendimento', e)
  }
}

// Payment Registration from modal
const handleRegisterPayment = async (payload: { method: PaymentMethod }) => {
  toastStore.success('Pagamento Registado', `Pagamento via ${payload.method.toUpperCase()} simulado com sucesso.`)
}

// Close Session from modal
const handleCloseSession = async () => {
  if (!activeDetailTable.value || !activeDetailSession.value || !tenantStore.currentRestaurant) return
  isClosingSession.value = true
  try {
    const tableNum = activeDetailTable.value.number
    const custName = activeDetailSession.value.customerName

    await tableSessionService.closeSession(activeDetailSession.value.id)

    // Notify counter
    await notificationStore.createNotification({
      tenantId: tenantStore.currentRestaurant.tenantId,
      restaurantId: tenantStore.currentRestaurant.id,
      type: 'table_occupied',
      title: 'Sessão Encerrada & Mesa Livre',
      message: `A sessão da Mesa ${tableNum} (${custName}) foi encerrada e a mesa está agora livre.`,
      tableId: activeDetailTable.value.id,
      tableNumber: tableNum
    })

    toastStore.success('Sessão Encerrada!', `Mesa ${tableNum} foi libertada com sucesso. Histórico preservado.`)
    isDetailModalOpen.value = false
    await reloadAll()
  } catch (e) {
    toastStore.error('Erro ao encerrar sessão', (e as Error).message)
  } finally {
    isClosingSession.value = false
  }
}

// Add Table
const openAddModal = () => {
  formId.value = undefined
  formNumber.value = String(tableStore.tables.length + 1).padStart(2, '0')
  formName.value = `Mesa ${formNumber.value}`
  formArea.value = 'Sala Principal'
  formCapacity.value = 4
  isEditModalOpen.value = true
}

const openEditModal = (tbl: Table) => {
  formId.value = tbl.id
  formNumber.value = tbl.number
  formName.value = tbl.name || ''
  formArea.value = tbl.area
  formCapacity.value = tbl.capacity
  isEditModalOpen.value = true
}

const handleSaveTable = async () => {
  if (!formNumber.value.trim()) {
    toastStore.warning('Insira o número da mesa')
    return
  }
  await tableStore.saveTable({
    id: formId.value,
    number: formNumber.value,
    name: formName.value,
    area: formArea.value,
    capacity: Number(formCapacity.value)
  })
  isEditModalOpen.value = false
}

const handleDeleteTable = async (id: string) => {
  if (confirm('Tem a certeza de que deseja remover esta mesa?')) {
    await tableStore.deleteTable(id)
  }
}

const openQrModal = async (tbl: Table) => {
  selectedTableForQr.value = tbl
  const fullUrl = `${window.location.origin}${tbl.publicUrl}`
  generatedQrDataUrl.value = await tableStore.generateQrCode(fullUrl)
  isQrModalOpen.value = true
}
</script>

<template>
  <div class="tables-page">
    <!-- Header -->
    <div class="tables-header">
      <div>
        <h1 class="page-title">Balcão de Mesas & Atendimento</h1>
        <p class="page-subtitle">Monitore a ocupação em tempo real, pedidos ativos, solicitações de garçom e encerramento de contas.</p>
      </div>

      <div class="header-actions">
        <div class="view-toggle">
          <button
            type="button"
            class="toggle-btn"
            :class="{ 'is-active': viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            <Grid :size="16" />
            <span>Grelha</span>
          </button>
          <button
            type="button"
            class="toggle-btn"
            :class="{ 'is-active': viewMode === 'table' }"
            @click="viewMode = 'table'"
          >
            <List :size="16" />
            <span>Tabela</span>
          </button>
        </div>

        <AppButton variant="primary" @click="openAddModal">
          <template #icon-left>
            <Plus :size="16" />
          </template>
          Nova Mesa
        </AppButton>
      </div>
    </div>

    <!-- Operational Metrics Summary Bar -->
    <div class="metrics-grid">
      <div class="metric-card" :class="{ 'is-active': statusFilter === 'all' }" @click="statusFilter = 'all'">
        <span class="m-val">{{ metrics.total }}</span>
        <span class="m-lbl">Total de Mesas</span>
      </div>

      <div class="metric-card success" :class="{ 'is-active': statusFilter === 'free' }" @click="statusFilter = 'free'">
        <span class="m-val">{{ metrics.free }}</span>
        <span class="m-lbl">Livres</span>
      </div>

      <div class="metric-card primary" :class="{ 'is-active': statusFilter === 'occupied' }" @click="statusFilter = 'occupied'">
        <span class="m-val">{{ metrics.occupied }}</span>
        <span class="m-lbl">Ocupadas</span>
      </div>

      <div class="metric-card warning" :class="{ 'is-active': statusFilter === 'has_order' }" @click="statusFilter = 'has_order'">
        <span class="m-val">{{ metrics.hasOrder }}</span>
        <span class="m-lbl">Com Pedidos</span>
      </div>

      <div class="metric-card danger" :class="{ 'is-active': statusFilter === 'waiting_service' }" @click="statusFilter = 'waiting_service'">
        <span class="m-val">{{ metrics.waitingService }}</span>
        <span class="m-lbl">Chama Garçom</span>
      </div>

      <div class="metric-card amber" :class="{ 'is-active': statusFilter === 'waiting_bill' }" @click="statusFilter = 'waiting_bill'">
        <span class="m-val">{{ metrics.waitingBill }}</span>
        <span class="m-lbl">Pede Conta</span>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="filter-controls-bar">
      <div class="filter-group">
        <label for="statusFilterSelect" class="filter-label">Estado:</label>
        <select id="statusFilterSelect" v-model="statusFilter" class="filter-select">
          <option value="all">Todos os Estados</option>
          <option value="active">Todas em Atendimento Ativo</option>
          <option value="free">Livre</option>
          <option value="occupied">Ocupada</option>
          <option value="has_order">Com Pedido Ativo</option>
          <option value="waiting_service">Aguardar Garçom</option>
          <option value="waiting_bill">Aguardar Conta</option>
          <option value="unavailable">Indisponível</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="areaFilterSelect" class="filter-label">Espaço / Área:</label>
        <select id="areaFilterSelect" v-model="areaFilter" class="filter-select">
          <option value="all">Todas as Áreas</option>
          <option v-for="area in areaOptions" :key="area" :value="area">{{ area }}</option>
        </select>
      </div>
    </div>

    <!-- Grid View -->
    <div v-if="viewMode === 'grid'" class="tables-grid">
      <div
        v-for="tbl in filteredTables"
        :key="tbl.id"
        class="table-card"
        :class="`status-${tbl.status}`"
        @click="openTableDetail(tbl)"
      >
        <!-- Card Top -->
        <div class="card-top">
          <div class="table-number-box">
            <span class="t-prefix">MESA</span>
            <span class="t-num">{{ tbl.number }}</span>
          </div>

          <div class="top-badges">
            <AppBadge
              :variant="
                tbl.status === 'free' ? 'success' :
                tbl.status === 'occupied' ? 'primary' :
                tbl.status === 'has_order' ? 'warning' :
                tbl.status === 'waiting_bill' ? 'danger' :
                tbl.status === 'waiting_service' ? 'danger' : 'neutral'
              "
            >
              {{
                tbl.status === 'free' ? 'Livre' :
                tbl.status === 'occupied' ? 'Ocupada' :
                tbl.status === 'has_order' ? 'Com Pedido' :
                tbl.status === 'waiting_service' ? 'Chama Garçom' :
                tbl.status === 'waiting_bill' ? 'Pede Conta' : 'Indisponível'
              }}
            </AppBadge>
          </div>
        </div>

        <!-- Table Info -->
        <div class="table-info">
          <div class="t-name">{{ tbl.name }}</div>
          <div class="t-meta">
            <span>{{ tbl.area }}</span> •
            <span><Users :size="12" class="inline-icon" /> Até {{ tbl.capacity }}p</span>
          </div>
        </div>

        <!-- Session Highlights (If Occupied) -->
        <div v-if="tbl.activeCustomerName" class="table-occupant-box">
          <div class="occupant-line">
            <span class="occ-label">Responsável:</span>
            <strong class="occ-name">{{ tbl.activeCustomerName }}</strong>
          </div>
          <div class="occupant-timing">
            <span v-if="tbl.partySize">{{ tbl.partySize }} pessoas • </span>
            <span><Clock :size="11" class="inline-icon" /> {{ getElapsedMinutes(tbl.sessionStartedAt) }}</span>
          </div>
        </div>

        <!-- Pending alerts if waiter call / bill -->
        <div v-if="getTablePendingRequests(tbl.id).length > 0" class="pending-alert-badge">
          <BellRing :size="14" class="ring-icon" />
          <span>{{ getTablePendingRequests(tbl.id).length }} solicitação pendente</span>
        </div>

        <!-- Action Row -->
        <div class="table-card-actions" @click.stop>
          <AppButton variant="secondary" size="sm" class="detail-btn" @click="openTableDetail(tbl)">
            Ver Detalhes
          </AppButton>

          <button type="button" class="t-action-btn" title="QR Code" @click="openQrModal(tbl)">
            <QrCode :size="15" />
          </button>

          <a :href="tbl.publicUrl" target="_blank" class="t-action-btn" title="Menu Público">
            <ExternalLink :size="15" />
          </a>

          <select
            :value="tbl.status"
            class="status-select-sm"
            @change="handleQuickStatusChange(tbl, ($event.target as HTMLSelectElement).value as TableStatus)"
          >
            <option value="free">Livre</option>
            <option value="occupied">Ocupada</option>
            <option value="has_order">Com Pedido</option>
            <option value="waiting_service">Garçom</option>
            <option value="waiting_bill">Conta</option>
            <option value="unavailable">Indisponível</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <div v-else class="app-card table-view-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Nome</th>
            <th>Área</th>
            <th>Lotação</th>
            <th>Estado Atual</th>
            <th>Responsável</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tbl in filteredTables" :key="tbl.id">
            <td><strong>Mesa {{ tbl.number }}</strong></td>
            <td>{{ tbl.name }}</td>
            <td>{{ tbl.area }}</td>
            <td>{{ tbl.capacity }} pessoas</td>
            <td>
              <AppBadge
                :variant="
                  tbl.status === 'free' ? 'success' :
                  tbl.status === 'occupied' ? 'primary' :
                  tbl.status === 'has_order' ? 'warning' :
                  tbl.status === 'waiting_bill' ? 'danger' :
                  tbl.status === 'waiting_service' ? 'danger' : 'neutral'
                "
              >
                {{ tbl.status.toUpperCase() }}
              </AppBadge>
            </td>
            <td>
              <span v-if="tbl.activeCustomerName" class="font-bold text-primary">
                {{ tbl.activeCustomerName }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <div class="row-actions">
                <AppButton variant="secondary" size="sm" @click="openTableDetail(tbl)">
                  Gerir Mesa
                </AppButton>
                <button type="button" class="icon-btn-plain" title="QR Code" @click="openQrModal(tbl)">
                  <QrCode :size="16" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Table Detail / Active Session Modal -->
    <TableDetailModal
      :is-open="isDetailModalOpen"
      :table="activeDetailTable"
      :session="activeDetailSession"
      :orders="activeDetailOrders"
      :requests="activeDetailRequests"
      :is-submitting="isClosingSession"
      @close="isDetailModalOpen = false"
      @update-order-status="handleUpdateOrderStatus"
      @update-request-status="handleUpdateRequestStatus"
      @register-payment="handleRegisterPayment"
      @close-session="handleCloseSession"
    />

    <!-- Add/Edit Table Modal -->
    <AppModal
      :is-open="isEditModalOpen"
      :title="formId ? 'Editar Mesa' : 'Nova Mesa'"
      @close="isEditModalOpen = false"
    >
      <div class="form-container">
        <div class="form-group">
          <label for="formTableNum" class="input-label">Número da Mesa *</label>
          <input id="formTableNum" v-model="formNumber" type="text" placeholder="Ex: 09" class="form-input" />
        </div>
        <div class="form-group">
          <label for="formTableName" class="input-label">Nome / Identificador</label>
          <input id="formTableName" v-model="formName" type="text" placeholder="Ex: Mesa Janela" class="form-input" />
        </div>
        <div class="form-group">
          <label for="formTableArea" class="input-label">Área / Espaço</label>
          <select id="formTableArea" v-model="formArea" class="form-input">
            <option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="formTableCap" class="input-label">Capacidade (Pessoas)</label>
          <input id="formTableCap" v-model="formCapacity" type="number" min="1" max="20" class="form-input" />
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="isEditModalOpen = false">Cancelar</AppButton>
        <AppButton variant="primary" @click="handleSaveTable">Guardar Mesa</AppButton>
      </template>
    </AppModal>

    <!-- QR Code Modal -->
    <AppModal
      :is-open="isQrModalOpen"
      :title="`QR Code — Mesa ${selectedTableForQr?.number}`"
      @close="isQrModalOpen = false"
    >
      <div v-if="selectedTableForQr" class="qr-modal-content">
        <img :src="generatedQrDataUrl" alt="QR Code" class="qr-image" />
        <p class="qr-url-text">{{ `${originUrl}${selectedTableForQr.publicUrl}` }}</p>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="isQrModalOpen = false">Fechar</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.tables-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tables-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
}

.page-subtitle {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.view-toggle {
  display: flex;
  background-color: #f1f5f9;
  border-radius: var(--radius-md);
  padding: 0.25rem;
  border: 1px solid var(--border-color);
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border: none;
  background: none;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.toggle-btn.is-active {
  background-color: #ffffff;
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
}

.metric-card {
  background-color: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.metric-card:hover,
.metric-card.is-active {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 2px rgba(30, 64, 175, 0.12);
  transform: translateY(-1px);
}

.metric-card .m-val {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--text-main);
}

.metric-card .m-lbl {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.metric-card.success .m-val { color: var(--color-success-600); }
.metric-card.primary .m-val { color: var(--color-primary-800); }
.metric-card.warning .m-val { color: var(--color-warning-600); }
.metric-card.danger .m-val { color: var(--color-danger-600); }
.metric-card.amber .m-val { color: #d97706; }

/* Filter Controls */
.filter-controls-bar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background-color: #ffffff;
  padding: 0.875rem 1.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.filter-select {
  padding: 0.4rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  outline: none;
  background-color: #f8fafc;
}

/* Tables Grid */
.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.table-card {
  background-color: #ffffff;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.table-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-400);
}

.table-card.status-occupied {
  border-left: 4px solid var(--color-primary-600);
}

.table-card.status-has_order {
  border-left: 4px solid var(--color-warning-500);
}

.table-card.status-waiting_service {
  border-left: 4px solid var(--color-danger-500);
  background: linear-gradient(180deg, #ffffff 0%, #fef2f2 100%);
}

.table-card.status-waiting_bill {
  border-left: 4px solid #d97706;
  background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-number-box {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.t-prefix {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-muted);
}

.t-num {
  font-size: 1.35rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--text-main);
}

.table-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.t-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.t-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.inline-icon {
  display: inline;
  vertical-align: middle;
}

.table-occupant-box {
  background-color: #f1f5f9;
  border-radius: var(--radius-md);
  padding: 0.5rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.occupant-line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
}

.occ-label {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.occ-name {
  color: var(--color-primary-800);
}

.occupant-timing {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.pending-alert-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background-color: var(--color-danger-50);
  border: 1px solid var(--color-danger-200);
  color: var(--color-danger-700);
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

.ring-icon {
  animation: shake 1s infinite ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

.table-card-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.detail-btn {
  flex: 1;
}

.t-action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main);
  cursor: pointer;
}

.t-action-btn:hover {
  background-color: var(--color-slate-100);
}

.status-select-sm {
  font-size: 0.6875rem;
  padding: 0.25rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background-color: #ffffff;
  max-width: 80px;
}

/* Data Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.875rem;
}

.data-table th {
  background-color: #f8fafc;
  font-weight: 700;
  color: var(--text-muted);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-btn-plain {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-muted);
}

.icon-btn-plain:hover {
  color: var(--text-main);
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.input-label {
  font-size: 0.8125rem;
  font-weight: 700;
}

.form-input {
  width: 100%;
  padding: 0.65rem 0.875rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.qr-modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.qr-image {
  width: 220px;
  height: 220px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.qr-url-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  word-break: break-all;
}

.originUrl {
  font-size: 0.75rem;
}
</style>
