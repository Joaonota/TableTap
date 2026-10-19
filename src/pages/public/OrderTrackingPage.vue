<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderService } from '@/services'
import type { Order, OrderStatus } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  CheckCircle2,
  Clock,
  ChefHat,
  PackageCheck,
  UtensilsCrossed,
  ArrowLeft,
  BellRing,
  RefreshCw
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const orderId = computed(() => route.params.orderId as string)

const order = ref<Order | null>(null)
const isLoading = ref(true)

const steps: { status: OrderStatus; label: string }[] = [
  { status: 'received', label: 'Recebido' },
  { status: 'confirmed', label: 'Confirmado' },
  { status: 'preparing', label: 'Em Preparação' },
  { status: 'ready', label: 'Pronto a Servir' },
  { status: 'delivered', label: 'Entregue na Mesa' }
]

const loadOrder = async () => {
  isLoading.value = true
  try {
    const found = await orderService.getOrderById(orderId.value)
    order.value = found || null
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadOrder()
})

const currentStepIndex = computed(() => {
  if (!order.value) return 0
  if (order.value.status === 'cancelled') return -1
  return steps.findIndex(s => s.status === order.value?.status)
})
</script>

<template>
  <div class="tracking-page container">
    <div v-if="isLoading" class="loading-state">
      <RefreshCw :size="30" class="spin-icon" />
      <p>A procurar informações do pedido...</p>
    </div>

    <div v-else-if="!order" class="not-found-state">
      <UtensilsCrossed :size="48" class="text-muted" />
      <h2>Pedido Não Encontrado</h2>
      <p>Não foi possível localizar o pedido especificado na base de dados.</p>
      <router-link to="/">
        <AppButton variant="primary">Voltar ao Início</AppButton>
      </router-link>
    </div>

    <div v-else class="tracking-card">
      <div class="tracking-header">
        <button class="back-link-btn" @click="router.back()">
          <ArrowLeft :size="18" />
          <span>Voltar ao Menu</span>
        </button>

        <div class="order-code-badge">
          <span>{{ order.orderCode }}</span>
        </div>
      </div>

      <div class="order-hero-banner">
        <div class="hero-status-icon">
          <ChefHat v-if="order.status === 'preparing'" :size="32" />
          <CheckCircle2 v-else-if="order.status === 'delivered' || order.status === 'ready'" :size="32" />
          <Clock v-else :size="32" />
        </div>

        <div class="hero-status-text">
          <h1 class="hero-status-title">
            {{
              order.status === 'received' ? 'Pedido Recebido pelo Restaurante' :
              order.status === 'confirmed' ? 'Pedido Confirmado' :
              order.status === 'preparing' ? 'A Ser Preparado na Cozinha' :
              order.status === 'ready' ? 'Pedido Pronto! A Caminho da Mesa' :
              order.status === 'delivered' ? 'Pedido Entregue na Mesa' : 'Pedido Cancelado'
            }}
          </h1>
          <p class="hero-status-desc">
            Mesa {{ order.tableNumber || 'Balcão' }} • Estimativa de entrega rápida
          </p>
        </div>
      </div>

      <!-- Stepper Visualizer -->
      <div v-if="order.status !== 'cancelled'" class="stepper-box">
        <div
          v-for="(step, idx) in steps"
          :key="step.status"
          class="step-node"
          :class="{
            'is-done': idx <= currentStepIndex,
            'is-active': idx === currentStepIndex
          }"
        >
          <div class="node-circle">
            <CheckCircle2 v-if="idx < currentStepIndex" :size="16" />
            <span v-else>{{ idx + 1 }}</span>
          </div>
          <span class="node-label">{{ step.label }}</span>
        </div>
      </div>

      <!-- Order Items Summary -->
      <div class="order-details-box">
        <h3 class="details-heading">Itens Solicitados</h3>

        <div class="items-summary-list">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="summary-item"
          >
            <div class="item-left">
              <span class="item-quantity">{{ item.quantity }}x</span>
              <div>
                <div class="item-name">{{ item.productName }}</div>
                <div v-if="item.selectedVariant" class="item-variant">{{ item.selectedVariant.name }}</div>
                <div v-if="item.selectedAddons && item.selectedAddons.length > 0" class="item-addons">
                  + {{ item.selectedAddons.map(a => a.name).join(', ') }}
                </div>
              </div>
            </div>
            <div class="item-price">{{ item.totalPrice.toLocaleString('pt-MZ') }} MT</div>
          </div>
        </div>

        <div class="details-divider"></div>

        <div class="total-row">
          <span>Total Geral do Pedido:</span>
          <strong>{{ order.total.toLocaleString('pt-MZ') }} MT</strong>
        </div>

        <div class="payment-status-badge">
          <span>Estado do Pagamento:</span>
          <AppBadge :variant="order.paymentStatus === 'paid' ? 'success' : 'warning'">
            {{ order.paymentStatus.toUpperCase() }}
          </AppBadge>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="tracking-footer">
        <AppButton variant="secondary" @click="loadOrder">
          <template #icon-left>
            <RefreshCw :size="16" />
          </template>
          Atualizar Estado
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tracking-page {
  padding: 2.5rem 1rem 5rem;
  max-width: 650px;
}

