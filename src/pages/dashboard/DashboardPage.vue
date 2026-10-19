<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTenantStore } from '@/stores/tenant'
import { useOrderStore } from '@/stores/order'
import { reportService } from '@/services'
import MetricCard from '@/components/ui/MetricCard.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import type { DashboardMetrics } from '@/types'
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Grid,
  Clock,
  ChefHat,
  BellRing,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Plus
} from 'lucide-vue-next'

const router = useRouter()
const tenantStore = useTenantStore()
const orderStore = useOrderStore()

const timePeriod = ref<'today' | '7days' | '30days'>('today')
const metrics = ref<DashboardMetrics>({
  totalOrders: 0,
  totalRevenue: 0,
  averageTicket: 0,
  occupiedTables: 0,
  availableTables: 0,
  pendingOrders: 0,
  preparingOrders: 0,
  readyOrders: 0,
  activeServiceRequests: 0,
  unavailableProductsCount: 0
})

const salesChartData = ref<{ label: string; amount: number; orderCount: number }[]>([])
const topProducts = ref<{ name: string; quantity: number; revenue: number }[]>([])
const isLoading = ref(true)

const loadDashboardData = async () => {
  if (!tenantStore.currentRestaurant) return
  isLoading.value = true
  try {
    const restId = tenantStore.currentRestaurant.id
    const [m, sales, top] = await Promise.all([
      reportService.getDashboardMetrics(restId),
      reportService.getSalesByDay(restId),
      reportService.getTopProducts(restId)
    ])
    metrics.value = m
    salesChartData.value = sales
    topProducts.value = top
  } finally {
    isLoading.value = false
  }
}

watch(() => tenantStore.currentRestaurant?.id, () => {
  loadDashboardData()
})

onMounted(() => {
  loadDashboardData()
})

const maxSalesAmount = () => {
  const max = Math.max(...salesChartData.value.map(d => d.amount), 1)
  return max
}
</script>

