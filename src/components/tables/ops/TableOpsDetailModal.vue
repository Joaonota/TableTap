<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import RequestActions from './RequestActions.vue'
import { tableOperationsService } from '@/services'
import { errorMessage } from '@/domain/errors'
import {
  DUTY_LABELS,
  ROLE_TEXT,
  TABLE_STATE,
  eventText,
  sessionDuration,
  tableLabel,
  tableState,
  type AssignmentEvent,
  type OpsMe,
  type OpsStaff,
  type ServiceAction,
  type TableOperation
} from '@/domain/tableOperations'
import { ArrowLeftRight, History, X } from 'lucide-vue-next'

const props = defineProps<{
  table: TableOperation | null
  me: OpsMe | null
  staff: OpsStaff[]
  now: Date
  busy?: boolean
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'transfer'): void
  (e: 'remove', assignmentId: string): void
  (e: 'request', requestId: string, action: ServiceAction, onBehalfOf?: string): void
}>()

const history = ref<AssignmentEvent[]>([])
const historyError = ref('')
const loadingHistory = ref(false)

const loadHistory = async () => {
  if (!props.table) return
  loadingHistory.value = true
  historyError.value = ''
  try {
    history.value = await tableOperationsService.getHistory(props.table.id)
  } catch (e) {
    historyError.value = errorMessage(e)
  } finally {
    loadingHistory.value = false
  }
}
watch(
  () => [props.table?.id, props.table?.assignments.map(a => a.id).join()],
  () => void loadHistory(),
  { immediate: true }
)

const state = computed(() => (props.table ? TABLE_STATE[tableState(props.table, props.now)] : null))
const label = computed(() => (props.table ? tableLabel(props.table) : ''))
const canTransfer = computed(
  () => !!props.table?.assignments.length && (props.me?.canManage || props.table.assignments.some(a => a.staffId === props.me?.staffId))
)
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' })
const mt = (v: number) => `${Math.round(v).toLocaleString('pt-MZ')} MT`
</script>

<template>
  <AppModal :is-open="!!table" :title="label" max-width="620px" @close="emit('close')">
    <div v-if="table" class="detail">
      <div class="top">
        <AppBadge v-if="state" :variant="state.tone" dot>{{ state.label }}</AppBadge>
        <span class="muted">{{ table.area }} · {{ table.capacity }} lugares</span>
      </div>

      <section>
        <h4>Responsáveis</h4>
        <p v-if="!table.assignments.length" class="muted">Sem garçom atribuído.</p>
        <ul class="people">
          <li v-for="a in table.assignments" :key="a.id">
            <div>
              <strong>{{ a.staffName }}</strong>
              <span class="muted">
                {{ ROLE_TEXT[a.role] }} · {{ DUTY_LABELS[a.dutyStatus] }}
                <template v-if="!a.hasAccount"> · sem conta</template>
                <template v-if="a.expiresAt"> · até {{ time(a.expiresAt) }}</template>
              </span>
            </div>
            <button v-if="me?.canManage" type="button" class="icon-btn" title="Remover" @click="emit('remove', a.id)">
              <X :size="16" />
            </button>
          </li>
        </ul>
        <AppButton v-if="canTransfer" size="sm" variant="outline" @click="emit('transfer')">
          <ArrowLeftRight :size="14" /> Transferir
        </AppButton>
      </section>

      <section v-if="table.session">
        <h4>Sessão</h4>
        <dl class="facts">
          <div><dt>Cliente</dt><dd>{{ table.session.customerName || '—' }}</dd></div>
          <div><dt>Participantes</dt><dd>{{ table.session.participants }}</dd></div>
          <div><dt>Tempo</dt><dd>{{ sessionDuration(table.session.startedAt, now) }}</dd></div>
          <div><dt>Pedidos</dt><dd>{{ table.orders.count }}</dd></div>
          <div><dt>Em preparação</dt><dd>{{ table.orders.preparing + table.orders.confirmed }}</dd></div>
          <div><dt>Prontos</dt><dd>{{ table.orders.ready }}</dd></div>
          <div><dt>Por pagar</dt><dd>{{ table.orders.unpaid }}</dd></div>
          <div><dt>Total</dt><dd class="strong">{{ mt(table.orders.total) }}</dd></div>
        </dl>
      </section>

      <section v-if="table.requests.length">
        <h4>Chamadas em aberto</h4>
        <div class="reqs">
          <RequestActions
            v-for="r in table.requests"
            :key="r.id"
            :request="r"
            :me="me"
            :staff="staff"
            :now="now"
            :busy="busy"
            @action="(a, who) => emit('request', r.id, a, who)"
          />
        </div>
      </section>

      <section>
        <h4><History :size="15" /> Histórico</h4>
        <p v-if="loadingHistory && !history.length" class="muted">A carregar…</p>
        <p v-else-if="historyError" class="muted">{{ historyError }}</p>
        <p v-else-if="!history.length" class="muted">Ainda sem registos.</p>
        <ol v-else class="timeline">
          <li v-for="e in history" :key="e.id">
            <time :title="day(e.createdAt)">{{ time(e.createdAt) }}</time>
            <div>
              <span>{{ eventText(e, `Mesa ${table.number}`) }}</span>
              <small v-if="e.reason || e.actorName" class="muted">
                {{ e.reason }}<template v-if="e.reason && e.actorName"> · </template>
                <template v-if="e.actorName">por {{ e.actorName }}</template>
              </small>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </AppModal>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
h4 {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-subtle);
}
.muted {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.people {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.people li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.people li div {
  display: flex;
  flex-direction: column;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
  margin: 0;
}
.facts dt {
  font-size: 0.7rem;
  color: var(--text-subtle);
}
.facts dd {
  margin: 0;
  font-weight: 700;
}
.facts dd.strong {
  color: var(--color-primary-700);
}
.reqs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.timeline li {
  display: flex;
  gap: 0.75rem;
  font-size: 0.85rem;
}
.timeline time {
  flex-shrink: 0;
  width: 3rem;
  font-weight: 800;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
}
.timeline li div {
  display: flex;
  flex-direction: column;
}
</style>