.tracking-card {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 2rem;
  box-shadow: var(--shadow-md);
}

.tracking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.back-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  cursor: pointer;
}

.back-link-btn:hover {
  color: var(--color-primary-800);
}

.order-code-badge {
  background: var(--color-neutral-100);
  border: 1px solid var(--border-medium);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  font-family: monospace;
  font-weight: 700;
  font-size: 0.8125rem;
  color: var(--color-neutral-800);
}

.order-hero-banner {
  background: linear-gradient(135deg, var(--color-primary-900) 0%, var(--color-primary-800) 100%);
  color: #ffffff;
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.hero-status-icon {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #38bdf8;
}

.hero-status-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
}

.hero-status-desc {
  font-size: 0.8125rem;
  color: #bfdbfe;
  margin-top: 0.25rem;
}

/* Stepper */
.stepper-box {
  display: flex;
  justify-content: space-between;
  position: relative;
  margin-bottom: 2.5rem;
  padding: 0 0.5rem;
}

.stepper-box::before {
  content: '';
  position: absolute;
  top: 14px;
  left: 2rem;
  right: 2rem;
  height: 2px;
  background-color: var(--border-medium);
  z-index: 1;
}

.step-node {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.node-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid var(--border-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-500);
  transition: all var(--transition-fast);
}

.step-node.is-done .node-circle {
  background: var(--color-success-600);
  border-color: var(--color-success-600);
  color: #ffffff;
}

.step-node.is-active .node-circle {
  background: var(--color-primary-800);
  border-color: var(--color-primary-800);
  color: #ffffff;
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.node-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-neutral-600);
  text-align: center;
  max-width: 60px;
}

.step-node.is-active .node-label {
  color: var(--color-primary-800);
  font-weight: 700;
}

/* Details */
.order-details-box {
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.details-heading {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  margin-bottom: 1rem;
}

.items-summary-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 0.875rem;
}

.item-left {
  display: flex;
  gap: 0.75rem;
}

.item-quantity {
  font-weight: 700;
  color: var(--color-primary-800);
}

.item-name {
  font-weight: 600;
}

.item-variant, .item-addons {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.item-price {
  font-weight: 600;
}

.details-divider {
  height: 1px;
  background-color: var(--border-subtle);
  margin: 1.25rem 0;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
}

.total-row strong {
  font-size: 1.25rem;
  font-family: var(--font-heading);
  color: var(--color-neutral-900);
}

.payment-status-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-subtle);
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.tracking-footer {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
}

.loading-state, .not-found-state {
  text-align: center;
  padding: 4rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

@media (max-width: 600px) {
  .node-label {
    display: none;
  }
}
</style>
