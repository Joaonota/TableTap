<script setup lang="ts">
import { computed } from 'vue'
import type { Order, TableSession } from '@/types'
import AppModal from '@/components/ui/AppModal.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  UtensilsCrossed,
  Receipt,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChefHat
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  session: TableSession | null
  orders: Order[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'order-more'): void
  (e: 'request-bill'): void
}>()

const totalAccumulated = computed(() => {
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
      return { variant: 'success' as const, label: 'Pronto a Servir' }
    case 'delivered':
      return { variant: 'neutral' as const, label: 'Entregue' }
    case 'cancelled':
      return { variant: 'danger' as const, label: 'Cancelado' }
    default:
      return { variant: 'neutral' as const, label: status }
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    title="Pedidos na Sua Mesa"
    :subtitle="session ? `${session.participants.length > 1 ? `${session.participants.length} pessoas na mesa` : `Sessão de ${session.primaryCustomerName ?? 'Mesa'}`} • ${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}` : ''"
    max-width="560px"
    @close="emit('close')"
  >
    <div class="session-history-container">
      <!-- Session Summary Header -->
      <div class="history-summary-box">
        <div class="summary-left">
          <span class="summary-label">Total Acumulado na Mesa</span>
          <span class="summary-amount">{{ totalAccumulated.toLocaleString('pt-MZ') }} MT</span>
        </div>
        <div class="summary-right">
          <AppBadge :variant="session?.billRequestedAt ? 'warning' : 'success'">
            {{ session?.billRequestedAt ? 'Conta pedida' : 'Sessão ativa' }}
          </AppBadge>
        </div>
      </div>

      <!-- No Orders state -->
      <div v-if="orders.length === 0" class="empty-orders-view">
        <UtensilsCrossed :size="36" class="empty-icon" />
        <p class="empty-title">Ainda não enviou nenhum pedido nesta sessão.</p>
        <p class="empty-sub">Explore os pratos e bebidas no menu e adicione ao seu carrinho!</p>
      </div>

      <!-- Orders List -->
      <div v-else class="orders-timeline-list">
        <div
          v-for="(order, index) in orders"
          :key="order.id"
          class="order-history-card"
        >
          <div class="order-card-header">
            <div class="order-id-col">
              <span class="order-number-tag">
                {{ order.isAdditional ? 'Pedido Adicional' : '1º Pedido' }} • {{ order.orderCode }}
              </span>
              <span class="order-time">
                <Clock :size="12" class="inline-clock" />
                {{ new Date(order.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
            </div>

            <AppBadge :variant="getStatusBadge(order.status).variant">
              {{ getStatusBadge(order.status).label }}
            </AppBadge>
          </div>

          <!-- Items list -->
          <div class="order-items-mini-list">
            <div
              v-for="item in order.items"
              :key="item.id"
              class="mini-item-row"
            >
              <span class="item-qty">{{ item.quantity }}x</span>
              <div class="item-desc">
                <span class="item-name">{{ item.productName }}</span>
                <span v-if="item.selectedVariant" class="item-variant">({{ item.selectedVariant.name }})</span>
                <span v-if="item.selectedAddons && item.selectedAddons.length > 0" class="item-addons">
                  + {{ item.selectedAddons.map(a => a.name).join(', ') }}
                </span>
              </div>
              <span class="item-price">{{ item.totalPrice.toLocaleString('pt-MZ') }} MT</span>
            </div>
          </div>

          <!-- Order Subtotal Footer -->
          <div class="order-card-footer">
            <span class="sub-label">Subtotal do pedido:</span>
            <span class="sub-val">{{ order.total.toLocaleString('pt-MZ') }} MT</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" size="md" @click="emit('close')">
        Fechar
      </AppButton>
      <AppButton
        v-if="session?.status === 'active'"
        variant="primary"
        size="md"
        @click="emit('order-more')"
      >
        <template #icon-left>
          <Plus :size="16" />
        </template>
        Pedir Mais Alguma Coisa
      </AppButton>
      <AppButton
        v-if="!session?.billRequestedAt && session?.status === 'active' && orders.length > 0"
        variant="outline"
        size="md"
        @click="emit('request-bill')"
      >
        <template #icon-left>
          <Receipt :size="16" />
        </template>
        Pedir a Conta
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.session-history-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.history-summary-box {
  background: linear-gradient(135deg, var(--color-primary-900) 0%, var(--color-primary-800) 100%);
  color: #ffffff;
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-md);
}

.summary-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #93c5fd;
  font-weight: 600;
}

.summary-amount {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: #ffffff;
}

.empty-orders-view {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--text-muted);
}

.empty-icon {
  margin: 0 auto 0.75rem auto;
  opacity: 0.4;
}

.empty-title {
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 0.25rem;
}

.empty-sub {
  font-size: 0.8125rem;
}

.orders-timeline-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.order-history-card {
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color var(--transition-fast);
}

.order-history-card:hover {
  border-color: var(--color-primary-300);
}

.order-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.order-id-col {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.order-number-tag {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--text-main);
}

.order-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.inline-clock {
  display: inline;
  vertical-align: middle;
}

.order-items-mini-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.mini-item-row {
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

.item-desc {
  flex: 1;
  color: var(--text-main);
}

.item-name {
  font-weight: 600;
}

.item-variant,
.item-addons {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: 0.25rem;
}

.item-price {
  font-weight: 700;
  color: var(--text-main);
}

.order-card-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-color);
  font-size: 0.8125rem;
}

.sub-label {
  color: var(--text-muted);
}

.sub-val {
  font-weight: 800;
  color: var(--text-main);
}

@media (max-width: 480px) {
  .history-summary-box {
    padding: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .order-card-header {
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .order-card-footer {
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .item-name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .item-price {
    margin-left: auto;
    white-space: nowrap;
  }
}
</style>
