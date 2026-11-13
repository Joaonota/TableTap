<script setup lang="ts">
import { subscriptionStatusLabel } from '@/domain/statusLabels'
import { ref, onMounted, computed } from 'vue'
import { usePlatformStore } from '@/stores/platform'
import { usePlansStore } from '@/stores/plans'
import type { Subscription, SubscriptionStatus } from '@/types'
import SubscriptionManagerModal from '@/components/super-admin/SubscriptionManagerModal.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  CreditCard,
  Calendar,
  Settings,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Search,
  Filter
} from 'lucide-vue-next'

const platformStore = usePlatformStore()
const plansStore = usePlansStore()

const searchQuery = ref('')
const selectedStatusFilter = ref<string>('all')
const isManagerOpen = ref(false)
const selectedSubscription = ref<Subscription | null>(null)

onMounted(async () => {
  await Promise.all([
    platformStore.fetchPlatformData(),
    plansStore.fetchPlans()
  ])
})

const filteredSubscriptions = computed(() => {
  return platformStore.subscriptions.filter(sub => {
    const matchesSearch = !searchQuery.value ||
      sub.companyName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      sub.planName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      sub.tenantId.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesStatus = selectedStatusFilter.value === 'all' || sub.status === selectedStatusFilter.value

    return matchesSearch && matchesStatus
  })
})

const openManager = (sub: Subscription) => {
  selectedSubscription.value = sub
  isManagerOpen.value = true
}

const handleSaveSubscription = async (updates: Partial<Subscription>, historyNote?: string) => {
  if (!selectedSubscription.value) return
  const id = selectedSubscription.value.id
  const updated = await platformStore.updateSubscription(id, updates)
  if (updated && historyNote) await platformStore.addSubscriptionNote(id, historyNote)
  if (updated) isManagerOpen.value = false
}

/** Pedidos de alteração de plano feitos pelos donos das empresas. */
const pendingRequests = computed(() =>
  platformStore.pendingPlanChangeRequests.map(r => ({
    ...r,
    companyName: platformStore.subscriptions.find(s => s.tenantId === r.tenantId)?.companyName ?? 'Empresa',
    currentPlanName: platformStore.subscriptions.find(s => s.tenantId === r.tenantId)?.planName ?? '—',
    requestedPlanName: plansStore.plans.find(p => p.id === r.requestedPlanId)?.name ?? 'Plano'
  }))
)

/** Aplicar = mudar o plano da subscrição (o pedido fica aprovado automaticamente). */
const approveRequest = async (request: { tenantId: string; requestedPlanId: string }) => {
  const sub = platformStore.subscriptions.find(s => s.tenantId === request.tenantId)
  if (!sub) return
  await platformStore.updateSubscription(sub.id, { planId: request.requestedPlanId })
}

