<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Table, TableSession, Order, ServiceRequest, PaymentMethod, OrderStatus, ServiceRequestStatus } from '@/types'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Users,
  Clock,
  UtensilsCrossed,
  Receipt,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Phone,
  Banknote,
  XCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  table: Table | null
  session: TableSession | null
  orders: Order[]
  requests: ServiceRequest[]
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update-order-status', payload: { orderId: string; status: OrderStatus }): void
  (e: 'update-request-status', payload: { requestId: string; status: ServiceRequestStatus }): void
  (e: 'register-payment', payload: { method: PaymentMethod }): void
  (e: 'close-session'): void
}>()

const activeTab = ref<'orders' | 'service' | 'bill'>('orders')
const selectedPaymentMethod = ref<PaymentMethod>('mpesa')
const showCloseConfirm = ref(false)

const grandTotal = computed(() => {
  return props.orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0)
})

const getStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'received':
      return { variant: 'warning' as const, label: 'Recebido' }
    case 'confirmed':
      return { variant: 'primary' as const, label: 'Confirmado' }
    case 'preparing':
      return { variant: 'warning' as const, label: 'A Preparar' }
    case 'ready':
      return { variant: 'success' as const, label: 'Pronto' }
    case 'delivered':
      return { variant: 'neutral' as const, label: 'Entregue' }
    case 'cancelled':
      return { variant: 'danger' as const, label: 'Cancelado' }
    default:
      return { variant: 'neutral' as const, label: status }
  }
}

const getElapsedMinutes = (startedAt?: string) => {
  if (!startedAt) return ''
  const diffMs = Date.now() - new Date(startedAt).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60000))
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return `há ${hours}h ${remMins}m`
}

