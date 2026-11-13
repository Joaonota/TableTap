<script setup lang="ts">
import { subscriptionStatusLabel } from '@/domain/statusLabels'
import { ref, onMounted, computed } from 'vue'
import { tenantService, restaurantService, userService } from '@/services'
import { usePlatformStore } from '@/stores/platform'
import { usePlansStore } from '@/stores/plans'
import type { Company, Restaurant, User } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  Building2,
  Store,
  Users,
  CreditCard,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Activity,
  Layers,
  ArrowUpRight
} from 'lucide-vue-next'

const platformStore = usePlatformStore()
const plansStore = usePlansStore()

const companies = ref<Company[]>([])
const restaurants = ref<Restaurant[]>([])
const users = ref<User[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    await Promise.all([
      platformStore.fetchPlatformData(),
      plansStore.fetchPlans(),
      tenantService.getAllCompanies().then(c => companies.value = c),
      restaurantService.getAllRestaurants().then(r => restaurants.value = r),
      userService.getAllUsers().then(u => users.value = u)
    ])
  } finally {
    isLoading.value = false
  }
})

/** Novas empresas registadas por mês (últimos 6 meses), a partir das datas reais de registo. */
const companiesPerMonth = computed(() => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const value = companies.value.filter(c => {
      const created = new Date(c.createdAt)
      return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth()
    }).length
    const label = date.toLocaleDateString('pt-MZ', { month: 'short' })
    return { month: i === 5 ? `${label} (atual)` : label, value }
  })
})

const maxCompaniesPerMonth = computed(() => Math.max(1, ...companiesPerMonth.value.map(m => m.value)))

/** Cidades distintas onde há restaurantes registados. */
const restaurantCities = computed(() => [...new Set(restaurants.value.map(r => r.address.city.trim()).filter(Boolean))])

const planDistributionList = computed(() => {
  const counts = platformStore.planDistribution
  const total = platformStore.subscriptions.length || 1
  return Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    percent: Math.round((count / total) * 100)
  }))
})
</script>