const getStatusBadgeVariant = (status: SubscriptionStatus): 'success' | 'warning' | 'danger' | 'primary' | 'neutral' => {
  switch (status) {
    case 'active': return 'success'
    case 'trial': return 'primary'
    case 'suspended': return 'warning'
    case 'expired':
    case 'cancelled': return 'danger'
    default: return 'neutral'
  }
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Subscrições & Faturamento SaaS</h1>
        <p class="page-subtitle">Acompanhamento executivo de contratos, receita recorrente (MRR), renovações e status das empresas</p>
      </div>
    </div>

    <!-- Pedidos de alteração de plano -->
    <div v-if="pendingRequests.length" class="requests-card">
      <div class="requests-head">
        <AlertCircle :size="18" />
        <strong>{{ pendingRequests.length }} {{ pendingRequests.length === 1 ? 'pedido' : 'pedidos' }} de alteração de plano</strong>
      </div>
      <div v-for="req in pendingRequests" :key="req.id" class="request-row">
        <div class="request-info">
          <strong>{{ req.companyName }}</strong>
          <span>{{ req.currentPlanName }} → <strong>{{ req.requestedPlanName }}</strong></span>
          <span class="request-meta">
            Pedido por {{ req.requestedByName || 'dono da empresa' }} em {{ new Date(req.createdAt).toLocaleDateString('pt-MZ') }}
            <template v-if="req.note"> · "{{ req.note }}"</template>
          </span>
        </div>
        <div class="request-actions">
          <AppButton size="sm" variant="primary" :loading="platformStore.isLoading" @click="approveRequest(req)">Aplicar plano</AppButton>
          <AppButton size="sm" variant="outline" @click="platformStore.rejectPlanChangeRequest(req.id)">Recusar</AppButton>
        </div>
      </div>
    </div>

    <!-- Top KPIs -->
    <div class="kpis-grid">
      <div class="kpi-card">
        <div class="kpi-icon-wrap mrr">
          <DollarSign :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">MRR (Receita Recorrente Mensal)</span>
          <div class="kpi-val">{{ platformStore.mrr.toLocaleString('pt-MZ') }} MT</div>
          <span class="kpi-sub">ARR Projetado: {{ platformStore.arr.toLocaleString('pt-MZ') }} MT</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap active-subs">
          <TrendingUp :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Subscrições Ativas</span>
          <div class="kpi-val">{{ platformStore.activeSubscriptionsCount }}</div>
          <span class="kpi-sub">{{ platformStore.subscriptions.length }} empresas contratantes</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap trial">
          <Calendar :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Em Período de Teste (Trial)</span>
          <div class="kpi-val">{{ platformStore.trialSubscriptionsCount }}</div>
          <span class="kpi-sub">Potencial de conversão</span>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filters-bar">
      <div class="search-wrap">
        <Search :size="16" class="search-icon" />
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Pesquisar por empresa, plano ou ID..."
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <Filter :size="15" />
        <select v-model="selectedStatusFilter" class="filter-select">
          <option value="all">Todos os Estados</option>
          <option value="active">Ativas</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspensas</option>
          <option value="expired">Expiradas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>
    </div>

    <!-- Subscriptions Table -->
    <div class="super-card table-card">
      <div class="table-scroll">
        <table class="super-table">
          <thead>
            <tr>
              <th>Empresa Cliente</th>
              <th>Plano Atual</th>
              <th>Equivalente Mensal</th>
              <th>Início</th>
              <th>Renovação</th>
              <th>Auto-Renovação</th>
              <th>Estado</th>
              <th class="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in filteredSubscriptions" :key="sub.id">
              <td>
                <div class="company-cell">
                  <strong class="text-white">{{ sub.companyName }}</strong>
                  <span class="tenant-tag font-mono">{{ sub.tenantId }}</span>
                </div>
              </td>
              <td>
                <span class="plan-pill">{{ sub.planName }}</span>
              </td>
              <td>
                <strong class="text-price font-mono">{{ sub.monthlyPrice.toLocaleString('pt-MZ') }} MT</strong>
              </td>
              <td>{{ new Date(sub.startDate).toLocaleDateString('pt-MZ') }}</td>
              <td>{{ new Date(sub.renewalDate).toLocaleDateString('pt-MZ') }}</td>
              <td>
                <span :class="sub.isAutoRenew ? 'text-success' : 'text-muted'">
                  {{ sub.isAutoRenew ? 'Sim (M-Pesa)' : 'Manual' }}
                </span>
              </td>
              <td>
                <AppBadge :variant="getStatusBadgeVariant(sub.status)">
                  {{ subscriptionStatusLabel(sub.status) }}
                </AppBadge>
              </td>
              <td class="text-right">
                <AppButton
                  variant="outline"
                  size="sm"
                  @click="openManager(sub)"
                >
                  <Settings :size="14" />
                  <span>Gerir</span>
                </AppButton>
              </td>
            </tr>

            <tr v-if="filteredSubscriptions.length === 0">
              <td colspan="8" class="text-center py-6 text-muted">
                Nenhuma subscrição encontrada com os filtros selecionados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Subscription Manager Modal -->
    <SubscriptionManagerModal
      :is-open="isManagerOpen"
      :subscription="selectedSubscription"
      :plans="plansStore.plans"
      @close="isManagerOpen = false"
      @save="handleSaveSubscription"
    />
  </div>
</template>

<style scoped>
.requests-card {
  background: var(--color-amber-50);
  border: 1px solid var(--color-amber-200);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.requests-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-amber-900);
}

.request-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #fff;
  border: 1px solid var(--color-amber-200);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.9rem;
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.85rem;
}

.request-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.request-actions {
  display: flex;
  gap: 0.5rem;
}

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

.kpi-icon-wrap.mrr {
  background: rgba(13, 122, 95, 0.15);
  color: #047857;
}

.kpi-icon-wrap.active-subs {
  background: rgba(56, 189, 248, 0.15);
  color: #0369a1;
}

.kpi-icon-wrap.trial {
  background: rgba(245, 158, 11, 0.15);
  color: #b45309;
}

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
  max-width: 400px;
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

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
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

.company-cell {
  display: flex;
  flex-direction: column;
}

.tenant-tag {
  font-size: 0.6875rem;
  color: #64748b;
}

.plan-pill {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  background: rgba(56, 189, 248, 0.12);
  color: #0369a1;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.text-price {
  color: #047857;
}

.text-success {
  color: #047857;
}

.text-muted {
  color: #64748b;
}

.text-right {
  text-align: right;
}
</style>
