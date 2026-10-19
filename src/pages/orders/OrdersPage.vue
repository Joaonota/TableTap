<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOrderStore } from '@/stores/order'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import type { Order, OrderStatus, PaymentStatus } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  Search,
  Filter,
  Columns,
  List,
  Printer,
  FileDown,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  UtensilsCrossed,
  ChefHat
} from 'lucide-vue-next'

const orderStore = useOrderStore()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const viewMode = ref<'table' | 'kanban'>('table')
const selectedOrder = ref<Order | null>(null)
const isDetailsModalOpen = ref(false)
const isReceiptModalOpen = ref(false)

onMounted(async () => {
  await orderStore.loadOrders()
})

const kanbanColumns: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'received', label: 'Recebido', color: '#f59e0b' },
  { status: 'confirmed', label: 'Confirmado', color: '#3b82f6' },
  { status: 'preparing', label: 'Em Preparo', color: '#8b5cf6' },
  { status: 'ready', label: 'Pronto', color: '#10b981' },
  { status: 'delivered', label: 'Entregue', color: '#64748b' }
]

const openOrderDetails = (order: Order) => {
  selectedOrder.value = order
  isDetailsModalOpen.value = true
}

const openReceipt = (order: Order) => {
  selectedOrder.value = order
  isReceiptModalOpen.value = true
}

const handleStatusChange = async (newStatus: OrderStatus) => {
  if (!selectedOrder.value) return
  const userName = authStore.currentUser?.name || 'Administrador'
  const updated = await orderStore.updateOrderStatus(selectedOrder.value.id, newStatus, userName)
  selectedOrder.value = updated
}

const handlePaymentChange = async (newStatus: PaymentStatus) => {
  if (!selectedOrder.value) return
  const updated = await orderStore.updatePaymentStatus(selectedOrder.value.id, newStatus)
  selectedOrder.value = updated
}

const exportToCsv = () => {
  const headers = ['Codigo', 'Mesa', 'Cliente', 'Itens', 'Total (MT)', 'Estado', 'Pagamento', 'Data']
  const rows = orderStore.filteredOrders.map(o => [
    o.orderCode,
    o.tableNumber || 'Balcao',
    o.customerName || 'Cliente',
    o.items.map(i => `${i.quantity}x ${i.productName}`).join('; '),
    o.total,
    o.status,
    o.paymentStatus,
    o.createdAt
  ])

  const csvContent = 'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `pedidos_${tenantStore.currentRestaurant?.slug || 'tapmenu'}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  toastStore.success('Exportação CSV', 'Ficheiro de pedidos transferido com sucesso.')
}

const handlePrintReceipt = () => {
  window.print()
}
</script>