<template>
  <div class="super-dashboard">
    <div class="super-header">
      <div>
        <h1 class="super-title">Consola Executiva Super Admin</h1>
        <p class="super-subtitle">Visão macro de todas as organizações, subscrições ativas, métricas SaaS e atividade do sistema</p>
      </div>

      <div class="header-pills">
        <span class="badge-status online">● Plataforma Operacional</span>
        <span class="badge-mrr font-mono">MRR: {{ platformStore.mrr.toLocaleString('pt-MZ') }} MT</span>
      </div>
    </div>

    <!-- Global SaaS Metrics -->
    <div class="super-metrics-grid">
      <div class="super-metric-card">
        <div class="m-head">
          <span>RECEITA RECORRENTE (MRR)</span>
          <CreditCard :size="18" class="m-icon m-icon-green" />
        </div>
        <div class="m-val">{{ platformStore.mrr.toLocaleString('pt-MZ') }} MT</div>
        <div class="m-sub">Subscrições ativas ({{ platformStore.trialSubscriptionsCount }} em período de teste não contam)</div>
      </div>

      <div class="super-metric-card">
        <div class="m-head">
          <span>RECEITA ANUALIZADA (ARR)</span>
          <Sparkles :size="18" class="m-icon m-icon-blue" />
        </div>
        <div class="m-val">{{ platformStore.arr.toLocaleString('pt-MZ') }} MT</div>
        <div class="m-sub">Projeção 12 meses</div>
      </div>

      <div class="super-metric-card">
        <div class="m-head">
          <span>EMPRESAS CLIENTES (TENANTS)</span>
          <Building2 :size="18" class="m-icon m-icon-purple" />
        </div>
        <div class="m-val">{{ companies.length }}</div>
        <div class="m-sub">{{ platformStore.activeSubscriptionsCount }} com subscrição ativa</div>
      </div>

      <div class="super-metric-card">
        <div class="m-head">
          <span>FILIAIS & RESTAURANTES</span>
          <Store :size="18" class="m-icon m-icon-orange" />
        </div>
        <div class="m-val">{{ restaurants.length }}</div>
        <div class="m-sub">
          {{ restaurantCities.length ? `Em ${restaurantCities.length} ${restaurantCities.length === 1 ? 'cidade' : 'cidades'}: ${restaurantCities.slice(0, 3).join(', ')}${restaurantCities.length > 3 ? '…' : ''}` : 'Sem cidade indicada' }}
        </div>
      </div>
    </div>

    <!-- Charts & Distribution Grid -->
    <div class="analytics-row">
      <!-- Revenue Growth Bar Chart -->
      <div class="super-card revenue-chart-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Novas empresas (últimos 6 meses)</h2>
            <p class="card-subtitle">Empresas registadas na plataforma em cada mês</p>
          </div>
        </div>

        <div v-if="!companies.length && !isLoading" class="empty-block">Ainda não existem empresas registadas.</div>
        <div v-else class="chart-bars">
          <div
            v-for="item in companiesPerMonth"
            :key="item.month"
            class="bar-column"
          >
            <div class="bar-val font-mono">{{ item.value }}</div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ height: `${Math.round((item.value / maxCompaniesPerMonth) * 100)}%` }"
              ></div>
            </div>
            <span class="bar-month">{{ item.month }}</span>
          </div>
        </div>
      </div>

      <!-- Plan Distribution -->
      <div class="super-card distribution-card">
        <div class="card-header">
          <h2 class="card-title">Distribuição de Planos</h2>
          <router-link to="/super-admin/planos" class="card-link">
            <span>Gerir</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>

        <div v-if="!planDistributionList.length" class="empty-block">Ainda não existem subscrições.</div>
        <div v-else class="distribution-list">
          <div
            v-for="p in planDistributionList"
            :key="p.name"
            class="dist-item"
          >
            <div class="dist-head">
              <strong class="dist-name">{{ p.name }}</strong>
              <span class="dist-val">{{ p.count }} subscrições ({{ p.percent }}%)</span>
            </div>
            <div class="dist-track">
              <div class="dist-fill" :style="{ width: `${p.percent}%` }"></div>
            </div>
          </div>
        </div>

        <div class="plan-quick-action">
          <router-link to="/super-admin/planos">
            <AppButton variant="outline" size="sm" class="w-full">
              <Layers :size="14" />
              <span>Configurar Catálogo de Planos</span>
            </AppButton>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Tables Grid: Subscriptions and Audit Logs -->
    <div class="super-tables-grid">
      <!-- Active Subscriptions -->
      <div class="super-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Subscrições de Clientes</h2>
            <p class="card-subtitle">Contratos ativos, em teste e renovações</p>
          </div>
          <router-link to="/super-admin/subscricoes" class="card-link">
            <span>Ver Todas</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>

        <div v-if="!platformStore.subscriptions.length" class="empty-block">Ainda não existem subscrições.</div>
        <div v-else class="subscriptions-list">
          <div
            v-for="sub in platformStore.subscriptions.slice(0, 6)"
            :key="sub.id"
            class="sub-item"
          >
            <div class="sub-left">
              <strong>{{ sub.companyName }}</strong>
              <div class="sub-meta">
                <span class="plan-badge-mini">{{ sub.planName }}</span>
                <span>• Renovação: {{ new Date(sub.renewalDate).toLocaleDateString('pt-MZ') }}</span>
              </div>
            </div>
            <div class="sub-right">
              <strong class="font-mono text-price">{{ sub.monthlyPrice.toLocaleString('pt-MZ') }} MT</strong>
              <AppBadge :variant="sub.status === 'active' ? 'success' : sub.status === 'trial' ? 'primary' : 'warning'">
                {{ subscriptionStatusLabel(sub.status) }}
              </AppBadge>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Log Feed -->
      <div class="super-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Registo de Atividades (Auditoria)</h2>
            <p class="card-subtitle">Últimas ações e eventos críticos no sistema</p>
          </div>
          <router-link to="/super-admin/atividade" class="card-link">
            <span>Ver Tudo</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>

        <div v-if="!platformStore.auditLogs.length" class="empty-block">Ainda não há atividade registada.</div>
        <div v-else class="audit-feed">
          <div
            v-for="log in platformStore.auditLogs.slice(0, 5)"
            :key="log.id"
            class="audit-item"
          >
            <div class="audit-icon-bullet">
              <Activity :size="13" />
            </div>
            <div class="audit-content">
              <div class="audit-top">
                <span class="audit-action font-mono">{{ log.action }}</span>
                <span class="audit-time">{{ new Date(log.createdAt ?? log.timestamp ?? Date.now()).toLocaleDateString('pt-MZ') }}</span>
              </div>
              <p class="audit-details">{{ log.details }}</p>
              <div class="audit-actor">Por: <strong>{{ log.userName }}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-block {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-muted);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-md);
}

