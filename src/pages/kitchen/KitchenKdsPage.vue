<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useOrderStore } from '@/stores/order'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import type { Order, OrderStatus } from '@/types'
import {
  ChefHat,
  Wine,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  Play,
  AlertTriangle
} from 'lucide-vue-next'

const orderStore = useOrderStore()
const authStore = useAuthStore()
const toastStore = useToastStore()

const stationFilter = ref<'all' | 'kitchen' | 'bar'>('all')

const now = ref(Date.now())
let interval: number

onMounted(async () => {
  await orderStore.loadOrders()
  interval = window.setInterval(() => {
    now.value = Date.now()
  }, 10000)
})

onUnmounted(() => {
  clearInterval(interval)
})

const getElapsedTimeMinutes = (createdAt: string) => {
  const diffMs = now.value - new Date(createdAt).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60)))
}

const activeKdsOrders = computed(() => {
  return orderStore.kdsOrders.filter(order => {
    if (stationFilter.value === 'all') return true
    // Filter by items inside order belonging to that station
    return order.items.some(i => i.station === stationFilter.value)
  })
})

const handleAdvanceStatus = async (order: Order) => {
  const userName = authStore.currentUser?.name || 'Equipa de Cozinha'
  if (order.status === 'received' || order.status === 'confirmed') {
    await orderStore.updateOrderStatus(order.id, 'preparing', userName, 'Início de preparação no KDS')
  } else if (order.status === 'preparing') {
    await orderStore.updateOrderStatus(order.id, 'ready', userName, 'Prato pronto a servir')
  }
}
</script>

<template>
  <div class="kds-container">
    <!-- Filter bar -->
    <div class="kds-toolbar">
      <div class="station-filters">
        <button
          type="button"
          class="station-btn"
          :class="{ 'is-active': stationFilter === 'all' }"
          @click="stationFilter = 'all'"
        >
          <UtensilsCrossed :size="18" />
          <span>Todas as Estações ({{ orderStore.kdsOrders.length }})</span>
        </button>

        <button
          type="button"
          class="station-btn"
          :class="{ 'is-active': stationFilter === 'kitchen' }"
          @click="stationFilter = 'kitchen'"
        >
          <ChefHat :size="18" />
          <span>Apenas Cozinha</span>
        </button>

        <button
          type="button"
          class="station-btn"
          :class="{ 'is-active': stationFilter === 'bar' }"
          @click="stationFilter = 'bar'"
        >
          <Wine :size="18" />
          <span>Apenas Bar / Bebidas</span>
        </button>
      </div>

      <div class="kds-legend">
        <span class="legend-dot normal"></span> Normal (&lt;15m)
        <span class="legend-dot warning"></span> Atenção (15-25m)
        <span class="legend-dot urgent"></span> Urgente (&gt;25m)
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="activeKdsOrders.length === 0" class="empty-kds">
      <CheckCircle2 :size="56" class="text-success" />
      <h2>Sem Pedidos Pendentes</h2>
      <p>Todos os pratos e bebidas da estação foram confecionados e despachados com sucesso.</p>
    </div>

    <!-- KDS Order Cards Grid -->
    <div v-else class="kds-grid">
      <div
        v-for="order in activeKdsOrders"
        :key="order.id"
        class="kds-ticket"
        :class="{
          'is-urgent': getElapsedTimeMinutes(order.createdAt) >= 25,
          'is-warning': getElapsedTimeMinutes(order.createdAt) >= 15 && getElapsedTimeMinutes(order.createdAt) < 25,
          'is-ready': order.status === 'ready'
        }"
      >
        <div class="ticket-header">
          <div class="ticket-top">
            <span class="ticket-table">MESA {{ order.tableNumber || 'BALCÃO' }}</span>
            <span class="ticket-code">{{ order.orderCode }}</span>
          </div>

          <div class="ticket-timer-row">
            <div class="ticket-timer">
              <Clock :size="16" />
              <span>Há {{ getElapsedTimeMinutes(order.createdAt) }} min</span>
            </div>
            <span class="ticket-status-badge">{{ order.status.toUpperCase() }}</span>
          </div>
        </div>

        <div class="ticket-body">
          <div
            v-for="item in (stationFilter === 'all' ? order.items : order.items.filter(i => i.station === stationFilter))"
            :key="item.id"
            class="ticket-item"
          >
            <div class="item-qty-badge">{{ item.quantity }}x</div>
            <div class="item-info">
              <div class="item-name">{{ item.productName }}</div>
              <div v-if="item.selectedVariant" class="item-note">
                Variante: {{ item.selectedVariant.name }}
              </div>
              <div v-if="item.selectedAddons && item.selectedAddons.length > 0" class="item-note">
                Extras: {{ item.selectedAddons.map(a => a.name).join(', ') }}
              </div>
              <div v-if="item.removedIngredients && item.removedIngredients.length > 0" class="item-alert">
                SEM: {{ item.removedIngredients.join(', ') }}
              </div>
              <div v-if="item.notes" class="item-special-note">
                "{{ item.notes }}"
              </div>
            </div>
          </div>
        </div>

        <div class="ticket-footer">
          <button
            type="button"
            class="kds-action-btn"
            :class="order.status === 'ready' ? 'btn-ready' : order.status === 'preparing' ? 'btn-preparing' : 'btn-start'"
            @click="handleAdvanceStatus(order)"
          >
            <template v-if="order.status === 'received' || order.status === 'confirmed'">
              <Play :size="18" />
              <span>Iniciar Preparo</span>
            </template>
            <template v-else-if="order.status === 'preparing'">
              <CheckCircle2 :size="18" />
              <span>Marcar como Pronto</span>
            </template>
            <template v-else>
              <CheckCircle2 :size="18" />
              <span>Pronto (Aguardar Entrega)</span>
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kds-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.kds-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: var(--radius-lg);
  padding: 0.75rem 1.25rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.station-filters {
  display: flex;
  gap: 0.5rem;
}

