<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { subscriptionService } from '@/services'
import type { Plan } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import { Check, Sparkles } from 'lucide-vue-next'

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
  <div class="pricing-page container">
    <div class="pricing-header">
      <div class="badge badge-success">PREÇOS TRANSPARENTES</div>
      <h1 class="pricing-title">Planos Adaptados ao Seu Negócio</h1>
      <p class="pricing-subtitle">
        Desde pequenos cafés a grandes redes de restauração com múltiplas filiais. Sem custos de hardware proprietário.
      </p>
    </div>

    <div v-if="isLoading" class="loading-state">
      <span>A carregar planos...</span>
    </div>

    <div v-else class="pricing-grid">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="plan-card"
        :class="{ 'is-featured': plan.id === 'plan-pro' }"
      >
        <div v-if="plan.id === 'plan-pro'" class="featured-badge">
          <Sparkles :size="13" />
          <span>MAIS POPULAR</span>
        </div>

        <div class="plan-header">
          <h3 class="plan-name">{{ plan.name }}</h3>
          <div class="plan-price-wrap">
            <span class="plan-currency">MT</span>
            <span class="plan-amount">{{ plan.priceMonthly.toLocaleString('pt-MZ') }}</span>
            <span class="plan-period">/mês</span>
          </div>
          <p class="plan-limits">
            Até <strong>{{ plan.maxRestaurants }}</strong> {{ plan.maxRestaurants === 1 ? 'restaurante' : 'restaurantes' }} •
            <strong>{{ plan.maxTables }}</strong> mesas •
            <strong>{{ plan.maxStaff }}</strong> colaboradores
          </p>
        </div>

        <div class="plan-divider"></div>

        <div class="plan-features">
          <div class="features-label">FUNCIONALIDADES INCLUÍDAS:</div>
          <ul class="features-list">
            <li v-for="(feat, idx) in plan.features" :key="idx">
              <div class="check-icon"><Check :size="15" /></div>
              <span>{{ feat }}</span>
            </li>
          </ul>
        </div>

        <div class="plan-footer">
          <router-link :to="`/demonstracao?plan=${plan.id}`">
            <AppButton
              :variant="plan.id === 'plan-pro' ? 'primary' : 'outline'"
              class="w-full"
              size="lg"
            >
              Experimentar Neste Plano
            </AppButton>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pricing-page {
  padding: 4rem 1.5rem 6rem;
}

.pricing-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 4rem;
}

.pricing-title {
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  margin: 1rem 0 0.75rem;
}

.pricing-subtitle {
  font-size: 1.125rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  align-items: stretch;
}

.plan-card {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.plan-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.plan-card.is-featured {
  border: 2px solid var(--color-primary-800);
  box-shadow: 0 10px 25px -5px rgba(30, 64, 175, 0.15);
}

.featured-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary-800);
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  letter-spacing: 0.05em;
}

.plan-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  margin-bottom: 1rem;
}

.plan-price-wrap {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.plan-currency {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-neutral-600);
}

.plan-amount {
  font-size: 2.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-neutral-900);
  line-height: 1;
}

.plan-period {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.plan-limits {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.plan-divider {
  height: 1px;
  background-color: var(--border-subtle);
  margin: 1.75rem 0;
}

.plan-features {
  flex: 1;
  margin-bottom: 2rem;
}

.features-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-neutral-500);
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.features-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.features-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  font-size: 0.875rem;
  color: var(--color-neutral-700);
}

.check-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-success-50);
  color: var(--color-success-600);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.w-full {
  width: 100%;
}

.loading-state {
  text-align: center;
  padding: 4rem;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .pricing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
