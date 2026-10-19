<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reportService, orderService } from '@/services'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import MetricCard from '@/components/ui/MetricCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import type { DashboardMetrics, Order } from '@/types'
import {
  BarChart3,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  FileDown,
  PieChart,
  Calendar,
  CreditCard
} from 'lucide-vue-next'

const tenantStore = useTenantStore()
const toastStore = useToastStore()

const period = ref<'week' | 'month' | 'year'>('week')
const metrics = ref<DashboardMetrics | null>(null)
const salesDays = ref<{ label: string; amount: number; orderCount: number }[]>([])
const topProducts = ref<{ name: string; quantity: number; revenue: number }[]>([])
const orders = ref<Order[]>([])
const isLoading = ref(true)

const loadReports = async () => {
  if (!tenantStore.currentRestaurant) return
  isLoading.value = true
  try {
    const restId = tenantStore.currentRestaurant.id
    const [m, s, p, ords] = await Promise.all([
      reportService.getDashboardMetrics(restId),
      reportService.getSalesByDay(restId),
      reportService.getTopProducts(restId),
      orderService.getOrders(restId)
    ])
    metrics.value = m
    salesDays.value = s
    topProducts.value = p
    orders.value = ords
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadReports()
})

const paymentMethodsStats = computed(() => {
  const map: { [key: string]: number } = { mpesa: 0, emola: 0, card: 0, cash: 0 }
  orders.value.forEach(o => {
    if (o.paymentMethod) {
      map[o.paymentMethod] = (map[o.paymentMethod] || 0) + o.total
    }
  })
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1
  return [
    { name: 'M-Pesa', amount: map.mpesa, percent: Math.round((map.mpesa / total) * 100), color: '#ef4444' },
    { name: 'e-Mola', amount: map.emola, percent: Math.round((map.emola / total) * 100), color: '#f59e0b' },
    { name: 'Cartão POS', amount: map.card, percent: Math.round((map.card / total) * 100), color: '#3b82f6' },
    { name: 'Numerário / Caixa', amount: map.cash, percent: Math.round((map.cash / total) * 100), color: '#10b981' }
  ]
})

