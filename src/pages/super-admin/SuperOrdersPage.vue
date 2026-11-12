<script setup lang="ts">
import { orderStatusLabel } from '@/domain/statusLabels'
import { ref, onMounted, computed } from 'vue'
import { mockStorage } from '@/repositories/mock/mockStorage'
import { restaurantService, tenantService } from '@/services'
import type { Order, Restaurant, Company, OrderStatus } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { ShoppingBag, DollarSign, Clock, CheckCircle2, Search, Filter } from 'lucide-vue-next'

const orders = ref<Order[]>([])
const restaurants = ref<Restaurant[]>([])
const companies = ref<Company[]>([])
const isLoading = ref(true)

const searchQuery = ref('')
const selectedStatusFilter = ref<string>('all')
const selectedTenantFilter = ref<string>('all')

onMounted(async () => {
  try {
    orders.value = mockStorage.getDb().orders || []
    const [r, c] = await Promise.all([
      restaurantService.getAllRestaurants(),
      tenantService.getAllCompanies()
    ])
    restaurants.value = r
    companies.value = c
  } finally {
    isLoading.value = false
  }
})

const getRestaurantName = (restaurantId: string) => {
  return restaurants.value.find(r => r.id === restaurantId)?.name || 'Restaurante'
}

const getCompanyName = (tenantId: string) => {
  return companies.value.find(c => c.id === tenantId)?.name || 'Empresa'
}

const totalVolume = computed(() => {
  return orders.value
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0)
})

const averageTicket = computed(() => {
  const valid = orders.value.filter(o => o.status !== 'cancelled')
  return valid.length > 0 ? Math.round(totalVolume.value / valid.length) : 0
})

const filteredOrders = computed(() => {
  return orders.value.filter(o => {
    const matchesSearch = !searchQuery.value ||
      o.orderCode.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (o.customerName && o.customerName.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      getRestaurantName(o.restaurantId).toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesStatus = selectedStatusFilter.value === 'all' || o.status === selectedStatusFilter.value
    const matchesTenant = selectedTenantFilter.value === 'all' || o.tenantId === selectedTenantFilter.value

    return matchesSearch && matchesStatus && matchesTenant
  })
})

const getOrderStatusBadge = (status: OrderStatus): 'neutral' | 'primary' | 'warning' | 'success' | 'danger' => {
  switch (status) {
    case 'received': return 'primary'
    case 'confirmed': return 'primary'
    case 'preparing': return 'warning'
    case 'ready': return 'warning'
    case 'delivered': return 'success'
    case 'cancelled': return 'danger'
    default: return 'neutral'
  }
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Monitorização Global de Pedidos</h1>
        <p class="page-subtitle">Acompanhe em tempo real o fluxo transacional de pedidos em todos os restaurantes da plataforma</p>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpis-grid">
      <div class="kpi-card">
        <div class="kpi-icon-wrap orders">
          <ShoppingBag :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Volume Total de Pedidos</span>
          <div class="kpi-val">{{ orders.length }}</div>
          <span class="kpi-sub">{{ orders.filter(o => o.status === 'delivered').length }} concluídos com sucesso</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap rev">
          <DollarSign :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Valor Transacionado (Total)</span>
          <div class="kpi-val font-mono">{{ totalVolume.toLocaleString('pt-MZ') }} MT</div>
          <span class="kpi-sub">Transações líquidas no sistema</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap ticket">
          <CheckCircle2 :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Ticket Médio da Plataforma</span>
          <div class="kpi-val font-mono">{{ averageTicket.toLocaleString('pt-MZ') }} MT</div>
          <span class="kpi-sub">Por pedido finalizado</span>
        </div>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="filters-bar">
      <div class="search-wrap">
        <Search :size="16" class="search-icon" />
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Pesquisar código do pedido, cliente ou restaurante..."
          class="search-input"
        />
      </div>

      <div class="filter-actions">
        <select v-model="selectedTenantFilter" class="filter-select">
          <option value="all">Todas as Empresas</option>
          <option v-for="c in companies" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>

        <select v-model="selectedStatusFilter" class="filter-select">
          <option value="all">Todos os Estados</option>
          <option value="received">Recebido</option>
          <option value="preparing">A Preparar</option>
          <option value="ready">Pronto</option>
          <option value="delivered">Entregue</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="super-card table-card">
      <div class="table-scroll">
        <table class="super-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Empresa & Restaurante</th>
              <th>Mesa</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th>Valor Total</th>
              <th>Pagamento</th>
              <th>Estado</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ord in filteredOrders" :key="ord.id">
              <td>
                <strong class="order-code font-mono text-white">{{ ord.orderCode.startsWith('#') ? ord.orderCode : `#${ord.orderCode}` }}</strong>
              </td>
              <td>
                <div class="rest-tenant-cell">
                  <strong>{{ getRestaurantName(ord.restaurantId) }}</strong>
                  <span class="text-xs text-muted">{{ getCompanyName(ord.tenantId) }}</span>
                </div>
              </td>
              <td>Mesa {{ ord.tableNumber }}</td>
              <td>{{ ord.customerName || 'Cliente Anónimo' }}</td>
              <td>{{ ord.items.reduce((s, i) => s + i.quantity, 0) }} itens</td>
              <td>
                <strong class="font-mono text-price">{{ ord.total.toLocaleString('pt-MZ') }} MT</strong>
              </td>
              <td>
                <span
                  class="pay-status"
                  :class="ord.paymentStatus === 'paid' ? 'paid' : 'pending'"
                >
                  {{ ord.paymentStatus === 'paid' ? 'Pago' : 'Pendente' }}
                </span>
              </td>
              <td>
                <AppBadge :variant="getOrderStatusBadge(ord.status)">
                  {{ orderStatusLabel(ord.status) }}
                </AppBadge>
              </td>
              <td>
                <span class="text-xs text-muted">
                  {{ new Date(ord.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </td>
            </tr>

            <tr v-if="filteredOrders.length === 0">
              <td colspan="9" class="text-center py-6 text-muted">
                Nenhum pedido encontrado para os filtros selecionados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.super-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.2rem;
}

.kpis-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .kpis-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.kpi-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-icon-wrap.orders { background: rgba(56, 189, 248, 0.15); color: #0369a1; }
.kpi-icon-wrap.rev { background: rgba(16, 185, 129, 0.15); color: #047857; }
.kpi-icon-wrap.ticket { background: rgba(245, 158, 11, 0.15); color: #b45309; }

.kpi-info {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

.kpi-val {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0.15rem 0;
}

.kpi-sub {
  font-size: 0.7188rem;
  color: #64748b;
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.search-wrap {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0 0.85rem;
  flex: 1;
  max-width: 450px;
}

.search-icon {
  color: #64748b;
  margin-right: 0.5rem;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.65rem 0;
  color: #0f172a;
  font-size: 0.875rem;
  outline: none;
}

.filter-actions {
  display: flex;
  gap: 0.75rem;
}

.filter-select {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  color: #0f172a;
  font-size: 0.875rem;
  outline: none;
}

.super-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.super-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.super-table th {
  background: #f8fafc;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.super-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
}

.super-table tr:hover {
  background: #f8fafc;
}

.order-code {
  white-space: nowrap;
  color: #0369a1;
}

.rest-tenant-cell {
  display: flex;
  flex-direction: column;
}

.text-price {
  color: #047857;
}

.pay-status {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.pay-status.paid {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.pay-status.pending {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
}
.super-table :deep(.app-badge) {
  white-space: nowrap;
}
</style>

