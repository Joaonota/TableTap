<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Order, TableSession, PaymentMethod } from '@/types'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  Receipt,
  DollarSign,
  Phone,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  session: TableSession | null
  orders: Order[]
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm-bill', payload: { paymentMethod: PaymentMethod; notes?: string; totalAmount: number }): void
}>()

const selectedMethod = ref<PaymentMethod>('mpesa')
const billNotes = ref('')

const grandTotal = computed(() => {
  return props.orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0)
})

const handleConfirm = () => {
  emit('confirm-bill', {
    paymentMethod: selectedMethod.value,
    notes: billNotes.value.trim() || undefined,
    totalAmount: grandTotal.value
  })
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    title="Pedir a Conta da Mesa"
    :subtitle="session?.primaryCustomerName ? `Mesa de ${session.primaryCustomerName}` : ''"
    max-width="520px"
    @close="emit('close')"
  >
    <div class="bill-modal-container">
      <!-- Total Callout -->
      <div class="bill-total-card">
        <Receipt :size="28" class="bill-icon" />
        <div class="total-text">
          <span class="total-caption">Total acumulado na sessão:</span>
          <span class="total-sum">{{ grandTotal.toLocaleString('pt-MZ') }} MT</span>
        </div>
      </div>

      <div class="bill-orders-summary">
        <div class="summary-title">Resumo dos Pedidos Confirmados:</div>
        <div class="orders-compact-list">
          <div
            v-for="order in orders.filter(o => o.status !== 'cancelled')"
            :key="order.id"
            class="compact-order-row"
          >
            <span class="ord-name">{{ order.orderCode }} ({{ order.items.length }} {{ order.items.length === 1 ? 'item' : 'itens' }})</span>
            <span class="ord-price">{{ order.total.toLocaleString('pt-MZ') }} MT</span>
          </div>
        </div>
      </div>

      <!-- Payment Method Selection -->
      <div class="method-section">
        <label class="section-label">Como prefere efetuar o pagamento?</label>
        <div class="payment-methods-grid">
          <button
            type="button"
            class="method-card"
            :class="{ 'is-selected': selectedMethod === 'mpesa' }"
            @click="selectedMethod = 'mpesa'"
          >
            <DollarSign :size="18" />
            <span>M-Pesa</span>
          </button>

          <button
            type="button"
            class="method-card"
            :class="{ 'is-selected': selectedMethod === 'emola' }"
            @click="selectedMethod = 'emola'"
          >
            <Phone :size="18" />
            <span>e-Mola</span>
          </button>

          <button
            type="button"
            class="method-card"
            :class="{ 'is-selected': selectedMethod === 'card' }"
            @click="selectedMethod = 'card'"
          >
            <CreditCard :size="18" />
            <span>Cartão POS</span>
          </button>

          <button
            type="button"
            class="method-card"
            :class="{ 'is-selected': selectedMethod === 'cash' }"
            @click="selectedMethod = 'cash'"
          >
            <Banknote :size="18" />
            <span>Numerário</span>
          </button>
        </div>
      </div>

      <!-- Extra notes / NUIT -->
      <div class="form-group">
        <label for="billNotesInput" class="section-label">NUIT na Fatura ou Observações (Opcional)</label>
        <input
          id="billNotesInput"
          v-model="billNotes"
          type="text"
          placeholder="Ex: NUIT: 400123456 ou Dividir conta..."
          class="form-input"
        />
      </div>

      <div class="demo-disclaimer">
        <AlertCircle :size="15" class="disclaimer-icon" />
        <span>O TapMenu não cobra pagamentos: a equipa é notificada, traz a conta à mesa e confirma o pagamento no método que escolher.</span>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" size="md" @click="emit('close')">
        Voltar
      </AppButton>
      <AppButton
        variant="primary"
        size="lg"
        :loading="isSubmitting"
        @click="handleConfirm"
      >
        <template #icon-left>
          <CheckCircle2 :size="18" />
        </template>
        Confirmar Pedido da Conta
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.bill-modal-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.bill-total-card {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  color: #ffffff;
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.bill-icon {
  color: #93c5fd;
}

.total-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.total-caption {
  font-size: 0.75rem;
  color: #cbd5e1;
}

.total-sum {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
}

.bill-orders-summary {
  background-color: var(--color-slate-50);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.875rem 1rem;
}

.summary-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
}

.orders-compact-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.compact-order-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.ord-name {
  color: var(--text-main);
  font-weight: 600;
}

.ord-price {
  font-weight: 700;
  color: var(--text-main);
}

.method-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.payment-methods-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

.method-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: #ffffff;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 44px;
}

.method-card:hover {
  border-color: var(--color-primary-400);
}

.method-card.is-selected {
  border-color: var(--color-primary-700);
  background-color: #eff6ff;
  color: var(--color-primary-900);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-input {
  width: 100%;
  padding: 0.65rem 0.875rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
  min-height: 44px;
}

.form-input:focus {
  border-color: var(--color-primary-600);
}

.demo-disclaimer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  background-color: var(--color-slate-100);
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
}

.disclaimer-icon {
  flex-shrink: 0;
  color: var(--color-amber-600);
}
</style>
