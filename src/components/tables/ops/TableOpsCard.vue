<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  TABLE_STATE,
  pendingOrders,
  primaryOf,
  sessionDuration,
  supportsOf,
  tableAlerts,
  tableLabel,
  tableState,
  type TableOperation
} from '@/domain/tableOperations'
import { AlertTriangle, ArrowLeftRight, BellRing, Clock, Users } from 'lucide-vue-next'

const props = defineProps<{ table: TableOperation; now: Date; canTransfer: boolean; mine?: boolean }>()
defineEmits<{ (e: 'open'): void; (e: 'transfer'): void }>()

const state = computed(() => tableState(props.table, props.now))
const meta = computed(() => TABLE_STATE[state.value])
const primary = computed(() => primaryOf(props.table))
const supports = computed(() => supportsOf(props.table))
const alerts = computed(() => tableAlerts(props.table, props.now))
const openRequests = computed(() => props.table.requests.length)
const mt = (v: number) => `${Math.round(v).toLocaleString('pt-MZ')} MT`
</script>

<template>
  <article class="op-card" :class="[`tone-${meta.tone}`, { mine }]">
    <header class="op-head">
      <h3>{{ tableLabel(table) }}</h3>
      <AppBadge :variant="meta.tone" dot>{{ meta.label }}</AppBadge>
    </header>

    <dl class="staff">
      <div>
        <dt>Principal</dt>
        <dd :class="{ empty: !primary }">
          <template v-if="primary">
            <span class="duty" :class="primary.dutyStatus" aria-hidden="true"></span>{{ primary.staffName }}
          </template>
          <template v-else>—</template>
        </dd>
      </div>
      <div>
        <dt>Apoio</dt>
        <dd :class="{ empty: !supports.length }">{{ supports.map(s => s.staffName).join(', ') || '—' }}</dd>
      </div>
    </dl>

    <div v-if="table.session" class="session">
      <span v-if="table.session.participants > 1 || table.session.customerName" class="chip">
        <Users :size="13" />
        {{ table.session.participants > 1 ? `${table.session.participants} pessoas` : table.session.customerName }}
      </span>
      <span class="chip"><Clock :size="13" /> {{ sessionDuration(table.session.startedAt, now) }}</span>
      <span class="chip">{{ table.orders.count }} {{ table.orders.count === 1 ? 'pedido' : 'pedidos' }}</span>
      <span v-if="pendingOrders(table)" class="chip warn">{{ pendingOrders(table) }} por entregar</span>
      <span v-if="openRequests" class="chip danger"><BellRing :size="13" /> {{ openRequests }}</span>
    </div>
    <p v-if="table.session" class="total">Total: <strong>{{ mt(table.orders.total) }}</strong></p>

    <ul v-if="alerts.length" class="alerts">
      <li v-for="a in alerts" :key="a.kind + a.text" :class="a.severity">
        <AlertTriangle :size="13" /> {{ a.text }}
      </li>
    </ul>

    <footer class="op-actions">
      <AppButton size="sm" variant="outline" @click="$emit('open')">Ver mesa</AppButton>
      <AppButton v-if="canTransfer && table.assignments.length" size="sm" variant="ghost" @click="$emit('transfer')">
        <ArrowLeftRight :size="14" /> Transferir
      </AppButton>
    </footer>
  </article>
</template>

<style scoped>
.op-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-top: 4px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
}
.op-card.tone-success {
  border-top-color: var(--color-success-500);
}
.op-card.tone-primary {
  border-top-color: var(--color-primary-600);
}
.op-card.tone-warning {
  border-top-color: var(--color-amber-600);
}
.op-card.tone-danger {
  border-top-color: var(--color-danger-500);
  box-shadow: 0 0 0 1px var(--color-danger-200), var(--shadow-sm);
}
.op-card.mine {
  background: linear-gradient(180deg, var(--color-primary-50), var(--bg-surface) 40%);
}
.op-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.op-head h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-main);
}
.staff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin: 0;
}
.staff dt {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-subtle);
}
.staff dd {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-main);
  overflow-wrap: anywhere;
}
.staff dd.empty {
  color: var(--text-subtle);
  font-weight: 500;
}
.duty {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 0.35rem;
  border-radius: 999px;
  background: var(--color-neutral-400);
  vertical-align: middle;
}
.duty.on_duty {
  background: var(--color-success-500);
}
.duty.on_break {
  background: var(--color-amber-600);
}
.duty.absent {
  background: var(--color-danger-500);
}
.session {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
  font-size: 0.75rem;
  font-weight: 600;
}
.chip.warn {
  background: var(--color-amber-50);
  color: var(--color-amber-800);
}
.chip.danger {
  background: var(--color-danger-50);
  color: var(--color-danger-700);
}
.total {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}
.total strong {
  color: var(--text-main);
}
.alerts {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.alerts li {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-amber-800);
}
.alerts li.high {
  color: var(--color-danger-700);
}
.op-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: auto;
}
</style>
