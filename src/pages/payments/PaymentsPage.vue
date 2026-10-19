<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { paymentService } from '@/services'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import type { Payment, PaymentStatus } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  CreditCard,
  DollarSign,
  Phone,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  AlertCircle
} from 'lucide-vue-next'

const tenantStore = useTenantStore()
const toastStore = useToastStore()

const payments = ref<Payment[]>([])
const isLoading = ref(true)
const statusFilter = ref<string>('all')
const methodFilter = ref<string>('all')
const searchQuery = ref('')

const selectedPayment = ref<Payment | null>(null)
const isDetailModalOpen = ref(false)

const loadPayments = async () => {
  if (!tenantStore.currentRestaurant) return
  isLoading.value = true
  try {
    payments.value = await paymentService.getPayments(tenantStore.currentRestaurant.id)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadPayments()
})

const filteredPayments = computed(() => {
  return payments.value.filter(p => {
    const matchesStatus = statusFilter.value === 'all' || p.status === statusFilter.value
    const matchesMethod = methodFilter.value === 'all' || p.method === methodFilter.value
    const matchesSearch = !searchQuery.value ||
      p.orderCode.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      p.transactionReference.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (p.customerPhone && p.customerPhone.includes(searchQuery.value))
    return matchesStatus && matchesMethod && matchesSearch
  })
})

const openDetails = (pay: Payment) => {
  selectedPayment.value = pay
  isDetailModalOpen.value = true
}

const handleConfirmPayment = async (pay: Payment) => {
  try {
    const updated = await paymentService.updateStatus(pay.id, 'paid')
    const index = payments.value.findIndex(p => p.id === pay.id)
    if (index !== -1) payments.value[index] = updated
    toastStore.success('Pagamento Confirmado', `Recebimento do pedido ${pay.orderCode} confirmado com sucesso.`)
    isDetailModalOpen.value = false
  } catch (e) {
    toastStore.error('Erro ao atualizar pagamento', (e as Error).message)
  }
}

const handleRefundPayment = async (pay: Payment) => {
  if (confirm(`Confirma o reembolso de ${pay.amount} MT para a transação ${pay.transactionReference}?`)) {
    try {
      const updated = await paymentService.updateStatus(pay.id, 'refunded')
      const index = payments.value.findIndex(p => p.id === pay.id)
      if (index !== -1) payments.value[index] = updated
      toastStore.info('Reembolso Processado', `Pagamento marcado como reembolsado.`)
      isDetailModalOpen.value = false
    } catch (e) {
      toastStore.error('Erro no reembolso', (e as Error).message)
    }
  }
}
</script>