<template>
  <div class="orders-page">
    <!-- Header -->
    <div class="orders-header">
      <div>
        <h1 class="page-title">Gestão de Pedidos</h1>
        <p class="page-subtitle">Acompanhe, aprove e despache pedidos em tempo real para a cozinha</p>
      </div>

      <div class="header-actions">
        <!-- View Toggle -->
        <div class="view-toggle">
          <button
            class="toggle-btn"
            :class="{ 'is-active': viewMode === 'table' }"
            title="Vista em Tabela"
            @click="viewMode = 'table'"
          >
            <List :size="16" />
            <span>Tabela</span>
          </button>
          <button
            class="toggle-btn"
            :class="{ 'is-active': viewMode === 'kanban' }"
            title="Vista Kanban"
            @click="viewMode = 'kanban'"
          >
            <Columns :size="16" />
            <span>Kanban</span>
          </button>
        </div>

        <AppButton variant="secondary" @click="exportToCsv">
          <template #icon-left>
            <FileDown :size="16" />
          </template>
          Exportar CSV
        </AppButton>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filters-bar">
      <div class="search-input-wrap">
        <Search :size="16" class="search-icon" />
        <input
          v-model="orderStore.searchFilter"
          type="text"
          placeholder="Pesquisar por código #ORD, mesa ou cliente..."
          class="filter-input"
        />
      </div>

      <div class="selects-group">
        <select v-model="orderStore.statusFilter" class="filter-select">
          <option value="all">Todos os Estados</option>
          <option value="received">Recebido</option>
          <option value="confirmed">Confirmado</option>
          <option value="preparing">Em Preparação</option>
          <option value="ready">Pronto</option>
          <option value="delivered">Entregue</option>
          <option value="cancelled">Cancelado</option>
        </select>

        <select v-model="orderStore.tableFilter" class="filter-select">
          <option value="all">Todas as Mesas</option>
          <option value="01">Mesa 01</option>
          <option value="02">Mesa 02</option>
          <option value="03">Mesa 03</option>
          <option value="04">Mesa 04</option>
          <option value="05">Mesa 05</option>
          <option value="06">Mesa 06</option>
        </select>
      </div>
    </div>

    <!-- Table View -->
    <div v-if="viewMode === 'table'" class="table-card">
      <div v-if="orderStore.filteredOrders.length === 0" class="empty-state">
        <UtensilsCrossed :size="36" class="text-muted" />
        <p>Nenhum pedido encontrado com os filtros atuais.</p>
      </div>

      <div v-else class="orders-table-wrapper">
        <table class="orders-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Mesa</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Pagamento</th>
              <th>Hora</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in orderStore.filteredOrders"
              :key="order.id"
              class="order-row"
              @click="openOrderDetails(order)"
            >
              <td>
                <span class="code-pill">{{ order.orderCode }}</span>
              </td>
              <td>
                <strong>Mesa {{ order.tableNumber || 'Balcão' }}</strong>
              </td>
              <td>
                <span class="type-pill">{{ order.type === 'dine_in' ? 'No Local' : 'Takeaway' }}</span>
              </td>
              <td>{{ order.customerName || 'Cliente Mesa' }}</td>
              <td>
                <span class="items-preview">
                  {{ order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ') }}
                </span>
              </td>
              <td>
                <strong>{{ order.total.toLocaleString('pt-MZ') }} MT</strong>
              </td>
              <td>
                <AppBadge
                  :variant="
                    order.status === 'delivered' ? 'success' :
                    order.status === 'preparing' ? 'primary' :
                    order.status === 'ready' ? 'success' :
                    order.status === 'cancelled' ? 'danger' : 'warning'
                  "
                >
                  {{ order.status }}
                </AppBadge>
              </td>
              <td>
                <AppBadge :variant="order.paymentStatus === 'paid' ? 'success' : 'neutral'">
                  {{ order.paymentStatus }}
                </AppBadge>
              </td>
              <td class="text-xs text-muted">
                {{ new Date(order.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }}
              </td>
              <td class="text-right" @click.stop>
                <div class="row-actions">
                  <button class="action-btn" title="Imprimir Recibo" @click="openReceipt(order)">
                    <Printer :size="15" />
                  </button>
                  <button class="action-btn" title="Ver Detalhes" @click="openOrderDetails(order)">
                    <Eye :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Kanban View -->
    <div v-else class="kanban-board">
      <div
        v-for="col in kanbanColumns"
        :key="col.status"
        class="kanban-col"
      >
        <div class="col-header" :style="{ borderTopColor: col.color }">
          <span class="col-title">{{ col.label }}</span>
          <span class="col-count">
            {{ orderStore.orders.filter(o => o.status === col.status).length }}
          </span>
        </div>

        <div class="col-cards">
          <div
            v-for="order in orderStore.orders.filter(o => o.status === col.status)"
            :key="order.id"
            class="kanban-card"
            @click="openOrderDetails(order)"
          >
            <div class="card-top">
              <span class="k-code">{{ order.orderCode }}</span>
              <span class="k-table">Mesa {{ order.tableNumber || 'Balcão' }}</span>
            </div>

            <div class="k-items-list">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="k-item-line"
              >
                <span>{{ item.quantity }}x {{ item.productName }}</span>
              </div>
            </div>

            <div class="card-bottom">
              <span class="k-total">{{ order.total.toLocaleString('pt-MZ') }} MT</span>
              <span class="k-time">
                {{ new Date(order.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Order Details Modal -->
    <AppModal
      :is-open="isDetailsModalOpen"
      :title="`Detalhes do Pedido ${selectedOrder?.orderCode}`"
      :subtitle="`Mesa ${selectedOrder?.tableNumber || 'Balcão'} • Criado às ${selectedOrder ? new Date(selectedOrder.createdAt).toLocaleTimeString('pt-PT') : ''}`"
      maxWidth="680px"
      @close="isDetailsModalOpen = false"
    >
      <div v-if="selectedOrder" class="order-modal-details">
        <!-- Status Transition Buttons -->
        <div class="status-change-box">
          <div class="section-label">Avançar Estado Operacional:</div>
          <div class="status-buttons-row">
            <AppButton
              size="sm"
              :variant="selectedOrder.status === 'confirmed' ? 'primary' : 'outline'"
              @click="handleStatusChange('confirmed')"
            >
              Confirmar
            </AppButton>
            <AppButton
              size="sm"
              :variant="selectedOrder.status === 'preparing' ? 'primary' : 'outline'"
              @click="handleStatusChange('preparing')"
            >
              Em Preparação
            </AppButton>
            <AppButton
              size="sm"
              :variant="selectedOrder.status === 'ready' ? 'success' : 'outline'"
              @click="handleStatusChange('ready')"
            >
              Pronto a Servir
            </AppButton>
            <AppButton
              size="sm"
              :variant="selectedOrder.status === 'delivered' ? 'success' : 'outline'"
              @click="handleStatusChange('delivered')"
            >
              Entregue na Mesa
            </AppButton>
            <AppButton
              size="sm"
              variant="danger"
              @click="handleStatusChange('cancelled')"
            >
              Cancelar
            </AppButton>
          </div>
        </div>

        <!-- Payment Status Control -->
        <div class="payment-control-box">
          <div class="section-label">Estado do Pagamento:</div>
          <div class="status-buttons-row">
            <button
              class="pay-btn"
              :class="{ 'is-active': selectedOrder.paymentStatus === 'paid' }"
              @click="handlePaymentChange('paid')"
            >
              Pago
            </button>
            <button
              class="pay-btn"
              :class="{ 'is-active': selectedOrder.paymentStatus === 'pending' }"
              @click="handlePaymentChange('pending')"
            >
              Pendente
            </button>
            <button
              class="pay-btn"
              :class="{ 'is-active': selectedOrder.paymentStatus === 'refunded' }"
              @click="handlePaymentChange('refunded')"
            >
              Reembolsado
            </button>
          </div>
        </div>

        <!-- Items Breakdown -->
        <div class="items-box">
          <div class="section-label">Itens do Pedido:</div>
          <div class="modal-items-list">
            <div
              v-for="item in selectedOrder.items"
              :key="item.id"
              class="modal-item-row"
            >
              <div>
                <strong>{{ item.quantity }}x {{ item.productName }}</strong>
                <div v-if="item.selectedVariant" class="text-xs text-muted">
                  Variante: {{ item.selectedVariant.name }}
                </div>
                <div v-if="item.selectedAddons && item.selectedAddons.length > 0" class="text-xs text-muted">
                  Extras: {{ item.selectedAddons.map(a => a.name).join(', ') }}
                </div>
                <div v-if="item.removedIngredients && item.removedIngredients.length > 0" class="text-xs text-danger">
                  Remover: {{ item.removedIngredients.join(', ') }}
                </div>
                <div v-if="item.notes" class="text-xs text-primary">
                  Obs: "{{ item.notes }}"
                </div>
              </div>
              <div>{{ item.totalPrice.toLocaleString('pt-MZ') }} MT</div>
            </div>
          </div>

          <div class="financials-summary">
            <div>Subtotal: <strong>{{ selectedOrder.subtotal.toLocaleString('pt-MZ') }} MT</strong></div>
            <div>IVA ({{ tenantStore.currentRestaurant?.taxRate }}%): <strong>{{ selectedOrder.taxAmount.toLocaleString('pt-MZ') }} MT</strong></div>
            <div>Taxa de Serviço: <strong>{{ selectedOrder.serviceFee.toLocaleString('pt-MZ') }} MT</strong></div>
            <div class="grand-total">Total: <strong>{{ selectedOrder.total.toLocaleString('pt-MZ') }} MT</strong></div>
          </div>
        </div>

        <!-- Order Audit History -->
        <div class="history-box">
          <div class="section-label">Histórico de Alterações:</div>
          <div class="history-timeline">
            <div
              v-for="(h, idx) in selectedOrder.history"
              :key="idx"
              class="history-entry"
            >
              <div class="entry-dot"></div>
              <div class="entry-info">
                <span class="entry-status">{{ h.status.toUpperCase() }}</span>
                <span class="entry-meta">por {{ h.updatedBy }} às {{ new Date(h.timestamp).toLocaleTimeString('pt-PT') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isDetailsModalOpen = false">Fechar</AppButton>
        <AppButton variant="primary" @click="openReceipt(selectedOrder!)">
          <template #icon-left>
            <Printer :size="16" />
          </template>
          Imprimir Recibo
        </AppButton>
      </template>
    </AppModal>

    <!-- Receipt Print Simulation Modal -->
    <AppModal
      :is-open="isReceiptModalOpen"
      title="Recibo Comercial Demonstrativo"
      subtitle="Formato compatível com impressora térmica 80mm"
      maxWidth="420px"
      @close="isReceiptModalOpen = false"
    >
      <div v-if="selectedOrder" class="receipt-paper">
        <div class="receipt-header">
          <h2 class="receipt-restaurant-name">{{ tenantStore.currentRestaurant?.name }}</h2>
          <p class="receipt-line">{{ tenantStore.currentCompany?.name }}</p>
          <p class="receipt-line">NUIT: {{ tenantStore.currentCompany?.taxId }}</p>
          <p class="receipt-line">{{ tenantStore.currentRestaurant?.address.street }}</p>
          <p class="receipt-line">Tel: {{ tenantStore.currentRestaurant?.phone }}</p>
        </div>

        <div class="receipt-divider">--------------------------------</div>

        <div class="receipt-meta">
          <div>Pedido: <strong>{{ selectedOrder.orderCode }}</strong></div>
          <div>Mesa: <strong>{{ selectedOrder.tableNumber || 'Balcão' }}</strong></div>
          <div>Data: {{ new Date(selectedOrder.createdAt).toLocaleDateString('pt-PT') }} {{ new Date(selectedOrder.createdAt).toLocaleTimeString('pt-PT') }}</div>
          <div>Cliente: {{ selectedOrder.customerName || 'Consumidor Final' }}</div>
        </div>

        <div class="receipt-divider">--------------------------------</div>

        <div class="receipt-items">
          <div
            v-for="item in selectedOrder.items"
            :key="item.id"
            class="receipt-item-row"
          >
            <span>{{ item.quantity }}x {{ item.productName }}</span>
            <span>{{ item.totalPrice }} MT</span>
          </div>
        </div>

        <div class="receipt-divider">--------------------------------</div>

        <div class="receipt-totals">
          <div class="r-row"><span>Subtotal:</span><span>{{ selectedOrder.subtotal }} MT</span></div>
          <div class="r-row"><span>IVA ({{ tenantStore.currentRestaurant?.taxRate }}%):</span><span>{{ selectedOrder.taxAmount }} MT</span></div>
          <div class="r-row"><span>Serviço:</span><span>{{ selectedOrder.serviceFee }} MT</span></div>
          <div class="r-row r-grand"><span>TOTAL PAGO:</span><span>{{ selectedOrder.total }} MT</span></div>
          <div class="r-row"><span>Método:</span><span>{{ selectedOrder.paymentMethod?.toUpperCase() || 'M-PESA' }}</span></div>
        </div>

        <div class="receipt-divider">--------------------------------</div>

        <div class="receipt-footer">
          <p>Obrigado pela sua preferência!</p>
          <p>Documento processado por computador.</p>
          <p class="receipt-powered">TapMenu SaaS • Moçambique</p>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isReceiptModalOpen = false">Fechar</AppButton>
        <AppButton variant="primary" @click="handlePrintReceipt">
          <template #icon-left>
            <Printer :size="16" />
          </template>
          Imprimir
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.orders-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.orders-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.view-toggle {
  display: flex;
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.2rem;
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-600);
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toggle-btn.is-active {
  background: #ffffff;
  color: var(--color-primary-800);
  box-shadow: var(--shadow-xs);
}

/* Filters */
.filters-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1rem;
}

.search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-neutral-400);
}

.filter-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.selects-group {
  display: flex;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--color-neutral-800);
  background: #ffffff;
  outline: none;
}

/* Table Card */
.table-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.orders-table-wrapper {
  overflow-x: auto;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.orders-table th {
  background: var(--color-neutral-50);
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  border-bottom: 1px solid var(--border-medium);
}

.orders-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.order-row {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.order-row:hover {
  background-color: var(--color-neutral-50);
}

.code-pill {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-primary-800);
}

.type-pill {
  font-size: 0.75rem;
  background: var(--color-neutral-100);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
}

.items-preview {
  display: inline-block;
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-neutral-600);
  font-size: 0.8125rem;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
}

.action-btn {
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-neutral-700);
}

.action-btn:hover {
  background: var(--color-neutral-200);
}

.text-right {
  text-align: right;
}

/* Kanban */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  align-items: flex-start;
  overflow-x: auto;
  padding-bottom: 1rem;
}

.kanban-col {
  background: var(--color-neutral-100);
  border-radius: var(--radius-lg);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  min-width: 240px;
}

.col-header {
  border-top: 3px solid;
  padding-top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.col-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-800);
}

.col-count {
  background: #ffffff;
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 700;
}

.col-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.kanban-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.kanban-card:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--color-primary-300);
}

