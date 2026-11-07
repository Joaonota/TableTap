<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePlansStore } from '@/stores/plans'
import type { Plan } from '@/types'
import { FEATURE_CATALOG } from '@/types/plan'
import AppButton from '@/components/ui/AppButton.vue'
import { Check, X, Zap, Layers, Sparkles } from 'lucide-vue-next'

const plansStore = usePlansStore()
const modules = ['Menu & Mesas', 'Operação', 'Pagamentos', 'Inteligência', 'Equipa', 'Avançado'] as const

onMounted(async () => {
  await plansStore.fetchPlans()
})

const isFeatureActiveInPlan = (plan: Plan, featureKey: string): boolean => {
  const f = plan.features?.find(feat => feat.featureKey === featureKey)
  return f ? f.enabled : false
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Catálogo Global de Funcionalidades</h1>
        <p class="page-subtitle">Matriz de competências e módulos ativos por nível de plano SaaS</p>
      </div>

      <router-link to="/super-admin/planos">
        <AppButton variant="primary">
          <Layers :size="16" />
          <span>Configurar Planos</span>
        </AppButton>
      </router-link>
    </div>

    <!-- Matrix Card -->
    <div class="super-card table-card">
      <div class="table-scroll">
        <table class="super-table matrix-table">
          <thead>
            <tr>
              <th class="feat-col">Módulo & Funcionalidade (21 Total)</th>
              <th
                v-for="plan in plansStore.plans"
                :key="plan.id"
                class="plan-col text-center"
                :class="{ 'featured-col': plan.highlighted }"
              >
                <div class="plan-header-cell">
                  <span class="plan-name">{{ plan.name }}</span>
                  <span class="plan-price font-mono">{{ plan.price.toLocaleString('pt-MZ') }} MT</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="mod in modules" :key="mod">
              <!-- Module Header Row -->
              <tr class="module-section-row">
                <td :colspan="1 + plansStore.plans.length" class="module-section-title">
                  {{ mod }}
                </td>
              </tr>

              <!-- Features inside Module -->
              <tr
                v-for="feat in FEATURE_CATALOG.filter(f => f.module === mod)"
                :key="feat.key"
                class="feature-row"
              >
                <td class="feat-col">
                  <div class="feat-info">
                    <strong class="feat-name">{{ feat.name }}</strong>
                    <span class="feat-desc">{{ feat.description }}</span>
                  </div>
                </td>

                <td
                  v-for="plan in plansStore.plans"
                  :key="plan.id"
                  class="text-center plan-col"
                  :class="{ 'featured-col': plan.highlighted }"
                >
                  <div v-if="isFeatureActiveInPlan(plan, feat.key)" class="badge-check">
                    <Check :size="15" />
                    <span>Incluído</span>
                  </div>
                  <div v-else class="badge-lock">
                    <X :size="13" />
                    <span>Bloqueado</span>
                  </div>
                </td>
              </tr>
            </template>
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
  color: #ffffff;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.super-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
}

.matrix-table th {
  background: #0f172a;
  color: #94a3b8;
  padding: 1rem;
  border-bottom: 1px solid #334155;
}

.matrix-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #334155;
}

.feat-col {
  width: 38%;
  min-width: 260px;
}

.plan-col {
  width: 15%;
  min-width: 140px;
}

.featured-col {
  background: rgba(13, 122, 95, 0.04);
}

.plan-header-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.plan-name {
  font-size: 0.9375rem;
  font-weight: 800;
  color: #ffffff;
}

.plan-price {
  font-size: 0.75rem;
  color: #38bdf8;
  font-weight: 700;
}

.module-section-row td {
  background: #0f172a;
  padding: 0.65rem 1rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #34d399;
  border-top: 1px solid #334155;
  border-bottom: 1px solid #334155;
}

.feature-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.feat-info {
  display: flex;
  flex-direction: column;
}

.feat-name {
  font-size: 0.875rem;
  color: #ffffff;
}

.feat-desc {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.15rem;
}

.badge-check {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #34d399;
  background: rgba(16, 185, 129, 0.12);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
}

.badge-lock {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7188rem;
  color: #64748b;
  background: rgba(100, 116, 139, 0.12);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.text-center {
  text-align: center;
}
</style>

