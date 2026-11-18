<script setup lang="ts">
import { computed } from 'vue'
import type { Order } from '@/types'
import OrderStatusTimeline from './OrderStatusTimeline.vue'
import { Volume2, VolumeX, Wifi, WifiOff } from 'lucide-vue-next'

/**
 * Área do pedido: estado de cada pedido da sessão, atualizado em tempo real
 * (sem refresh). Mostra os pedidos em curso; os entregues/cancelados ficam
 * no histórico ("Pedidos na Mesa").
 */
const props = defineProps<{
  orders: Order[]
  connected: boolean
  soundEnabled: boolean
}>()
const emit = defineEmits<{ (e: 'toggle-sound'): void; (e: 'open-history'): void }>()

const activeOrders = computed(() =>
  [...props.orders]
    .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
)
const finishedCount = computed(() => props.orders.length - activeOrders.value.length)
</script>

<template>
  <section v-if="orders.length" class="sot" aria-labelledby="sot-title">
    <header class="sot-head">
      <div>
        <h2 id="sot-title" class="sot-title">Os seus pedidos</h2>
        <p class="sot-live" :class="{ 'is-off': !connected }">
          <component :is="connected ? Wifi : WifiOff" :size="12" />
          {{ connected ? 'Atualizações em tempo real' : 'A ligar às atualizações…' }}
        </p>
      </div>
      <button
        type="button"
        class="sot-sound"
        :aria-pressed="soundEnabled"
        :aria-label="soundEnabled ? 'Desativar som das notificações' : 'Ativar som das notificações'"
        :title="soundEnabled ? 'Som ligado' : 'Som desligado'"
        @click="emit('toggle-sound')"
      >
        <component :is="soundEnabled ? Volume2 : VolumeX" :size="16" />
      </button>
    </header>

    <ul v-if="activeOrders.length" class="sot-list">
      <li v-for="order in activeOrders" :key="order.id" class="sot-order">
        <div class="sot-order-head">
          <strong>Pedido {{ order.orderCode }}</strong>
          <span class="sot-items">{{ order.items.reduce((n, i) => n + i.quantity, 0) }} itens</span>
        </div>
        <OrderStatusTimeline :status="order.status" />
      </li>
    </ul>
    <p v-else class="sot-empty">Todos os pedidos foram entregues ou concluídos.</p>

    <button v-if="finishedCount" type="button" class="sot-history" @click="emit('open-history')">
      Ver histórico ({{ finishedCount }} {{ finishedCount === 1 ? 'concluído' : 'concluídos' }})
    </button>
  </section>
</template>

<style scoped>
.sot {
  max-width: 1200px;
  margin: 0.75rem auto 0;
  padding: 0.9rem 1rem;
  background: #fff;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-xl, 16px);
  box-shadow: var(--shadow-sm);
}

.sot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.sot-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
}

.sot-live {
  margin: 0.15rem 0 0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #059669;
}

.sot-live.is-off {
  color: var(--text-muted, #64748b);
}

.sot-sound {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  background: #fff;
  color: var(--color-neutral-700, #334155);
  cursor: pointer;
}

.sot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sot-order {
  padding: 0.7rem 0.75rem 0.8rem;
  border: 1px solid var(--border-subtle, #f1f5f9);
  border-radius: var(--radius-lg, 12px);
  background: var(--color-neutral-50, #f8fafc);
}

.sot-order-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.6rem;
  font-size: 0.85rem;
}

.sot-items {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
}

.sot-empty {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
}

.sot-history {
  margin-top: 0.6rem;
  padding: 0.35rem 0;
  border: none;
  background: none;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-primary-700, #0d7a5f);
  cursor: pointer;
}
</style>
