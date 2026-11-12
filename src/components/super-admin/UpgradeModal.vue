<script setup lang="ts">
import { computed } from 'vue'
import type { Plan } from '@/types'
import { getPlanLimit, isPlanFeatureEnabled } from '@/types/plan'
import { useSubscriptionStore } from '@/stores/subscription'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  triggerReason?: string
  requiredPlanName?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'upgraded', planId: string): void
}>()

const subscriptionStore = useSubscriptionStore()

const plans = computed(() => subscriptionStore.availablePlans)
const currentPlanId = computed(() => subscriptionStore.currentPlan?.id)

const handleUpgrade = async (plan: Plan) => {
  if (plan.id === currentPlanId.value) return
  const ok = await subscriptionStore.upgradePlan(plan.id)
  if (ok) {
    emit('upgraded', plan.id)
    emit('close')
  }
}

const formatLimit = (limit: number | null): string => {
  return limit === null ? 'Ilimitado' : limit.toString()
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    title="Atualizar Plano TapMenu"
    subtitle="Desbloqueie novas funcionalidades, aumente limites e acelere a sua operação"
    max-width="960px"
    @close="emit('close')"
  >
    <div class="upgrade-modal-content">
      <!-- Trigger notice if limit was reached -->
      <div v-if="triggerReason" class="limit-trigger-alert">
        <Sparkles :size="20" class="alert-icon" />
        <div class="alert-text">
          <strong>Aumente a Capacidade da sua Operação</strong>
          <p>{{ triggerReason }}</p>
        </div>
      </div>

      <!-- Plans Comparison Grid -->
      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card"
          :class="{
            'is-current': plan.id === currentPlanId,
            'is-recommended': plan.highlighted || (requiredPlanName && plan.name.toLowerCase().includes(requiredPlanName.toLowerCase()))
          }"
        >
          <div v-if="plan.highlighted" class="badge-featured">
            MAIS POPULAR
          </div>

          <div v-if="plan.id === currentPlanId" class="badge-current">
            PLANO ATUAL
          </div>

          <div class="plan-header">
            <h4 class="plan-name">{{ plan.name }}</h4>
            <div class="price-wrap">
              <span class="price-amount">{{ plan.price.toLocaleString('pt-MZ') }}</span>
              <span class="price-currency">MT</span>
              <span class="price-period">/mês</span>
            </div>
            <p class="plan-desc">{{ plan.description }}</p>
          </div>

          <div class="plan-divider"></div>

          <!-- Key Limits -->
          <div class="limits-summary">
            <div class="limit-row">
              <span class="l-key">Restaurantes:</span>
              <strong class="l-val">{{ formatLimit(getPlanLimit(plan, 'RESTAURANTS')) }}</strong>
            </div>
            <div class="limit-row">
              <span class="l-key">Produtos:</span>
              <strong class="l-val">{{ formatLimit(getPlanLimit(plan, 'PRODUCTS')) }}</strong>
            </div>
            <div class="limit-row">
              <span class="l-key">Categorias:</span>
              <strong class="l-val">{{ formatLimit(getPlanLimit(plan, 'CATEGORIES')) }}</strong>
            </div>
            <div class="limit-row">
              <span class="l-key">Mesas:</span>
              <strong class="l-val">{{ formatLimit(getPlanLimit(plan, 'TABLES')) }}</strong>
            </div>
            <div class="limit-row">
              <span class="l-key">Colaboradores:</span>
              <strong class="l-val">{{ formatLimit(getPlanLimit(plan, 'STAFF')) }}</strong>
            </div>
          </div>

          <div class="plan-divider"></div>

          <!-- Key Features Highlights -->
          <ul class="features-list">
            <li :class="{ 'is-included': isPlanFeatureEnabled(plan, 'ORDERS') }">
              <Check :size="14" />
              <span>Pedidos no Menu Digital</span>
            </li>
            <li :class="{ 'is-included': isPlanFeatureEnabled(plan, 'KDS') }">
              <Check :size="14" />
              <span>Kitchen Display System (KDS)</span>
            </li>
            <li :class="{ 'is-included': isPlanFeatureEnabled(plan, 'NFC') }">
              <Check :size="14" />
              <span>Etiquetas NFC Contactless</span>
            </li>
            <li :class="{ 'is-included': isPlanFeatureEnabled(plan, 'PAYMENTS') }">
              <Check :size="14" />
              <span>Pagamentos Digitais M-Pesa</span>
            </li>
            <li :class="{ 'is-included': isPlanFeatureEnabled(plan, 'MENU_CUSTOMIZATION') }">
              <Check :size="14" />
              <span>Personalização do Menu</span>
            </li>
            <li :class="{ 'is-included': isPlanFeatureEnabled(plan, 'BUSINESS_INTELLIGENCE') }">
              <Check :size="14" />
              <span>Business Intelligence & BI</span>
            </li>
          </ul>

          <div class="plan-footer">
            <AppButton
              v-if="plan.id === currentPlanId"
              variant="outline"
              disabled
              class="w-full"
            >
              Plano Atual
            </AppButton>
            <AppButton
              v-else
              :variant="plan.highlighted ? 'primary' : 'outline'"
              class="w-full upgrade-btn"
              @click="handleUpgrade(plan)"
            >
              <span>Subscrever {{ plan.name }}</span>
              <ArrowRight :size="15" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.upgrade-modal-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.limit-trigger-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  background: rgba(13, 122, 95, 0.08);
  border: 1px solid rgba(13, 122, 95, 0.25);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.alert-icon {
  color: var(--color-primary, #0d7a5f);
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-text strong {
  display: block;
  font-size: 0.9375rem;
  color: var(--color-primary, #0d7a5f);
  margin-bottom: 0.2rem;
}

.alert-text p {
  font-size: 0.8125rem;
  color: var(--color-text, #374151);
  margin: 0;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 900px) {
  .plans-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }
}

.plan-card {
  position: relative;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 14px;
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.plan-card.is-current {
  border-color: #9ca3af;
  background: var(--color-background, #f9fafb);
}

.plan-card.is-recommended {
  border-color: var(--color-primary, #0d7a5f);
  box-shadow: 0 4px 18px rgba(13, 122, 95, 0.12);
}

.badge-featured {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary, #0d7a5f);
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.65rem;
  border-radius: 20px;
}

.badge-current {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #4b5563;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.65rem;
  border-radius: 20px;
}

.plan-header {
  text-align: center;
  min-height: 120px;
}

.plan-name {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-text, #111827);
  margin: 0 0 0.5rem;
}

.price-wrap {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.2rem;
  margin-bottom: 0.5rem;
}

.price-amount {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--color-text, #111827);
}

.price-currency {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-primary, #0d7a5f);
}

.price-period {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
}

.plan-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.35;
  margin: 0;
}

.plan-divider {
  height: 1px;
  background: var(--color-border, #e5e7eb);
  margin: 0.85rem 0;
}

.limits-summary {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
}

.limit-row {
  display: flex;
  justify-content: space-between;
}

.l-key {
  color: var(--color-text-muted, #6b7280);
}

.l-val {
  color: var(--color-text, #111827);
  font-weight: 700;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.75rem;
  flex: 1;
}

.features-list li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--color-text-muted, #6b7280);
  opacity: 0.5;
}

.features-list li.is-included {
  color: var(--color-text, #111827);
  opacity: 1;
}

.features-list li.is-included svg {
  color: var(--color-primary, #0d7a5f);
}

.plan-footer {
  margin-top: 1.25rem;
}

.upgrade-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}
</style>