.card-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}

.k-code {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-primary-800);
}

.k-table {
  font-weight: 600;
  color: var(--color-neutral-600);
}

.k-items-list {
  font-size: 0.8125rem;
  color: var(--color-neutral-800);
  margin-bottom: 0.5rem;
}

.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-subtle);
  font-size: 0.75rem;
}

.k-total {
  font-weight: 700;
  color: var(--color-neutral-900);
}

.k-time {
  color: var(--text-muted);
}

/* Modals */
.order-modal-details {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  margin-bottom: 0.5rem;
}

.status-buttons-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pay-btn {
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  background: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.pay-btn.is-active {
  background: var(--color-primary-50);
  border-color: var(--color-primary-800);
  color: var(--color-primary-800);
}

.modal-items-list {
  background: var(--color-neutral-50);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal-item-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.financials-summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
  text-align: right;
  margin-top: 0.75rem;
}

.grand-total {
  font-size: 1.125rem;
  color: var(--color-primary-900);
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle);
}

.history-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.history-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.entry-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary-600);
}

/* Receipt Paper */
.receipt-paper {
  background: #ffffff;
  font-family: monospace;
  font-size: 0.8125rem;
  color: #000000;
  padding: 1rem;
  border: 1px dashed #cbd5e1;
}

.receipt-header {
  text-align: center;
}

.receipt-restaurant-name {
  font-size: 1.125rem;
  font-weight: 800;
}

.receipt-divider {
  text-align: center;
  color: #94a3b8;
  margin: 0.5rem 0;
}

.receipt-items {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.receipt-item-row, .r-row {
  display: flex;
  justify-content: space-between;
}

.r-grand {
  font-weight: 800;
  font-size: 0.9375rem;
}

.receipt-footer {
  text-align: center;
  font-size: 0.75rem;
  color: #64748b;
}

.receipt-powered {
  margin-top: 0.5rem;
  font-size: 0.6875rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}
</style>