<template>
  <div class="dashboard-page">
    <!-- Page Header -->
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">Dashboard Operacional</h1>
        <p class="page-subtitle">
          Visão em tempo real de <strong>{{ tenantStore.currentRestaurant?.name }}</strong> ({{ tenantStore.currentCompany?.name }})
        </p>
      </div>

      <div class="header-actions">
        <div class="period-selector">
          <button
            type="button"
            class="period-btn"
            :class="{ 'is-active': timePeriod === 'today' }"
            @click="timePeriod = 'today'"
          >
            Hoje
          </button>
          <button
            type="button"
            class="period-btn"
            :class="{ 'is-active': timePeriod === '7days' }"
            @click="timePeriod = '7days'"
          >
            Últimos 7 Dias
          </button>
          <button
            type="button"
            class="period-btn"
            :class="{ 'is-active': timePeriod === '30days' }"
            @click="timePeriod = '30days'"
          >
            30 Dias
          </button>
        </div>

        <router-link to="/app/pedidos">
          <AppButton variant="primary">
            <template #icon-left>
              <Plus :size="16" />
            </template>
            Novo Pedido
          </AppButton>
        </router-link>
      </div>
    </div>

    <!-- Metrics Cards Grid -->
    <div class="metrics-grid">
      <MetricCard
        title="Receita de Vendas"
        :value="`${metrics.totalRevenue.toLocaleString('pt-MZ')} MT`"
        variant="primary"
        :icon="DollarSign"
        :trend="{ value: '14.2% vs ontem', isPositive: true }"
      />

      <MetricCard
        title="Total de Pedidos"
        :value="metrics.totalOrders"
        variant="success"
        :icon="ShoppingBag"
        subtitle="Registados hoje no restaurante"
      />

      <MetricCard
        title="Ticket Médio"
        :value="`${metrics.averageTicket.toLocaleString('pt-MZ')} MT`"
        variant="neutral"
        :icon="TrendingUp"
        subtitle="Média por pedido concluído"
      />

      <MetricCard
        title="Ocupação das Mesas"
        :value="`${metrics.occupiedTables} / ${metrics.occupiedTables + metrics.availableTables}`"
        variant="warning"
        :icon="Grid"
        :subtitle="`${metrics.availableTables} mesas livres no momento`"
      />
    </div>

    <!-- Secondary Status Metrics -->
    <div class="sub-metrics-row">
      <div class="sub-metric-pill" :class="{ 'has-alert': metrics.pendingOrders > 0 }">
        <Clock :size="16" class="pill-icon text-warning" />
        <span><strong>{{ metrics.pendingOrders }}</strong> Pendentes</span>
      </div>

      <div class="sub-metric-pill">
        <ChefHat :size="16" class="pill-icon text-primary" />
        <span><strong>{{ metrics.preparingOrders }}</strong> Na Cozinha / KDS</span>
      </div>

      <div class="sub-metric-pill">
        <ShoppingBag :size="16" class="pill-icon text-success" />
        <span><strong>{{ metrics.readyOrders }}</strong> Prontos para Servir</span>
      </div>

      <div class="sub-metric-pill" :class="{ 'has-danger': metrics.activeServiceRequests > 0 }">
        <BellRing :size="16" class="pill-icon text-danger" />
        <span><strong>{{ metrics.activeServiceRequests }}</strong> Chamadas de Garçom</span>
      </div>

      <div v-if="metrics.unavailableProductsCount > 0" class="sub-metric-pill warning">
        <AlertTriangle :size="16" class="pill-icon text-warning" />
        <span><strong>{{ metrics.unavailableProductsCount }}</strong> Itens Esgotados</span>
      </div>
    </div>

    <!-- Charts & Analytics Section -->
    <div class="dashboard-main-grid">
      <!-- Sales Chart Card -->
      <div class="chart-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Fluxo de Vendas Semanal</h2>
            <p class="card-sub">Valores apurados em Meticais (MT)</p>
          </div>
          <router-link to="/app/relatorios" class="card-link">
            <span>Ver Relatório Completo</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>

        <div class="bar-chart-container">
          <div
            v-for="(day, idx) in salesChartData"
            :key="idx"
            class="chart-bar-col"
          >
            <div class="bar-val">{{ day.amount > 0 ? `${(day.amount / 1000).toFixed(1)}k` : '0' }}</div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ height: `${Math.max((day.amount / maxSalesAmount()) * 100, 6)}%` }"
                :title="`${day.label}: ${day.amount} MT (${day.orderCount} pedidos)`"
              ></div>
            </div>
            <span class="bar-label">{{ day.label }}</span>
          </div>
        </div>
      </div>

      <!-- Top Selling Products -->
      <div class="top-products-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Pratos Mais Pedidos</h2>
            <p class="card-sub">Itens de maior volume e preferência</p>
          </div>
          <router-link to="/app/menu/produtos" class="card-link">
            <span>Ver Catálogo</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>

        <div class="top-products-list">
          <div
            v-for="(prod, i) in topProducts"
            :key="i"
            class="top-product-item"
          >
            <div class="rank-number">#{{ i + 1 }}</div>
            <div class="prod-details">
              <span class="prod-name">{{ prod.name }}</span>
              <span class="prod-sales">{{ prod.quantity }} doses vendidas</span>
            </div>
            <div class="prod-revenue">{{ prod.revenue.toLocaleString('pt-MZ') }} MT</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Orders Live Feed -->
    <div class="recent-orders-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Atividade Recente de Pedidos</h2>
          <p class="card-sub">Últimos pedidos registados nas mesas</p>
        </div>
        <router-link to="/app/pedidos">
          <AppButton variant="secondary" size="sm">
            <span>Ver Todos os Pedidos</span>
            <ArrowRight :size="14" />
          </AppButton>
        </router-link>
      </div>

      <div class="recent-orders-table-wrapper">
        <table class="recent-orders-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Mesa</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Estado Pedido</th>
              <th>Pagamento</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in orderStore.orders.slice(0, 5)"
              :key="order.id"
            >
              <td>
                <span class="order-code">{{ order.orderCode }}</span>
              </td>
              <td>
                <strong>Mesa {{ order.tableNumber || 'Balcão' }}</strong>
              </td>
              <td>{{ order.customerName || 'Cliente' }}</td>
              <td>{{ order.items.length }} {{ order.items.length === 1 ? 'item' : 'itens' }}</td>
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
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.dashboard-header {
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
  margin-top: 0.25rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.period-selector {
  display: flex;
  background: var(--color-neutral-100);
  padding: 0.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.period-btn {
  background: transparent;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--color-neutral-600);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.period-btn.is-active {
  background: #ffffff;
  color: var(--color-primary-800);
  box-shadow: var(--shadow-xs);
}

/* Metrics */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

.sub-metrics-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sub-metric-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  box-shadow: var(--shadow-xs);
}

.sub-metric-pill.has-alert {
  border-color: var(--color-warning-500);
  background: var(--color-warning-50);
}

.sub-metric-pill.has-danger {
  border-color: var(--color-danger-500);
  background: var(--color-danger-50);
}

.sub-metric-pill.warning {
  border-color: var(--color-warning-500);
  background: var(--color-warning-50);
}

/* Main Grid */
.dashboard-main-grid {
  display: grid;
  grid-template-columns: 2fr 1.2fr;
  gap: 1.5rem;
}

.chart-card, .top-products-card, .recent-orders-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.card-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.card-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.card-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-700);
}

/* Bar Chart */
.bar-chart-container {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 200px;
  padding-top: 1.5rem;
  gap: 1rem;
}

.chart-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-val {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-neutral-400);
  margin-bottom: 0.35rem;
}

.bar-track {
  width: 100%;
  max-width: 42px;
  flex: 1;
  background: var(--color-neutral-100);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(180deg, var(--color-primary-600) 0%, var(--color-primary-800) 100%);
  border-radius: var(--radius-sm);
  transition: height 0.4s ease;
}

.bar-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
  font-weight: 500;
}

/* Top Products */
.top-products-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.top-product-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.rank-number {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--color-primary-800);
  width: 24px;
}

.prod-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.prod-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-900);
}

.prod-sales {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.prod-revenue {
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--color-neutral-900);
}

/* Recent Orders Table */
.recent-orders-table-wrapper {
  overflow-x: auto;
}

.recent-orders-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.recent-orders-table th {
  padding: 0.75rem 1rem;
  background: var(--color-neutral-50);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  border-bottom: 1px solid var(--border-medium);
}

.recent-orders-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--color-neutral-800);
}

.order-code {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-primary-800);
}

@media (max-width: 1100px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard-main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 650px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
