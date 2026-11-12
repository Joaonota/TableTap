<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useSubscriptionStore, type ResourceUsageMetric } from '@/stores/subscription'
import { useTenantStore } from '@/stores/tenant'
import { FEATURE_CATALOG, getPlanLimit, isPlanFeatureEnabled } from '@/types/plan'
import type { Plan } from '@/types'
import UpgradeModal from '@/components/super-admin/UpgradeModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Sparkles,
  CreditCard,
  Calendar,
  Check,
  Lock,
  ArrowRight,
  TrendingUp,
  History,
  AlertTriangle,
  Infinity as InfinityIcon
} from 'lucide-vue-next'

const subscriptionStore = useSubscriptionStore()
const tenantStore = useTenantStore()

const isUpgradeModalOpen = ref(false)

onMounted(async () => {
  await subscriptionStore.fetchSubscriptionData()
})

const sub = computed(() => subscriptionStore.currentSubscription)
const plan = computed(() => subscriptionStore.currentPlan)
const usage = computed(() => subscriptionStore.usageMetrics)

const getProgressColorClass = (pct: number): string => {
  if (pct >= 100) return 'progress-danger'
  if (pct >= 80) return 'progress-warning'
  return 'progress-normal'
}

const formatLimit = (limit: number | null): string => {
  return limit === null ? 'Ilimitado' : limit.toString()
}

const handleUpgrade = async (targetPlanId: string) => {
  if (targetPlanId === plan.value?.id) return
  await subscriptionStore.upgradePlan(targetPlanId)
}
</script>