const handleConfirmClose = () => {
  showCloseConfirm.value = false
  emit('close-session')
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="table ? `Detalhes Operacionais — Mesa ${table.number}` : 'Detalhes da Mesa'"
    :subtitle="table ? `${table.area} • Lotação: até ${table.capacity} pessoas` : ''"
    max-width="680px"
    @close="emit('close')"
  >
    <div v-if="table" class="table-detail-container">
      <!-- Session Card Banner -->
      <div v-if="session" class="session-card-banner">
        <div class="banner-top">
          <div class="customer-info-box">
            <span class="caption">Responsável da Sessão</span>
            <div class="customer-name-row">
              <strong class="customer-name">{{ session.customerName }}</strong>
              <AppBadge :variant="session.status === 'awaiting_bill' ? 'warning' : 'primary'">
                {{ session.status === 'awaiting_bill' ? 'Aguardar Conta' : 'Sessão Ativa' }}
              </AppBadge>
            </div>
          </div>

          <div class="timing-box">
            <span class="caption">Tempo Decorrido</span>
            <span class="elapsed-time">
              <Clock :size="13" class="inline-clock" />
              {{ getElapsedMinutes(session.startedAt) }}
            </span>
          </div>
        </div>

        <div class="banner-bottom">
          <div class="meta-item">
            <Users :size="14" />
            <span>{{ session.partySize || table.capacity }} pessoas</span>
          </div>
          <div v-if="session.notes" class="meta-item text-muted">
            <span>Obs: "{{ session.notes }}"</span>
          </div>
          <div class="meta-item total-badge">
            <span>Total da Conta: <strong>{{ grandTotal.toLocaleString('pt-MZ') }} MT</strong></span>
          </div>
        </div>
      </div>

      <!-- If Table is Free -->
      <div v-else class="free-table-banner">
        <CheckCircle2 :size="24" class="free-icon" />
        <div class="free-text">
          <strong>Mesa Livre para Atendimento</strong>
          <p>Não existe sessão ativa no momento. Os clientes podem abrir o menu pelo NFC ou QR Code.</p>
        </div>
      </div>

      <!-- Navigation Tabs (Only when session exists) -->
      <div v-if="session" class="detail-tabs">
        <button
          type="button"
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'orders' }"
          @click="activeTab = 'orders'"
        >
          <UtensilsCrossed :size="16" />
          <span>Pedidos da Sessão ({{ orders.length }})</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'service' }"
          @click="activeTab = 'service'"
        >
          <BellRing :size="16" />
          <span>Solicitações ({{ requests.length }})</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'bill' }"
          @click="activeTab = 'bill'"
        >
          <Receipt :size="16" />
          <span>Encerramento & Conta</span>
        </button>
      </div>

      <!-- TAB 1: Orders -->
      <div v-if="session && activeTab === 'orders'" class="tab-pane">
        <div v-if="orders.length === 0" class="empty-tab-view">
          <UtensilsCrossed :size="32" class="empty-icon" />
          <p>Nenhum pedido realizado nesta sessão até ao momento.</p>
        </div>

        <div v-else class="orders-accordion">
          <div
            v-for="order in orders"
            :key="order.id"
            class="order-row-card"
          >
            <div class="order-header-line">
              <div class="order-code-box">
                <span class="order-badge-pill" :class="{ 'is-additional': order.isAdditional }">
                  {{ order.isAdditional ? 'Pedido Adicional' : '1º Pedido' }}
                </span>
                <strong class="order-code">{{ order.orderCode }}</strong>
                <span class="order-time">{{ new Date(order.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>

              <div class="order-status-actions">
                <AppBadge :variant="getStatusBadge(order.status).variant">
                  {{ getStatusBadge(order.status).label }}
                </AppBadge>

                <!-- Quick status updater -->
                <select
                  :value="order.status"
                  class="mini-status-select"
                  @change="emit('update-order-status', { orderId: order.id, status: ($event.target as HTMLSelectElement).value as OrderStatus })"
                >
                  <option value="received">Recebido</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="preparing">A Preparar</option>
                  <option value="ready">Pronto</option>
                  <option value="delivered">Entregue</option>
                  <option value="cancelled">Cancelar</option>
                </select>
              </div>
            </div>

            <!-- Items list -->
            <div class="items-list-box">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="item-line"
              >
                <span class="item-qty">{{ item.quantity }}x</span>
                <span class="item-title">{{ item.productName }}</span>
                <span v-if="item.selectedVariant" class="item-sub">({{ item.selectedVariant.name }})</span>
                <span class="item-tot">{{ item.totalPrice.toLocaleString('pt-MZ') }} MT</span>
              </div>
            </div>

            <div class="order-footer-line">
              <span>Total do Pedido:</span>
              <strong>{{ order.total.toLocaleString('pt-MZ') }} MT</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: Service Requests -->
      <div v-if="session && activeTab === 'service'" class="tab-pane">
        <div v-if="requests.length === 0" class="empty-tab-view">
          <BellRing :size="32" class="empty-icon" />
          <p>Nenhuma solicitação de assistência pendente para esta mesa.</p>
        </div>

        <div v-else class="requests-list">
          <div
            v-for="req in requests"
            :key="req.id"
            class="request-item-card"
          >
            <div class="req-left">
              <div class="req-title-row">
                <strong class="req-type">{{ req.type === 'waiter_call' ? 'Chamada de Garçom' : req.type === 'bill' ? 'Pedido de Conta' : req.type === 'water' ? 'Água' : req.type === 'cutlery' ? 'Talheres' : 'Assistência' }}</strong>
                <AppBadge :variant="req.status === 'completed' ? 'success' : req.status === 'in_progress' ? 'warning' : 'danger'">
                  {{ req.status === 'completed' ? 'Concluída' : req.status === 'in_progress' ? 'Em Atendimento' : 'Nova' }}
                </AppBadge>
              </div>
              <p v-if="req.notes" class="req-notes">"{{ req.notes }}"</p>
              <span class="req-time">Registada às {{ new Date(req.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>

            <div class="req-actions">
              <button
                v-if="req.status === 'new'"
                type="button"
                class="action-btn-sm warning"
                @click="emit('update-request-status', { requestId: req.id, status: 'in_progress' })"
              >
                Assumir
              </button>

              <button
                v-if="req.status !== 'completed'"
                type="button"
                class="action-btn-sm success"
                @click="emit('update-request-status', { requestId: req.id, status: 'completed' })"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Bill & Close Session -->
      <div v-if="session && activeTab === 'bill'" class="tab-pane">
        <div class="bill-overview-card">
          <div class="bill-amount-row">
            <span class="bill-lbl">Total Acumulado a Cobrar:</span>
            <span class="bill-val">{{ grandTotal.toLocaleString('pt-MZ') }} MT</span>
          </div>

          <div class="bill-breakdown-box">
            <div class="bb-line">
              <span>Total de Pedidos Confirmados:</span>
              <span>{{ orders.filter(o => o.status !== 'cancelled').length }}</span>
            </div>
            <div class="bb-line">
              <span>Estado da Mesa:</span>
              <strong class="status-highlight">{{ table.status.toUpperCase() }}</strong>
            </div>
          </div>

          <!-- Simulated Payment Registration -->
          <div class="payment-action-box">
            <span class="box-title">Registar Pagamento Demonstrativo:</span>
            <div class="payment-buttons-grid">
              <button
                type="button"
                class="pay-btn"
                :class="{ 'is-active': selectedPaymentMethod === 'mpesa' }"
                @click="selectedPaymentMethod = 'mpesa'"
              >
                <DollarSign :size="16" />
                <span>M-Pesa</span>
              </button>

              <button
                type="button"
                class="pay-btn"
                :class="{ 'is-active': selectedPaymentMethod === 'emola' }"
                @click="selectedPaymentMethod = 'emola'"
              >
                <Phone :size="16" />
                <span>e-Mola</span>
              </button>

              <button
                type="button"
                class="pay-btn"
                :class="{ 'is-active': selectedPaymentMethod === 'card' }"
                @click="selectedPaymentMethod = 'card'"
              >
                <CreditCard :size="16" />
                <span>POS / Cartão</span>
              </button>

              <button
                type="button"
                class="pay-btn"
                :class="{ 'is-active': selectedPaymentMethod === 'cash' }"
                @click="selectedPaymentMethod = 'cash'"
              >
                <Banknote :size="16" />
                <span>Numerário</span>
              </button>
            </div>

            <AppButton
              variant="secondary"
              size="md"
              class="register-pay-btn"
              @click="emit('register-payment', { method: selectedPaymentMethod })"
            >
              <CheckCircle2 :size="16" />
              <span>Simular Registo de Pagamento ({{ selectedPaymentMethod.toUpperCase() }})</span>
            </AppButton>
          </div>

          <!-- Close session flow -->
          <div class="close-session-box">
            <div class="close-warning">
              <AlertTriangle :size="18" class="warn-icon" />
              <span>
                O encerramento liberta a mesa para novos clientes e arquiva os pedidos desta sessão no histórico.
              </span>
            </div>

            <div v-if="!showCloseConfirm" class="close-action-row">
              <AppButton
                variant="danger"
                size="lg"
                class="full-width"
                @click="showCloseConfirm = true"
              >
                Encerrar Sessão & Libertar Mesa
              </AppButton>
            </div>

            <!-- Confirmation step -->
            <div v-else class="confirm-close-box">
              <p class="confirm-msg">Tem a certeza de que deseja encerrar a sessão de <strong>{{ session.customerName }}</strong> e libertar a Mesa {{ table.number }}?</p>
              <div class="confirm-btns-row">
                <AppButton variant="secondary" size="md" @click="showCloseConfirm = false">Cancelar</AppButton>
                <AppButton variant="danger" size="md" :loading="isSubmitting" @click="handleConfirmClose">
                  Sim, Encerrar e Libertar
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" size="md" @click="emit('close')">
        Fechar Detalhes
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.table-detail-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.session-card-banner {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  color: #ffffff;
  padding: 1.25rem;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.banner-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.caption {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #93c5fd;
}

.customer-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.customer-name {
  font-size: 1.25rem;
  font-weight: 800;
}

.timing-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.elapsed-time {
  font-size: 0.875rem;
  font-weight: 700;
  color: #ffffff;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.inline-clock {
  color: #93c5fd;
}

.banner-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 0.8125rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.total-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
}

.free-table-banner {
  background-color: var(--color-success-50);
  border: 1.5px solid var(--color-success-200);
  border-radius: var(--radius-xl);
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.free-icon {
  color: var(--color-success-600);
  flex-shrink: 0;
}

.free-text strong {
  font-size: 1rem;
  color: var(--color-success-800);
}

.free-text p {
  margin: 0.25rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.detail-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1.5px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: var(--radius-md);
  border: none;
  background: none;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background-color: var(--color-slate-100);
  color: var(--text-main);
}

.tab-btn.is-active {
  background-color: #eff6ff;
  color: var(--color-primary-800);
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.empty-tab-view {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
}

.empty-icon {
  margin: 0 auto 0.5rem auto;
  opacity: 0.4;
}

/* Orders Accordion */
.orders-accordion {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.order-row-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 0.875rem 1rem;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.order-header-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-code-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.order-badge-pill {
  font-size: 0.6875rem;
  font-weight: 800;
  background-color: var(--color-slate-100);
  color: var(--color-slate-700);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
}

.order-badge-pill.is-additional {
  background-color: #eff6ff;
  color: #1e40af;
}

.order-code {
  font-size: 0.9375rem;
}

.order-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.order-status-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mini-status-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  outline: none;
  background-color: #ffffff;
}

.items-list-box {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.item-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.item-qty {
  font-weight: 700;
  color: var(--color-primary-800);
  width: 24px;
}

.item-title {
  flex: 1;
}

.item-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.item-tot {
  font-weight: 700;
}

.order-footer-line {
  display: flex;
  justify-content: space-between;
  border-top: 1px dashed var(--border-color);
  padding-top: 0.5rem;
  font-size: 0.8125rem;
}

/* Service Requests List */
.requests-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.request-item-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 0.875rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #ffffff;
}

.req-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.req-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.req-type {
  font-size: 0.875rem;
}

.req-notes {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.req-time {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.req-actions {
  display: flex;
  gap: 0.35rem;
}

.action-btn-sm {
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.action-btn-sm.warning {
  background-color: var(--color-amber-50);
  border-color: var(--color-amber-300);
  color: var(--color-amber-800);
}

.action-btn-sm.success {
  background-color: var(--color-success-50);
  border-color: var(--color-success-300);
  color: var(--color-success-800);
}

/* Bill Tab */
.bill-overview-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.bill-amount-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background-color: #eff6ff;
  border: 1.5px solid #bfdbfe;
  border-radius: var(--radius-lg);
}

.bill-lbl {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e3a8a;
}

.bill-val {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: #1e40af;
}

.bill-breakdown-box {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-slate-50);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
}

.bb-line {
  display: flex;
  justify-content: space-between;
}

.status-highlight {
  color: var(--color-primary-800);
}

.payment-action-box {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.box-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.payment-buttons-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.pay-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.625rem 0.25rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.pay-btn.is-active {
  border-color: var(--color-primary-600);
  background-color: #eff6ff;
  color: var(--color-primary-800);
}

.register-pay-btn {
  width: 100%;
}

.close-session-box {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.close-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-amber-900);
  background-color: var(--color-amber-50);
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-amber-200);
}

.warn-icon {
  flex-shrink: 0;
  color: var(--color-amber-600);
}

.full-width {
  width: 100%;
}

.confirm-close-box {
  background-color: var(--color-danger-50);
  border: 1px solid var(--color-danger-200);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: center;
}

.confirm-msg {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-danger-900);
}

  .confirm-btns-row {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }

  .detail-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .detail-tabs::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .req-left {
    min-width: 0;
    flex: 1;
  }

  .req-title-row {
    flex-wrap: wrap;
  }

  @media (max-width: 560px) {
    .detail-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      overflow: visible;
    }

    .tab-btn {
      min-width: 0;
      justify-content: center;
      padding: 0.5rem 0.375rem;
      font-size: 0.75rem;
      white-space: normal;
      text-align: center;
      line-height: 1.2;
    }

    .banner-top,
    .customer-name-row,
    .banner-bottom,
    .order-header-line,
    .bill-amount-row,
    .request-item-card {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .banner-bottom {
      justify-content: flex-start;
    }

    .customer-name {
      font-size: 1.0625rem;
      overflow-wrap: anywhere;
    }

    .timing-box {
      width: 100%;
      justify-content: space-between;
    }

    .items-list-box {
      max-height: none;
    }

    .item-line {
      display: grid;
      grid-template-columns: 1.5rem minmax(0, 1fr) auto;
      align-items: baseline;
      column-gap: 0.5rem;
      row-gap: 0.125rem;
    }

    .item-qty {
      grid-column: 1;
      grid-row: 1;
    }

    .item-title {
      grid-column: 2;
      grid-row: 1;
      overflow-wrap: break-word;
    }

    .item-sub {
      grid-column: 2 / 4;
      grid-row: 2;
      margin-top: -0.125rem;
    }

    .item-tot {
      grid-column: 3;
      grid-row: 1;
      text-align: right;
      white-space: nowrap;
    }

    .order-footer-line {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .bill-val {
      font-size: 1.125rem;
    }

    .payment-buttons-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .req-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .confirm-btns-row {
      flex-direction: column-reverse;
    }

    .confirm-btns-row > * {
      width: 100%;
    }
  }
  </style>
