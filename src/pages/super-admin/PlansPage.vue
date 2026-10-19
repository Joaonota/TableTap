<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { subscriptionService } from '@/services'
import type { Plan } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Sparkles, Check } from 'lucide-vue-next'

const plans = ref<Plan[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    plans.value = await subscriptionService.getAllPlans()
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Planos Comerciais SaaS</h1>
        <p class="page-subtitle">Configuração de pacotes, limites de filiais, mesas e precificação em Meticais</p>
      </div>
    </div>

    <div class="plans-grid">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="super-card plan-card"
      >
        <div class="plan-header">
          <h2 class="plan-name">{{ plan.name }}</h2>
          <div class="plan-price">
            <strong>{{ plan.priceMonthly.toLocaleString('pt-MZ') }} MT</strong>
            <span class="text-xs text-muted">/mês</span>
          </div>
        </div>

        <div class="limits-box">
          <div class="limit-item">
            <span>Restaurantes / Filiais:</span>
            <strong>Até {{ plan.maxRestaurants }}</strong>
          </div>
          <div class="limit-item">
            <span>Mesas por Restaurante:</span>
            <strong>Até {{ plan.maxTables }}</strong>
          </div>
          <div class="limit-item">
            <span>Colaboradores:</span>
            <strong>Até {{ plan.maxStaff }}</strong>
          </div>
        </div>

        <div class="features-box">
          <div class="feat-title">Módulos Ativos:</div>
          <ul class="feat-list">
            <li v-for="(f, i) in plan.features" :key="i">
              <Check :size="14" class="text-success" />
              <span>{{ f }}</span>
            </li>
          </ul>
        </div>
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
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.plan-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.plan-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #ffffff;
}

.plan-price {
  font-size: 1.5rem;
  color: #a78bfa;
  margin-top: 0.25rem;
}

.limits-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.limit-item {
  display: flex;
  justify-content: space-between;
  color: #cbd5e1;
}

.features-box {
  flex: 1;
}

.feat-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.feat-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feat-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #94a3b8;
}

@media (max-width: 900px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }
}
</style>
