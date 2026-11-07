<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Plan, Subscription, SubscriptionStatus } from '@/types'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Calendar, History, ArrowUpRight, ShieldAlert } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  subscription: Subscription | null
  plans: Plan[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', updates: Partial<Subscription>, historyNote?: string): void
}>()

const selectedPlanId = ref('')
const selectedStatus = ref<SubscriptionStatus>('active')
const renewalDate = ref('')
const isAutoRenew = ref(true)
const adminNote = ref('')

const statusOptions: { label: string; value: SubscriptionStatus }[] = [
  { label: 'Ativa', value: 'active' },
  { label: 'Período Experimental (Trial)', value: 'trial' },
  { label: 'Suspensa', value: 'suspended' },
  { label: 'Expirada', value: 'expired' },
  { label: 'Cancelada', value: 'cancelled' }
]

watch(
  () => props.subscription,
  (sub) => {
    if (!sub) return
    selectedPlanId.value = sub.planId
    selectedStatus.value = sub.status
    renewalDate.value = sub.renewalDate ? sub.renewalDate.substring(0, 10) : ''
    isAutoRenew.value = sub.isAutoRenew
    adminNote.value = ''
  },
  { immediate: true }
)

const currentPlanObj = computed(() => {
  return props.plans.find(p => p.id === selectedPlanId.value)
})

const isPlanChanged = computed(() => {
  return props.subscription ? selectedPlanId.value !== props.subscription.planId : false
})

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

const getEventLabel = (event: string): string => {
  switch (event) {
    case 'created': return 'Subscrição Criada'
    case 'plan_changed': return 'Plano Alterado'
    case 'activated': return 'Ativada'
    case 'suspended': return 'Suspensa'
    case 'renewed': return 'Renovada'
    case 'cancelled': return 'Cancelada'
    case 'trial_started': return 'Início de Teste'
    case 'expired': return 'Expirada'
    default: return event
  }
}