<template>
  <div class="payments-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Pagamentos Demonstrativos</h1>
        <p class="page-subtitle">Acompanhe transações de M-Pesa, e-Mola, Cartões POS e Dinheiro ao balcão</p>
      </div>

      <div class="badge badge-warning">Simulação Financeira Segura</div>
    </div>

    <!-- Filters Bar -->
    <div class="filters-card">
      <div class="search-wrap">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Pesquisar por ref #ORD, código de transação ou telefone..."
          class="search-input"
        />
      </div>

      <div class="selects-wrap">
        <select v-model="methodFilter" class="filter-select">
          <option value="all">Todos os Métodos</option>
          <option value="mpesa">M-Pesa</option>
          <option value="emola">e-Mola</option>
          <option value="card">Cartão POS</option>
          <option value="cash">Dinheiro</option>
        </select>

        <select v-model="statusFilter" class="filter-select">
          <option value="all">Todos os Estados</option>
          <option value="paid">Pago</option>
          <option value="awaiting_confirmation">Aguardando Confirmação</option>
          <option value="pending">Pendente</option>
          <option value="refunded">Reembolsado</option>
        </select>
      </div>
    </div>

    <!-- Payments Table -->
    <div class="app-card payments-table-card">
      <div v-if="filteredPayments.length === 0" class="empty-state">
        <CreditCard :size="36" class="text-muted" />
        <p>Nenhuma transação financeira encontrada com os filtros selecionados.</p>
      </div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Pedido</th>
              <th>Mesa</th>
              <th>Método</th>
              <th>Valor (MT)</th>
              <th>Contacto Cliente</th>
              <th>Estado</th>
              <th>Data/Hora</th>
              <th class="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pay in filteredPayments"
              :key="pay.id"
              class="clickable-row"
              @click="openDetails(pay)"
            >
              <td>
                <span class="ref-code">{{ pay.transactionReference }}</span>
              </td>
              <td>
                <strong>{{ pay.orderCode }}</strong>
              </td>
              <td>Mesa {{ pay.tableNumber || 'Balcão' }}</td>
              <td>
                <span class="method-tag" :class="pay.method">
                  <DollarSign v-if="pay.method === 'mpesa'" :size="13" />
                  <Phone v-else-if="pay.method === 'emola'" :size="13" />
                  <CreditCard v-else-if="pay.method === 'card'" :size="13" />
                  {{ pay.method.toUpperCase() }}
                </span>
              </td>
              <td>
                <strong>{{ pay.amount.toLocaleString('pt-MZ') }} MT</strong>
              </td>
              <td class="text-xs">{{ pay.customerPhone || 'Não indicado' }}</td>
              <td>
                <AppBadge
                  :variant="
                    pay.status === 'paid' ? 'success' :
                    pay.status === 'awaiting_confirmation' ? 'warning' :
                    pay.status === 'refunded' ? 'danger' : 'neutral'
                  "
                >
                  {{ pay.status === 'awaiting_confirmation' ? 'Aguardando' : pay.status }}
                </AppBadge>
              </td>
              <td class="text-xs text-muted">
                {{ new Date(pay.createdAt).toLocaleDateString('pt-PT') }} {{ new Date(pay.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }}
              </td>
              <td class="text-right" @click.stop>
                <AppButton
                  v-if="pay.status === 'awaiting_confirmation'"
                  variant="success"
                  size="sm"
                  @click="handleConfirmPayment(pay)"
                >
                  Confirmar
                </AppButton>
                <AppButton
                  v-else
                  variant="secondary"
                  size="sm"
                  @click="openDetails(pay)"
                >
                  Ver
                </AppButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Payment Detail Modal -->
    <AppModal
      :is-open="isDetailModalOpen"
      :title="`Transação ${selectedPayment?.transactionReference}`"
      subtitle="Detalhes do pagamento e conciliação de caixa"
      maxWidth="480px"
      @close="isDetailModalOpen = false"
    >
      <div v-if="selectedPayment" class="payment-modal-body">
        <div class="amount-banner">
          <span class="amount-label">Valor Total Liquidado</span>
          <span class="amount-val">{{ selectedPayment.amount.toLocaleString('pt-MZ') }} MT</span>
        </div>

        <div class="fields-list">
          <div class="field-item">
            <span>Pedido Associado:</span>
            <strong>{{ selectedPayment.orderCode }}</strong>
          </div>
          <div class="field-item">
            <span>Mesa:</span>
            <strong>Mesa {{ selectedPayment.tableNumber || 'Balcão' }}</strong>
          </div>
          <div class="field-item">
            <span>Método de Pagamento:</span>
            <strong>{{ selectedPayment.method.toUpperCase() }}</strong>
          </div>
          <div class="field-item">
            <span>Referência Externa:</span>
            <span class="font-mono">{{ selectedPayment.transactionReference }}</span>
          </div>
          <div v-if="selectedPayment.customerPhone" class="field-item">
            <span>Telefone do Cliente:</span>
            <span>{{ selectedPayment.customerPhone }}</span>
          </div>
          <div class="field-item">
            <span>Estado Atual:</span>
            <AppBadge :variant="selectedPayment.status === 'paid' ? 'success' : 'warning'">
              {{ selectedPayment.status.toUpperCase() }}
            </AppBadge>
          </div>
        </div>

        <div v-if="selectedPayment.notes" class="notes-box">
          {{ selectedPayment.notes }}
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isDetailModalOpen = false">Fechar</AppButton>
        <AppButton
          v-if="selectedPayment?.status === 'awaiting_confirmation'"
          variant="success"
          @click="handleConfirmPayment(selectedPayment!)"
        >
          Confirmar Recebimento
        </AppButton>
        <AppButton
          v-if="selectedPayment?.status === 'paid'"
          variant="danger"
          size="sm"
          @click="handleRefundPayment(selectedPayment!)"
        >
          Processar Reembolso
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.payments-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.filters-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1rem;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-neutral-400);
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.selects-wrap {
  display: flex;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  background: #ffffff;
  outline: none;
}

.payments-table-card {
  padding: 0;
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.data-table th {
  background: var(--color-neutral-50);
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  border-bottom: 1px solid var(--border-medium);
}

.data-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.clickable-row {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.clickable-row:hover {
  background-color: var(--color-neutral-50);
}

.ref-code {
  font-family: monospace;
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--color-primary-800);
}

.method-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--color-neutral-100);
  color: var(--color-neutral-800);
}

.method-tag.mpesa { background: #fee2e2; color: #dc2626; }
.method-tag.emola { background: #fef3c7; color: #d97706; }
.method-tag.card { background: #eff6ff; color: #2563eb; }

.text-right {
  text-align: right;
}

/* Modal */
.payment-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.amount-banner {
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  text-align: center;
}

.amount-label {
  display: block;
  font-size: 0.75rem;
  color: var(--color-primary-800);
  font-weight: 600;
}

.amount-val {
  font-size: 1.75rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-primary-900);
}

.fields-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.field-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.notes-box {
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  padding: 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: 4rem;
  color: var(--text-muted);
}
</style>