<template>
  <div class="meu-plano-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">A Minha Subscrição & Limites do Plano</h1>
        <p class="page-subtitle">Acompanhe a utilização de recursos, limites contratados e histórico de faturamento</p>
      </div>

      <AppButton variant="primary" @click="isUpgradeModalOpen = true">
        <Sparkles :size="16" />
        <span>Fazer Upgrade de Plano</span>
      </AppButton>
    </div>

    <!-- Current Subscription Hero Card -->
    <div class="subscription-hero-card" v-if="plan">
      <div class="hero-left">
        <div class="plan-tag-pill">
          <span>O SEU PLANO ATUAL</span>
        </div>
        <h2 class="hero-plan-name">{{ plan.name }}</h2>
        <p class="hero-plan-desc">{{ plan.description }}</p>

        <div class="hero-meta-row">
          <div class="meta-item">
            <span class="m-label">Estado</span>
            <AppBadge :variant="sub?.status === 'active' ? 'success' : sub?.status === 'trial' ? 'primary' : 'warning'">
              {{ (sub?.status || 'Ativo').toUpperCase() }}
            </AppBadge>
          </div>

          <div class="meta-item">
            <span class="m-label">Renovação</span>
            <strong class="m-val">
              {{ sub?.renewalDate ? new Date(sub.renewalDate).toLocaleDateString('pt-MZ') : 'Contínuo' }}
              <span v-if="subscriptionStore.daysUntilRenewal > 0" class="days-pill">
                ({{ subscriptionStore.daysUntilRenewal }} dias restantes)
              </span>
            </strong>
          </div>

          <div class="meta-item">
            <span class="m-label">Faturação</span>
            <strong class="m-val font-mono">{{ plan.price.toLocaleString('pt-MZ') }} MT / mês</strong>
          </div>
        </div>
      </div>

      <div class="hero-right">
        <div class="plan-badge-icon">
          <Sparkles :size="36" />
        </div>
        <button
          type="button"
          class="hero-upgrade-link"
          @click="isUpgradeModalOpen = true"
        >
          <span>Comparar com outros planos</span>
          <ArrowRight :size="14" />
        </button>
      </div>
    </div>

    <!-- Resource Usage Progress Bars Grid -->
    <div class="section-container">
      <div class="section-head">
        <h3 class="section-title">Utilização de Recursos no Ciclo Atual</h3>
        <span class="section-subtitle">Consumo em tempo real face aos limites do seu plano</span>
      </div>

      <div class="usage-bars-grid">
        <div
          v-for="item in Object.values(usage)"
          :key="item.key"
          class="usage-card"
          :class="{ 'is-limit-reached': item.reached }"
        >
          <div class="usage-card-top">
            <span class="usage-name">{{ item.name }}<small v-if="item.scope === 'restaurant'" class="usage-scope"> · {{ tenantStore.currentRestaurant?.name ?? 'restaurante atual' }}</small></span>
            <div class="usage-counts font-mono">
              <strong>{{ item.current }}</strong>
              <span class="count-sep">/</span>
              <span v-if="item.limit === null" class="unlimited-inline">
                <InfinityIcon :size="14" /> Ilimitado
              </span>
              <span v-else>{{ item.limit }} {{ item.unit }}</span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-track">
            <div
              v-if="item.limit === null"
              class="progress-fill unlimited"
              style="width: 100%"
            ></div>
            <div
              v-else
              class="progress-fill"
              :class="getProgressColorClass(item.percentage)"
              :style="{ width: `${item.percentage}%` }"
            ></div>
          </div>

          <div class="usage-card-bottom">
            <span v-if="item.limit === null" class="usage-pct text-success">
              ✓ Sem restrições de quantidade
            </span>
            <span v-else-if="item.reached" class="usage-pct text-danger">
              <AlertTriangle :size="13" /> Limite atingido (100%)
            </span>
            <span v-else class="usage-pct">
              {{ item.percentage }}% utilizado
            </span>

            <span
              v-if="item.reached"
              class="upgrade-prompt-link"
              @click="isUpgradeModalOpen = true"
            >
              Aumentar limite →
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Features Included in Current Plan -->
    <div class="section-container">
      <div class="section-head">
        <h3 class="section-title">Módulos & Funcionalidades da Sua Conta</h3>
        <span class="section-subtitle">Recursos ativos e disponíveis para a sua equipa</span>
      </div>

      <div class="features-status-grid">
        <div
          v-for="feat in FEATURE_CATALOG"
          :key="feat.key"
          class="feature-status-card"
          :class="{ 'is-active': subscriptionStore.hasFeature(feat.key) }"
        >
          <div class="feat-status-icon">
            <Check v-if="subscriptionStore.hasFeature(feat.key)" :size="15" />
            <Lock v-else :size="13" />
          </div>

          <div class="feat-status-text">
            <div class="feat-name-row">
              <strong class="feat-title">{{ feat.name }}</strong>
              <span
                class="feat-badge"
                :class="subscriptionStore.hasFeature(feat.key) ? 'badge-on' : 'badge-off'"
              >
                {{ subscriptionStore.hasFeature(feat.key) ? 'ATIVO' : 'BLOQUEADO' }}
              </span>
            </div>
            <p class="feat-desc">{{ feat.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Upgrade / Plan Switch Section -->
    <div class="section-container">
      <div class="section-head">
        <h3 class="section-title">Comparação de Planos & Upgrade</h3>
        <span class="section-subtitle">Pode mudar de plano a qualquer momento sem interrupção de serviço</span>
      </div>

      <div class="plans-switch-grid">
        <div
          v-for="p in subscriptionStore.availablePlans"
          :key="p.id"
          class="plan-compare-card"
          :class="{ 'is-current-plan': p.id === plan?.id, 'is-featured-plan': p.highlighted }"
        >
          <div v-if="p.id === plan?.id" class="current-pill">
            PLANO ATUAL
          </div>
          <div v-else-if="p.highlighted" class="featured-pill">
            RECOMENDADO
          </div>

          <div class="p-head">
            <h4 class="p-name">{{ p.name }}</h4>
            <div class="p-price font-mono">
              <span class="p-val">{{ p.price.toLocaleString('pt-MZ') }}</span>
              <span class="p-cur">MT/mês</span>
            </div>
            <p class="p-desc">{{ p.description }}</p>
          </div>

          <div class="p-divider"></div>

          <ul class="p-key-limits">
            <li>Restaurantes: <strong>{{ formatLimit(getPlanLimit(p, 'RESTAURANTS')) }}</strong></li>
            <li>Produtos: <strong>{{ formatLimit(getPlanLimit(p, 'PRODUCTS')) }}</strong></li>
            <li>Mesas: <strong>{{ formatLimit(getPlanLimit(p, 'TABLES')) }}</strong></li>
            <li>Colaboradores: <strong>{{ formatLimit(getPlanLimit(p, 'STAFF')) }}</strong></li>
          </ul>

          <div class="p-footer">
            <AppButton
              v-if="p.id === plan?.id"
              variant="outline"
              disabled
              class="w-full"
            >
              Plano Ativo
            </AppButton>
            <AppButton
              v-else
              :variant="p.highlighted ? 'primary' : 'outline'"
              class="w-full"
              @click="handleUpgrade(p.id)"
            >
              <span>Subscrever {{ p.name }}</span>
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Subscription History -->
    <div v-if="sub?.history && sub.history.length > 0" class="section-container">
      <div class="section-head">
        <h3 class="section-title">Histórico de Alterações da Subscrição</h3>
        <span class="section-subtitle">Auditoria de upgrades, renovações e faturamento</span>
      </div>

      <div class="history-card">
        <div class="history-list">
          <div
            v-for="evt in sub.history"
            :key="evt.id"
            class="history-row"
          >
            <div class="history-bullet"></div>
            <div class="history-info">
              <div class="history-top">
                <strong class="history-event">{{ evt.event.toUpperCase().replace(/_/g, ' ') }}</strong>
                <span class="history-date font-mono">
                  {{ new Date(evt.date).toLocaleDateString('pt-MZ') }} {{ new Date(evt.date).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </div>
              <p v-if="evt.note" class="history-note">{{ evt.note }}</p>
              <div class="history-meta">
                <span v-if="evt.amount !== undefined" class="meta-amount">
                  Valor: <strong>{{ evt.amount.toLocaleString('pt-MZ') }} MT</strong>
                </span>
                <span class="meta-actor">Operador: {{ evt.performedBy }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upgrade Modal -->
    <UpgradeModal
      :is-open="isUpgradeModalOpen"
      @close="isUpgradeModalOpen = false"
      @upgraded="subscriptionStore.fetchSubscriptionData()"
    />
  </div>
</template>

<style scoped>
.usage-scope {
  font-weight: 500;
  color: var(--text-muted);
}

.meu-plano-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
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
  color: var(--color-text, #111827);
  margin: 0;
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted, #6b7280);
  margin: 0.2rem 0 0;
}

.subscription-hero-card {
  background: linear-gradient(135deg, #0d7a5f 0%, #064e3b 100%);
  color: #ffffff;
  border-radius: 16px;
  padding: 1.75rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10px 30px rgba(13, 122, 95, 0.2);
}

@media (max-width: 800px) {
  .subscription-hero-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
  }
}

.plan-tag-pill {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  background: rgba(255, 255, 255, 0.15);
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  margin-bottom: 0.5rem;
}

.hero-plan-name {
  font-size: 2rem;
  font-weight: 900;
  margin: 0 0 0.35rem;
}

.hero-plan-desc {
  font-size: 0.875rem;
  color: #d1fae5;
  max-width: 520px;
  line-height: 1.4;
  margin: 0 0 1.25rem;
}

.hero-meta-row {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.m-label {
  font-size: 0.7188rem;
  text-transform: uppercase;
  color: #a7f3d0;
  font-weight: 600;
}

.m-val {
  font-size: 0.9375rem;
  color: #ffffff;
}

.days-pill {
  font-size: 0.75rem;
  font-weight: 500;
  color: #fef08a;
}

.hero-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.plan-badge-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fef08a;
}

.hero-upgrade-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.hero-upgrade-link:hover {
  background: rgba(255, 255, 255, 0.3);
}

.section-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.section-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--color-text, #111827);
  margin: 0;
}

.section-subtitle {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #6b7280);
}

.usage-bars-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

@media (max-width: 900px) {
  .usage-bars-grid {
    grid-template-columns: 1fr;
  }
}

.usage-card {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.usage-card.is-limit-reached {
  border-color: #f87171;
  background: #fff5f5;
}

.usage-card-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.usage-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text, #111827);
}

.usage-counts {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #6b7280);
}

.usage-counts strong {
  color: var(--color-text, #111827);
  font-size: 0.9375rem;
}

.count-sep {
  margin: 0 0.2rem;
}

.unlimited-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--color-primary, #0d7a5f);
  font-weight: 700;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: var(--color-background, #f3f4f6);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-normal {
  background: var(--color-primary, #0d7a5f);
}

.progress-warning {
  background: #f59e0b;
}

.progress-danger {
  background: #ef4444;
}

.progress-fill.unlimited {
  background: linear-gradient(90deg, #10b981 0%, #0d7a5f 100%);
}

.usage-card-bottom {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.usage-pct {
  color: var(--color-text-muted, #6b7280);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.text-danger { color: #dc2626; }
.text-success { color: #16a34a; }

.upgrade-prompt-link {
  color: var(--color-primary, #0d7a5f);
  font-weight: 700;
  cursor: pointer;
}

.features-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}

.feature-status-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
}

.feature-status-card:not(.is-active) {
  opacity: 0.6;
}

.feat-status-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.is-active .feat-status-icon {
  background: rgba(13, 122, 95, 0.12);
  color: var(--color-primary, #0d7a5f);
}

.feature-status-card:not(.is-active) .feat-status-icon {
  background: #f3f4f6;
  color: #9ca3af;
}

.feat-status-text {
  flex: 1;
}

.feat-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feat-title {
  font-size: 0.8125rem;
  color: var(--color-text, #111827);
}

.feat-badge {
  font-size: 0.625rem;
  font-weight: 800;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.badge-on {
  background: rgba(13, 122, 95, 0.1);
  color: var(--color-primary, #0d7a5f);
}

.badge-off {
  background: #f3f4f6;
  color: #9ca3af;
}

.feat-desc {
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.35;
  margin: 0.2rem 0 0;
}

.plans-switch-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 900px) {
  .plans-switch-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .plans-switch-grid {
    grid-template-columns: 1fr;
  }
}

.plan-compare-card {
  position: relative;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
}

.plan-compare-card.is-current-plan {
  border-color: #9ca3af;
  background: var(--color-background, #f9fafb);
}

.plan-compare-card.is-featured-plan {
  border-color: var(--color-primary, #0d7a5f);
  box-shadow: 0 4px 16px rgba(13, 122, 95, 0.1);
}

.current-pill,
.featured-pill {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
}

.current-pill {
  background: #4b5563;
  color: #ffffff;
}

.featured-pill {
  background: var(--color-primary, #0d7a5f);
  color: #ffffff;
}

.p-head {
  text-align: center;
  min-height: 110px;
}

.p-name {
  font-size: 1.125rem;
  font-weight: 800;
  margin: 0 0 0.4rem;
  color: var(--color-text, #111827);
}

.p-price {
  margin-bottom: 0.4rem;
}

.p-val {
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--color-text, #111827);
}

.p-cur {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  margin-left: 0.2rem;
}

.p-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.35;
  margin: 0;
}

.p-divider {
  height: 1px;
  background: var(--color-border, #e5e7eb);
  margin: 0.85rem 0;
}

.p-key-limits {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  flex: 1;
}

.p-key-limits strong {
  color: var(--color-text, #111827);
}

.p-footer {
  margin-top: 1.25rem;
}

.history-card {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1.25rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-row {
  display: flex;
  gap: 0.75rem;
}

.history-bullet {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-primary, #0d7a5f);
  margin-top: 5px;
  flex-shrink: 0;
}

.history-info {
  flex: 1;
}

.history-top {
  display: flex;
  justify-content: space-between;
}

.history-event {
  font-size: 0.8125rem;
  color: var(--color-text, #111827);
}

.history-date {
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
}

.history-note {
  font-size: 0.7813rem;
  color: var(--color-text-muted, #4b5563);
  margin: 0.2rem 0;
}

.history-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
}
</style>