const handleSave = () => {
  if (!props.subscription) return

  const targetPlan = currentPlanObj.value
  const updates: Partial<Subscription> = {
    planId: selectedPlanId.value,
    planName: targetPlan ? targetPlan.name : props.subscription.planName,
    monthlyPrice: targetPlan ? targetPlan.price : props.subscription.monthlyPrice,
    status: selectedStatus.value,
    renewalDate: renewalDate.value,
    isAutoRenew: isAutoRenew.value
  }

  emit('save', updates, adminNote.value.trim() || undefined)
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="subscription ? `Gerir Subscrição: ${subscription.companyName}` : 'Gerir Subscrição'"
    :subtitle="'Controlo administrativo de plano, estado, renovações e auditoria'"
    max-width="720px"
    @close="emit('close')"
  >
    <div v-if="subscription" class="sub-manager-container">
      <!-- Overview Card -->
      <div class="company-sub-card">
        <div>
          <span class="sub-label">Empresa</span>
          <h3 class="company-name">{{ subscription.companyName }}</h3>
          <span class="tenant-id font-mono">ID: {{ subscription.tenantId }}</span>
        </div>

        <div class="status-price-box">
          <AppBadge :variant="getStatusBadgeVariant(selectedStatus)">
            {{ selectedStatus.toUpperCase() }}
          </AppBadge>
          <div class="mrr-val font-mono">
            {{ (currentPlanObj?.price || subscription.monthlyPrice || 0).toLocaleString('pt-MZ') }} MT/mês
          </div>
        </div>
      </div>

      <!-- Controls Form -->
      <div class="settings-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Plano Atribuído</label>
            <select v-model="selectedPlanId" class="form-select">
              <option
                v-for="p in plans"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }} — {{ p.price.toLocaleString('pt-MZ') }} MT/mês
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Estado da Subscrição</label>
            <select v-model="selectedStatus" class="form-select">
              <option
                v-for="opt in statusOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="isPlanChanged" class="plan-change-notice">
          <ArrowUpRight :size="16" />
          <span>
            Atenção: A alterar de <strong>{{ subscription.planName }}</strong> para
            <strong>{{ currentPlanObj?.name }}</strong>. O valor mensal será atualizado para
            <strong>{{ currentPlanObj?.price.toLocaleString('pt-MZ') }} MT</strong>.
          </span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Data de Renovação</label>
            <div class="date-input-wrap">
              <Calendar :size="16" class="date-icon" />
              <input
                type="date"
                v-model="renewalDate"
                class="form-date-input"
              />
            </div>
          </div>

          <div class="form-group checkbox-cell">
            <label class="toggle-label">
              <input type="checkbox" v-model="isAutoRenew" />
              <span>Renovação Automática (M-Pesa / Cartão)</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Registar Nota de Alteração (Histórico)</label>
          <input
            type="text"
            v-model="adminNote"
            placeholder="Ex: Prorrogação de período experimental ou desconto acordado..."
            class="form-input"
          />
        </div>
      </div>

      <!-- Subscription History Timeline -->
      <div class="history-section">
        <div class="history-title">
          <History :size="16" />
          <span>Histórico de Operações e Cobranças</span>
        </div>

        <div v-if="subscription.history && subscription.history.length > 0" class="timeline-list">
          <div
            v-for="item in subscription.history"
            :key="item.id"
            class="timeline-item"
          >
            <div class="timeline-bullet"></div>
            <div class="timeline-content">
              <div class="timeline-head">
                <span class="timeline-event">{{ getEventLabel(item.event) }}</span>
                <span class="timeline-date font-mono">
                  {{ new Date(item.date).toLocaleDateString('pt-MZ') }} {{ new Date(item.date).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </div>
              <p v-if="item.note" class="timeline-note">{{ item.note }}</p>
              <div class="timeline-meta">
                <span v-if="item.amount !== undefined" class="meta-amount">
                  Valor: <strong>{{ item.amount.toLocaleString('pt-MZ') }} MT</strong>
                </span>
                <span class="meta-actor">Por: {{ item.performedBy }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-history">
          Nenhum registo histórico encontrado para esta subscrição.
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer">
        <AppButton variant="outline" @click="emit('close')">
          Cancelar
        </AppButton>
        <AppButton variant="primary" @click="handleSave">
          Guardar Alterações
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.sub-manager-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.company-sub-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-background, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1.15rem 1.25rem;
}

.sub-label {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.company-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #111827);
  margin: 0.2rem 0;
}

.tenant-id {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
}

.status-price-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.mrr-val {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-primary, #0d7a5f);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.checkbox-cell {
  justify-content: center;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #374151);
}

.form-select,
.form-input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, #d1d5db);
  background: #ffffff;
  color: var(--color-text, #111827);
  font-size: 0.875rem;
}

.date-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  background: #ffffff;
  padding: 0 0.75rem;
}

.date-icon {
  color: var(--color-text-muted, #6b7280);
  margin-right: 0.5rem;
}

.form-date-input {
  width: 100%;
  border: none;
  padding: 0.65rem 0;
  font-size: 0.875rem;
  color: var(--color-text, #111827);
  outline: none;
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #111827);
  cursor: pointer;
}

.toggle-label input {
  width: 17px;
  height: 17px;
  accent-color: var(--color-primary, #0d7a5f);
}

.plan-change-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: rgba(13, 122, 95, 0.08);
  border: 1px solid rgba(13, 122, 95, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--color-primary, #0d7a5f);
}

.history-section {
  border-top: 1px solid var(--color-border, #e5e7eb);
  padding-top: 1rem;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text, #111827);
  margin-bottom: 0.85rem;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.timeline-item {
  display: flex;
  gap: 0.75rem;
  position: relative;
}

.timeline-bullet {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-primary, #0d7a5f);
  margin-top: 5px;
  flex-shrink: 0;
}

.timeline-content {
  flex: 1;
  background: var(--color-background, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
}

.timeline-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeline-event {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text, #111827);
}

.timeline-date {
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
}

.timeline-note {
  font-size: 0.7813rem;
  color: var(--color-text, #374151);
  margin: 0.25rem 0;
}

.timeline-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
}

.empty-history {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #9ca3af);
  text-align: center;
  padding: 1.5rem 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}
</style>

