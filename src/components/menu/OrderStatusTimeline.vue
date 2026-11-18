<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '@/types'
import { orderProgressSteps } from '@/domain/customerNotifications'
import { Check, XCircle } from 'lucide-vue-next'

/** Linha do tempo do pedido: Recebido → Em preparação → Pronto → Entregue. */
const props = defineProps<{ status: OrderStatus }>()

const steps = computed(() => orderProgressSteps(props.status))
const isCancelled = computed(() => props.status === 'cancelled')
</script>

<template>
  <div v-if="isCancelled" class="ost-cancelled">
    <XCircle :size="15" />
    <span>Pedido cancelado</span>
  </div>
  <ol v-else class="ost" :aria-label="`Estado do pedido: ${steps.find(s => s.state === 'current')?.label ?? 'Entregue'}`">
    <li v-for="step in steps" :key="step.key" class="ost-step" :class="`is-${step.state}`">
      <span class="ost-dot" aria-hidden="true">
        <Check v-if="step.state === 'done'" :size="11" />
      </span>
      <span class="ost-label">{{ step.label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.ost {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
}

.ost-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  text-align: center;
}

/* Ligação entre passos */
.ost-step + .ost-step::before {
  content: '';
  position: absolute;
  top: 9px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--border-color, #e2e8f0);
  z-index: 0;
}

.ost-step.is-done + .ost-step::before,
.ost-step.is-done + .ost-step.is-current::before {
  background: #059669;
}

.ost-dot {
  position: relative;
  z-index: 1;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 2px solid var(--border-color, #cbd5e1);
  color: #fff;
  transition: background 0.25s ease, border-color 0.25s ease;
}

.is-done .ost-dot {
  background: #059669;
  border-color: #059669;
}

.is-current .ost-dot {
  border-color: #d97706;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(217, 119, 6, 0.15);
}

.is-current .ost-dot::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d97706;
  animation: ost-pulse 1.6s ease-in-out infinite;
}

.ost-label {
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-muted, #64748b);
}

.is-done .ost-label {
  color: #047857;
}

.is-current .ost-label {
  color: var(--color-neutral-900, #0f172a);
  font-weight: 800;
}

.ost-cancelled {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #dc2626;
}

@keyframes ost-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-current .ost-dot::after {
    animation: none;
  }
}
</style>
