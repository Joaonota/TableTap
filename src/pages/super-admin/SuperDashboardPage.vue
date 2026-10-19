<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { tenantService, restaurantService, subscriptionService, authService } from '@/services'
import type { Company, Restaurant, Subscription, Plan, User } from '@/types'
import MetricCard from '@/components/ui/MetricCard.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Building2,
  Store,
  Users,
  CreditCard,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  ArrowRight
} from 'lucide-vue-next'

const companies = ref<Company[]>([])
const restaurants = ref<Restaurant[]>([])
const subscriptions = ref<Subscription[]>([])
const plans = ref<Plan[]>([])
const users = ref<User[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [c, r, s, p, u] = await Promise.all([
      tenantService.getAllCompanies(),
      restaurantService.getAllRestaurants(),
      subscriptionService.getAllSubscriptions(),
      subscriptionService.getAllPlans(),
      authService.getDemoUsers()
    ])
    companies.value = c
    restaurants.value = r
    subscriptions.value = s
    plans.value = p
    users.value = u
  } finally {
    isLoading.value = false
  }
})

const totalMrr = () => {
  return subscriptions.value
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + s.monthlyPrice, 0)
}
</script>

<template>
  <div class="super-dashboard">
    <div class="super-header">
      <div>
        <h1 class="super-title">Consola Global SaaS</h1>
        <p class="super-subtitle">Visão macro de todas as organizações, subscrições ativas e métricas da plataforma</p>
      </div>

      <div class="badge badge-primary">SaaS Multi-Tenant Ativo</div>
    </div>

    <!-- Global SaaS Metrics -->
    <div class="super-metrics-grid">
      <div class="super-metric-card">
        <div class="m-head">
          <span>RECEITA RECORRENTE MENSAL (MRR)</span>
          <CreditCard :size="18" class="m-icon" />
        </div>
        <div class="m-val">{{ totalMrr().toLocaleString('pt-MZ') }} MT</div>
        <div class="m-sub text-success">↑ 22.4% no último trimestre</div>
      </div>

      <div class="super-metric-card">
        <div class="m-head">
          <span>EMPRESAS CLIENTES (TENANTS)</span>
          <Building2 :size="18" class="m-icon" />
        </div>
        <div class="m-val">{{ companies.length }}</div>
        <div class="m-sub">{{ companies.filter(c => c.isActive).length }} com subscrição ativa</div>
      </div>

      <div class="super-metric-card">
        <div class="m-head">
          <span>TOTAL DE RESTAURANTES</span>
          <Store :size="18" class="m-icon" />
        </div>
        <div class="m-val">{{ restaurants.length }}</div>
        <div class="m-sub">Em 3 províncias de Moçambique</div>
      </div>

      <div class="super-metric-card">
        <div class="m-head">
          <span>UTILIZADORES REGISTADOS</span>
          <Users :size="18" class="m-icon" />
        </div>
        <div class="m-val">{{ users.length }}</div>
        <div class="m-sub">Com perfis e acessos definidos</div>
      </div>
    </div>

    <!-- Two columns: Companies and Subscriptions -->
    <div class="super-tables-grid">
      <!-- Companies Table -->
      <div class="super-card">
        <div class="card-header">
          <h2 class="card-title">Empresas Registadas na Plataforma</h2>
          <router-link to="/super-admin/empresas" class="card-link">
            <span>Ver Todas</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>

        <table class="super-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>NUIT</th>
              <th>Restaurantes</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="comp in companies" :key="comp.id">
              <td>
                <strong>{{ comp.name }}</strong>
                <div class="text-xs text-muted">{{ comp.email }}</div>
              </td>
              <td>{{ comp.taxId }}</td>
              <td>
                <span class="badge badge-neutral">
                  {{ restaurants.filter(r => r.tenantId === comp.id).length }} filiais
                </span>
              </td>
              <td>
                <AppBadge :variant="comp.isActive ? 'success' : 'danger'">
                  {{ comp.isActive ? 'Ativa' : 'Suspensa' }}
                </AppBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Subscriptions Card -->
      <div class="super-card">
        <div class="card-header">
          <h2 class="card-title">Subscrições Comerciais</h2>
          <router-link to="/super-admin/subscricoes" class="card-link">
            <span>Gerir</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>

        <div class="subscriptions-list">
          <div
            v-for="sub in subscriptions"
            :key="sub.id"
            class="sub-item"
          >
            <div class="sub-left">
              <strong>{{ sub.companyName }}</strong>
              <span class="text-xs text-muted">{{ sub.planName }}</span>
            </div>
            <div class="sub-right">
              <strong>{{ sub.monthlyPrice.toLocaleString('pt-MZ') }} MT</strong>
              <AppBadge :variant="sub.status === 'active' ? 'success' : 'warning'">
                {{ sub.status }}
              </AppBadge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.super-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
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
  color: #ffffff;
}

.super-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
}

.super-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

.super-metric-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.m-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.04em;
}

.m-icon {
  color: #8b5cf6;
}

.m-val {
  font-size: 1.75rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: #ffffff;
  line-height: 1;
}

.m-sub {
  font-size: 0.75rem;
  color: #94a3b8;
}

.super-tables-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
}

.super-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.card-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: #ffffff;
}

.card-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #a78bfa;
}

.super-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.super-table th {
  padding: 0.75rem 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.super-table td {
  padding: 0.875rem 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
}

.subscriptions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
}

.sub-left {
  display: flex;
  flex-direction: column;
}

.sub-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

@media (max-width: 1100px) {
  .super-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .super-tables-grid {
    grid-template-columns: 1fr;
  }
}
</style>
