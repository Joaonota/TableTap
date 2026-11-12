<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePlansStore } from '@/stores/plans'
import type { Plan } from '@/types'
import { LIMIT_CATALOG, getFeatureCatalogEntry } from '@/types/plan'
import { formatLimit, planLimitValue } from '@/domain/planLimits'
import PlanEditorModal from '@/components/super-admin/PlanEditorModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Plus, Edit, Sparkles, Check, CheckCircle2, ShieldCheck, Power } from 'lucide-vue-next'

const plansStore = usePlansStore()

const isModalOpen = ref(false)
const selectedPlan = ref<Plan | null>(null)

onMounted(async () => {
  await plansStore.fetchPlans()
})

const openCreateModal = () => {
  selectedPlan.value = null
  isModalOpen.value = true
}

const openEditModal = (plan: Plan) => {
  selectedPlan.value = plan
  isModalOpen.value = true
}

const isSaving = ref(false)
const handleSavePlan = async (data: Partial<Plan>) => {
  isSaving.value = true
  try {
    await plansStore.savePlan(data)
    isModalOpen.value = false
  } catch {
    // Erro já apresentado pela store; o editor continua aberto.
  } finally {
    isSaving.value = false
  }
}

const handleToggleActive = async (plan: Plan) => {
  await plansStore.togglePlanActive(plan.id)
}

</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Planos Comerciais SaaS</h1>
        <p class="page-subtitle">Configuração do catálogo de planos, limites de recursos, módulos ativos e precificação em Meticais (MT)</p>
      </div>

      <AppButton variant="primary" @click="openCreateModal">
        <Plus :size="16" />
        <span>Criar Novo Plano</span>
      </AppButton>
    </div>

    <!-- Plans Grid -->
    <div v-if="plansStore.isLoading" class="loading-state">
      Carregando catálogo de planos...
    </div>

    <div v-else class="plans-grid">
      <div
        v-for="plan in plansStore.plans"
        :key="plan.id"
        class="super-card plan-card"
        :class="{ 'is-inactive': !plan.active, 'is-featured': plan.highlighted }"
      >
        <div class="card-badges">
          <AppBadge :variant="plan.active ? 'success' : 'neutral'">
            {{ plan.active ? 'ATIVO' : 'INATIVO' }}
          </AppBadge>
          <span v-if="plan.highlighted" class="badge-tag">
            <Sparkles :size="12" /> MAIS POPULAR
          </span>
        </div>

        <div class="plan-header">
          <h2 class="plan-name">{{ plan.name }}</h2>
          <p class="plan-desc">{{ plan.description }}</p>
          <div class="plan-price">
            <span class="price-val">{{ plan.price.toLocaleString('pt-MZ') }} MT</span>
            <span class="price-cycle">/{{ plan.billingPeriod === 'monthly' ? 'mês' : 'ano' }}</span>
          </div>
        </div>

        <div class="plan-divider"></div>

        <!-- Limits section -->
        <div class="limits-box">
          <div class="section-title">LIMITES OPERACIONAIS:</div>
          <div class="limits-list">
            <div v-for="entry in LIMIT_CATALOG" :key="entry.key" class="limit-item">
              <span class="limit-label">{{ entry.name }}{{ entry.scope === 'restaurant' ? ' / restaurante' : '' }}:</span>
              <strong class="limit-val">{{ formatLimit(planLimitValue(plan, entry.key)) }}</strong>
            </div>
          </div>
        </div>

        <div class="plan-divider"></div>

        <!-- Features summary -->
        <div class="features-box">
          <div class="section-title">
            MÓDULOS ATIVOS ({{ plan.features?.filter(f => f.enabled).length || 0 }} de {{ plan.features?.length || 21 }}):
          </div>
          <div class="feature-pills">
            <span
              v-for="feat in plan.features?.filter(f => f.enabled).slice(0, 7)"
              :key="feat.featureKey"
              class="feat-pill"
            >
              <Check :size="12" />
              <span>{{ getFeatureCatalogEntry(feat.featureKey)?.name ?? feat.featureKey }}</span>
            </span>
            <span v-if="(plan.features?.filter(f => f.enabled).length || 0) > 7" class="feat-pill more">
              +{{ (plan.features?.filter(f => f.enabled).length || 0) - 7 }} módulos
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="card-footer">
          <AppButton
            variant="outline"
            size="sm"
            class="flex-1"
            @click="openEditModal(plan)"
          >
            <Edit :size="14" />
            <span>Editar Plano</span>
          </AppButton>

          <AppButton
            :variant="plan.active ? 'ghost' : 'outline'"
            size="sm"
            :title="plan.active ? 'Desativar Plano' : 'Ativar Plano'"
            @click="handleToggleActive(plan)"
          >
            <Power :size="14" />
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <PlanEditorModal
      :is-open="isModalOpen"
      :initial-plan="selectedPlan"
      :other-plans="plansStore.plans"
      :is-saving="isSaving"
      @close="isModalOpen = false"
      @save="handleSavePlan"
    />
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

.loading-state {
  color: #94a3b8;
  padding: 3rem 0;
  text-align: center;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

@media (max-width: 1200px) {
  .plans-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }
}

.super-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.plan-card.is-featured {
  border-color: #0d7a5f;
  box-shadow: 0 0 20px rgba(13, 122, 95, 0.2);
}

.plan-card.is-inactive {
  opacity: 0.6;
}

.card-badges {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6875rem;
  font-weight: 800;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.plan-name {
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0;
}

.plan-desc {
  font-size: 0.7813rem;
  color: #94a3b8;
  margin: 0.35rem 0 0.75rem;
  line-height: 1.35;
  min-height: 40px;
}

.plan-price {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.price-val {
  font-size: 1.5rem;
  font-weight: 900;
  color: #38bdf8;
}

.price-cycle {
  font-size: 0.75rem;
  color: #64748b;
}

.plan-divider {
  height: 1px;
  background: #334155;
  margin: 1rem 0;
}

.section-title {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
  margin-bottom: 0.6rem;
}

.limits-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.7813rem;
}

.limit-item {
  display: flex;
  justify-content: space-between;
  color: #cbd5e1;
}

.limit-label {
  color: #94a3b8;
}

.limit-val {
  color: #ffffff;
}

.feature-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.feat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #34d399;
  background: rgba(16, 185, 129, 0.1);
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
}

.feat-pill.more {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
}

.card-footer {
  margin-top: auto;
  padding-top: 1.25rem;
  display: flex;
  gap: 0.5rem;
}
</style>