.super-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.super-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.super-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.super-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.25rem 0 0;
}

.header-pills {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.badge-status.online {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
}

.badge-mrr {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0369a1;
  background: rgba(56, 189, 248, 0.12);
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
}

.super-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

@media (max-width: 1024px) {
  .super-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .super-metrics-grid {
    grid-template-columns: 1fr;
  }
}

.super-metric-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.m-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #64748b;
}

.m-icon {
  padding: 4px;
  border-radius: 6px;
  box-sizing: content-box;
}

.m-icon-green {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.m-icon-blue {
  background: rgba(56, 189, 248, 0.12);
  color: #0369a1;
}

.m-icon-purple {
  background: rgba(168, 85, 247, 0.12);
  color: #7e22ce;
}

.m-icon-orange {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.m-val {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
}

.m-sub {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.text-success {
  color: #047857;
}

.analytics-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .analytics-row {
    grid-template-columns: 1fr;
  }
}

.super-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.card-subtitle {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0.2rem 0 0;
}

.currency-tag {
  font-size: 0.6875rem;
  color: #64748b;
}

.card-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: #0369a1;
  font-weight: 600;
  text-decoration: none;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  height: 180px;
  padding-top: 1rem;
}

.bar-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
}

.bar-val {
  font-size: 0.6875rem;
  color: #64748b;
}

.bar-track {
  flex: 1;
  width: 100%;
  max-width: 44px;
  background: #f8fafc;
  border-radius: 6px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(180deg, #38bdf8 0%, #0d7a5f 100%);
  border-radius: 6px 6px 0 0;
  transition: height 0.4s ease;
}

.bar-month {
  font-size: 0.75rem;
  color: #64748b;
}

.distribution-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  flex: 1;
}

.dist-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  margin-bottom: 0.3rem;
}

.dist-name {
  color: #0f172a;
}

.dist-val {
  color: #64748b;
  font-size: 0.75rem;
}

.dist-track {
  height: 8px;
  background: #f8fafc;
  border-radius: 4px;
  overflow: hidden;
}

.dist-fill {
  height: 100%;
  background: #0d7a5f;
  border-radius: 4px;
}

.plan-quick-action {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.super-tables-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .super-tables-grid {
    grid-template-columns: 1fr;
  }
}

.subscriptions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sub-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.sub-left strong {
  display: block;
  font-size: 0.875rem;
  color: #0f172a;
}

.sub-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.2rem;
}

.plan-badge-mini {
  color: #0369a1;
  font-weight: 700;
}

.sub-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
}

.text-price {
  color: #047857;
}

.audit-feed {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.audit-icon-bullet {
  color: #0369a1;
  margin-top: 2px;
}

.audit-content {
  flex: 1;
}

.audit-top {
  display: flex;
  justify-content: space-between;
}

.audit-action {
  font-size: 0.75rem;
  font-weight: 700;
  color: #0369a1;
}

.audit-time {
  font-size: 0.6875rem;
  color: #64748b;
}

.audit-details {
  font-size: 0.7813rem;
  color: #334155;
  margin: 0.2rem 0;
  line-height: 1.35;
}

.audit-actor {
  font-size: 0.6875rem;
  color: #64748b;
}
</style>
