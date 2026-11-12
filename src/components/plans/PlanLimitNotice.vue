<script setup lang="ts">
import { computed } from 'vue'
import type { LimitEvaluation } from '@/domain/planLimits'
import { formatUsage, limitReachedMessage } from '@/domain/planLimits'
import { Lock, Gauge } from 'lucide-vue-next'

/**
 * Consumo de um limite do plano junto à lista de recursos.
 *  - abaixo de 80%: linha discreta com o consumo;
 *  - 80% ou mais: aviso de aproximação;
 *  - atingido: mensagem clara de que não é possível criar mais.
 */
const props = defineProps<{ evaluation: LimitEvaluation | null }>()

const level = computed(() => {
  const ev = props.evaluation
  if (!ev || ev.unlimited) return 'ok'
  if (ev.reached) return 'reached'
  return ev.percentage >= 80 ? 'near' : 'ok'
})
</script>

<template>
  <div v-if="evaluation" class="plan-limit" :class="`is-${level}`" :role="level === 'reached' ? 'alert' : undefined">
    <component :is="level === 'reached' ? Lock : Gauge" :size="16" class="icon" />
    <div class="text">
      <p v-if="level === 'reached'" class="title">{{ limitReachedMessage(evaluation) }}</p>
      <p v-else class="usage">
        Plano <strong>{{ evaluation.planName }}</strong>:
        <template v-if="evaluation.unlimited">{{ evaluation.current }} {{ evaluation.unit }}{{ evaluation.scope === 'restaurant' ? ' neste restaurante' : '' }} · sem limite</template>
        <template v-else>{{ formatUsage(evaluation) }}{{ evaluation.scope === 'restaurant' ? ' neste restaurante' : '' }}</template>
        <template v-if="level === 'near'"> — restam {{ evaluation.remaining }}.</template>
      </p>
    </div>
    <router-link v-if="level !== 'ok'" to="/app/meu-plano" class="link">Ver o meu plano</router-link>
    <div v-if="!evaluation.unlimited" class="bar" aria-hidden="true">
      <span :style="{ width: `${evaluation.percentage}%` }"></span>
    </div>
  </div>
</template>

<style scoped>
.plan-limit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.6rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: #fff;
  font-size: 0.8125rem;
}

.icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.text {
  flex: 1 1 240px;
  min-width: 0;
}

.text p {
  margin: 0;
}

.usage {
  color: var(--text-muted);
}

.usage strong {
  color: var(--text-main);
}

.title {
  font-weight: 600;
  line-height: 1.45;
}

.link {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-primary-700);
  white-space: nowrap;
}

.bar {
  flex-basis: 100%;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-neutral-100);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  background: var(--color-primary-500);
}

.is-near {
  border-color: var(--color-amber-200);
  background: var(--color-amber-50);
}

.is-near .icon {
  color: var(--color-amber-800);
}

.is-near .bar span {
  background: var(--color-amber-600);
}

.is-reached {
  border-color: var(--color-danger-200);
  background: var(--color-danger-50);
  color: var(--color-danger-900);
}

.is-reached .icon {
  color: var(--color-danger-600);
}

.is-reached .bar span {
  background: var(--color-danger-500);
}
</style>