.station-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.station-btn:hover {
  background: #334155;
  color: #ffffff;
}

.station-btn.is-active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.4);
}

.kds-legend {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.legend-dot.normal { background: #10b981; }
.legend-dot.warning { background: #f59e0b; }
.legend-dot.urgent { background: #ef4444; }

/* Grid */
.kds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

.kds-ticket {
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: var(--radius-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.kds-ticket.is-warning {
  border-color: #f59e0b;
}

.kds-ticket.is-urgent {
  border-color: #ef4444;
  animation: pulse-border 2s infinite ease-in-out;
}

@keyframes pulse-border {
  0%, 100% { border-color: #ef4444; }
  50% { border-color: #f87171; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); }
}

.kds-ticket.is-ready {
  border-color: #10b981;
}

.ticket-header {
  background: #0f172a;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #334155;
}

.ticket-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.ticket-table {
  font-size: 1.25rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: #ffffff;
  letter-spacing: -0.02em;
}

.ticket-code {
  font-family: monospace;
  font-size: 0.875rem;
  font-weight: 700;
  color: #38bdf8;
}

.ticket-timer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-timer {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #94a3b8;
}

.is-warning .ticket-timer { color: #f59e0b; }
.is-urgent .ticket-timer { color: #f87171; }

.ticket-status-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
  background: #334155;
  color: #f8fafc;
}

.ticket-body {
  padding: 1.25rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ticket-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.item-qty-badge {
  background: #38bdf8;
  color: #0f172a;
  font-size: 1.125rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-md);
  line-height: 1;
}

.item-info {
  flex: 1;
}

.item-name {
  font-size: 1.0625rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
}

.item-note {
  font-size: 0.8125rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.item-alert {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #f87171;
  margin-top: 0.2rem;
}

.item-special-note {
  font-size: 0.8125rem;
  font-style: italic;
  color: #fef08a;
  margin-top: 0.25rem;
}

.ticket-footer {
  padding: 1rem 1.25rem;
  background: #0f172a;
  border-top: 1px solid #334155;
}

.kds-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem;
  border-radius: var(--radius-lg);
  font-size: 1rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-start {
  background: #2563eb;
  color: #ffffff;
}
.btn-start:hover {
  background: #1d4ed8;
}

.btn-preparing {
  background: #10b981;
  color: #ffffff;
}
.btn-preparing:hover {
  background: #059669;
}

.btn-ready {
  background: #334155;
  color: #94a3b8;
  cursor: default;
}

.empty-kds {
  text-align: center;
  padding: 6rem 1.5rem;
  background: #111827;
  border: 1px dashed #1f2937;
  border-radius: var(--radius-xl);
  max-width: 600px;
  margin: 3rem auto;
}

.empty-kds h2 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffffff;
  margin: 1rem 0 0.5rem;
}

.empty-kds p {
  font-size: 0.9375rem;
  color: #9ca3af;
}
</style>