const exportReportsCsv = () => {
  const rows = [
    ['Periodo', 'Receita (MT)', 'Pedidos'],
    ...salesDays.value.map(d => [d.label, d.amount, d.orderCount])
  ]
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `relatorio_vendas_${tenantStore.currentRestaurant?.slug}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  toastStore.success('Relatório Exportado', 'Ficheiro de vendas gerado com sucesso.')
}
</script>

<template>
  <div class="reports-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Relatórios & Inteligência de Negócio</h1>
        <p class="page-subtitle">Desempenho de vendas, faturamento e canais de pagamento em Meticais (MT)</p>
      </div>

      <div class="header-actions">
        <div class="period-select-wrap">
          <Calendar :size="15" />
          <select v-model="period" class="period-dropdown">
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
            <option value="year">Ano Corrente (2026)</option>
          </select>
        </div>

        <AppButton variant="secondary" @click="exportReportsCsv">
          <template #icon-left>
            <FileDown :size="16" />
          </template>
          Exportar Relatório CSV
        </AppButton>
      </div>
    </div>

    <!-- Metrics Cards -->
    <div v-if="metrics" class="metrics-grid">
      <MetricCard
        title="Receita Acumulada"
        :value="`${metrics.totalRevenue.toLocaleString('pt-MZ')} MT`"
        variant="primary"
        :icon="DollarSign"
        :trend="{ value: '18% vs período anterior', isPositive: true }"
      />

      <MetricCard
        title="Volume de Pedidos"
        :value="metrics.totalOrders"
        variant="success"
        :icon="ShoppingBag"
        subtitle="Registados nas mesas e takeaway"
      />

      <MetricCard
        title="Ticket Médio"
        :value="`${metrics.averageTicket.toLocaleString('pt-MZ')} MT`"
        variant="neutral"
        :icon="TrendingUp"
        subtitle="Consumo médio por mesa"
      />

      <MetricCard
        title="Taxa de Cancelamentos"
        value="2.8%"
        variant="warning"
        :icon="BarChart3"
        subtitle="Dentro do padrão operacional"
      />
    </div>

    <!-- Reports Main Row -->
    <div class="reports-grid">
      <!-- Sales Chart -->
      <div class="app-card chart-card">
        <div class="card-header">
          <h2 class="card-title">Curva de Faturamento Diário</h2>
          <span class="badge badge-primary">Moeda: MT</span>
        </div>

        <div class="chart-bars">
          <div
            v-for="(day, idx) in salesDays"
            :key="idx"
            class="bar-column"
          >
            <div class="bar-value">{{ (day.amount / 1000).toFixed(1) }}k</div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ height: `${Math.max((day.amount / 35000) * 100, 8)}%` }"
              ></div>
            </div>
            <span class="bar-name">{{ day.label }}</span>
          </div>
        </div>
      </div>

      <!-- Payment Breakdown -->
      <div class="app-card payments-card">
        <div class="card-header">
          <h2 class="card-title">Métodos de Pagamento</h2>
          <CreditCard :size="18" class="text-muted" />
        </div>

        <div class="payment-methods-list">
          <div
            v-for="pm in paymentMethodsStats"
            :key="pm.name"
            class="pm-row"
          >
            <div class="pm-info">
              <span class="pm-dot" :style="{ backgroundColor: pm.color }"></span>
              <strong>{{ pm.name }}</strong>
            </div>

            <div class="pm-stats">
              <span class="pm-amount">{{ pm.amount.toLocaleString('pt-MZ') }} MT</span>
              <span class="pm-percent">({{ pm.percent }}%)</span>
            </div>

            <div class="pm-progress-track">
              <div class="pm-progress-fill" :style="{ width: `${pm.percent}%`, backgroundColor: pm.color }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Products Table -->
    <div class="app-card top-table-card">
      <div class="card-header">
        <h2 class="card-title">Ranking de Rentabilidade por Produto</h2>
        <span class="badge badge-neutral">Top 5 Mais Vendidos</span>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th>Posição</th>
            <th>Nome do Prato / Bebida</th>
            <th>Doses Vendidas</th>
            <th>Faturamento Gerado</th>
            <th>Contribuição</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, idx) in topProducts" :key="p.name">
            <td><strong>#{{ idx + 1 }}</strong></td>
            <td>{{ p.name }}</td>
            <td><strong>{{ p.quantity }}</strong> unidades</td>
            <td><strong>{{ p.revenue.toLocaleString('pt-MZ') }} MT</strong></td>
            <td>
              <AppBadge variant="success">Alta Margem</AppBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.reports-page {
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
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.period-select-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
}

.period-dropdown {
  border: none;
  background: transparent;
  outline: none;
  font-weight: 600;
  color: var(--color-neutral-800);
  cursor: pointer;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

.reports-grid {
  display: grid;
  grid-template-columns: 2fr 1.2fr;
  gap: 1.5rem;
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

/* Bars */
.chart-bars {
  display: flex;
  align-items: flex-end;
  height: 220px;
  gap: 1.25rem;
  padding-top: 1.5rem;
}

.bar-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-value {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.bar-track {
  width: 100%;
  max-width: 44px;
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

.bar-name {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

/* Payments Breakdown */
.payment-methods-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pm-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pm-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.pm-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.pm-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.pm-amount {
  font-weight: 700;
  color: var(--color-neutral-900);
}

.pm-percent {
  color: var(--text-muted);
}

.pm-progress-track {
  width: 100%;
  height: 6px;
  background: var(--color-neutral-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.pm-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
}

/* Table */
.top-table-card {
  padding: 1.25rem 1.5rem;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.report-table th {
  padding: 0.75rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  border-bottom: 1px solid var(--border-medium);
}

.report-table td {
  padding: 0.875rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

@media (max-width: 1024px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .reports-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
