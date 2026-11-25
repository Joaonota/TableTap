<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantStore } from '@/stores/tenant'
import { useTableOperationsStore } from '@/stores/tableOperations'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TableOpsCard from '@/components/tables/ops/TableOpsCard.vue'
import RequestActions from '@/components/tables/ops/RequestActions.vue'
import TransferModal from '@/components/tables/ops/TransferModal.vue'
import TableOpsDetailModal from '@/components/tables/ops/TableOpsDetailModal.vue'
import AssignmentPanel from '@/components/tables/ops/AssignmentPanel.vue'
import {
  DUTY_LABELS,
  primaryOf,
  tableLabel,
  tableState,
  type AssignmentRole,
  type DutyStatus,
  type OpsStaff,
  type ServiceAction,
  type TableOperation
} from '@/domain/tableOperations'
import { ArrowLeftRight, BellRing, LayoutGrid, RefreshCw, UserCog } from 'lucide-vue-next'

/**
 * Sala: mesas, responsáveis e chamadas em tempo real.
 * Pensado para um tablet/computador partilhado (garçons sem smartphone):
 * o nome do responsável aparece em cada mesa e em cada chamada, e o gerente
 * ou o caixa regista as ações em nome de quem não tem conta.
 * O garçom com conta vê só as suas mesas (decidido no servidor).
 */
const tenantStore = useTenantStore()
const ops = useTableOperationsStore()

const route = useRoute()
// /app/sala?tab=atribuicao abre logo a atribuição (link em Gestão de Mesas).
const tab = ref<'panel' | 'assign'>(route.query.tab === 'atribuicao' ? 'assign' : 'panel')
const filter = ref<'all' | 'mine' | 'attention' | 'occupied' | 'free'>('all')
const staffFilter = ref('')
const busy = ref(false)

// Relógio para tempos de espera (alinhado com o servidor).
const now = ref(new Date())
let tick: ReturnType<typeof setInterval> | undefined
let stopRealtime: () => void = () => {}

const start = async () => {
  stopRealtime()
  await ops.load()
  stopRealtime = ops.subscribeRealtime()
}
onMounted(() => {
  void start()
  tick = setInterval(() => {
    now.value = new Date(Date.now() + ops.clockSkewMs)
  }, 30000)
})
onUnmounted(() => {
  stopRealtime()
  clearInterval(tick)
})
watch(() => tenantStore.currentRestaurant?.id, () => void start())
watch(
  () => ops.clockSkewMs,
  s => (now.value = new Date(Date.now() + s))
)

const me = computed(() => ops.me)
const canManage = computed(() => !!me.value?.canManage)

const ATTENTION = new Set(['request_pending', 'awaiting_delivery', 'bill_requested', 'ready', 'awaiting_service'])
const visibleTables = computed(() =>
  ops.tables.filter(t => {
    if (staffFilter.value && !t.assignments.some(a => a.staffId === staffFilter.value)) return false
    const s = tableState(t, now.value)
    switch (filter.value) {
      case 'mine':
        return t.assignments.some(a => a.staffId === me.value?.staffId)
      case 'attention':
        return ATTENTION.has(s) || !primaryOf(t)
      case 'occupied':
        return !!t.session
      case 'free':
        return !t.session
      default:
        return true
    }
  })
)

const openRequests = computed(() =>
  ops.tables
    .flatMap(t => t.requests.map(r => ({ r, t })))
    .filter(({ r }) => !staffFilter.value || r.responsibleStaffId === staffFilter.value || r.handledByStaffId === staffFilter.value)
    .sort((a, b) => a.r.createdAt.localeCompare(b.r.createdAt))
)

const counts = computed(() => ({
  occupied: ops.tables.filter(t => t.session).length,
  free: ops.tables.filter(t => !t.session).length,
  unassigned: ops.tables.filter(t => !primaryOf(t)).length,
  requests: openRequests.value.length
}))

const myStaff = computed<OpsStaff | null>(() => ops.staff.find(s => s.id === me.value?.staffId) ?? null)
const myTableCount = computed(() => ops.myTables.length)

// ------------------------------------------------------------ ações
const act = async <T>(fn: () => Promise<T>) => {
  busy.value = true
  try {
    return await fn()
  } finally {
    busy.value = false
  }
}

const onRequest = (requestId: string, action: ServiceAction, onBehalfOf?: string) =>
  act(() => ops.handleRequest(requestId, action, onBehalfOf))

const detailId = ref<string | null>(null)
const detailTable = computed(() => ops.tables.find(t => t.id === detailId.value) ?? null)

const transferTableId = ref<string | null>(null)
const transferStaff = ref<OpsStaff | null>(null)
const transferOpen = ref(false)
const transferTable = computed(() => ops.tables.find(t => t.id === transferTableId.value) ?? null)

const openTableTransfer = (t: TableOperation) => {
  transferStaff.value = null
  transferTableId.value = t.id
  transferOpen.value = true
}
const openStaffTransfer = (s: OpsStaff | null) => {
  if (!s) return
  transferTableId.value = null
  transferStaff.value = s
  transferOpen.value = true
}
const submitTransfer = async (p: { toStaffId: string; reason: string; fromStaffId?: string }) => {
  const ok = await act<boolean | number | undefined>(() =>
    transferTableId.value
      ? ops.transferTable(transferTableId.value, p.toStaffId, p.reason, p.fromStaffId)
      : ops.transferStaffTables(p.toStaffId, p.reason, p.fromStaffId === me.value?.staffId ? undefined : p.fromStaffId)
  )
  if (ok !== undefined) transferOpen.value = false
}

const canTransferTable = (t: TableOperation) => canManage.value || t.assignments.some(a => a.staffId === me.value?.staffId)

const setMyDuty = async (status: DutyStatus) => {
  const r = await act(() => ops.setDutyStatus(status))
  // Fim de turno com mesas: sugerir logo a transferência.
  if (r && status === 'off_duty' && r.openTables > 0) openStaffTransfer(myStaff.value)
}

const onAssign = (p: { tableIds: string[]; staffId: string; role: AssignmentRole; expiresAt: Date | null; reason: string }) =>
  act(() => ops.assign(p.tableIds, p.staffId, p.role, p.expiresAt, p.reason))
const onRemove = (id: string) => act(() => ops.remove(id))
const onDuty = (staffId: string, status: DutyStatus) => act(() => ops.setDutyStatus(status, staffId))

const FILTERS = computed(() => [
  { key: 'all' as const, label: `Todas (${ops.tables.length})` },
  ...(me.value?.staffId && me.value.scope === 'all' ? [{ key: 'mine' as const, label: 'Minhas mesas' }] : []),
  { key: 'attention' as const, label: 'Precisam de atenção' },
  { key: 'occupied' as const, label: `Ocupadas (${counts.value.occupied})` },
  { key: 'free' as const, label: `Livres (${counts.value.free})` }
])
const DUTIES: DutyStatus[] = ['on_duty', 'on_break', 'absent', 'off_duty']
</script>

<template>
  <div class="ops-page">
    <header class="ops-header">
      <div>
        <h1 class="page-title">Sala</h1>
        <p class="page-subtitle">
          {{ me?.scope === 'assigned' ? 'As suas mesas, pedidos e chamadas' : 'Mesas, garçons responsáveis e chamadas em tempo real' }}
        </p>
      </div>

      <div v-if="me?.staffId" class="my-shift">
        <label>
          <span>O meu turno</span>
          <select :value="me.dutyStatus" :disabled="busy" @change="setMyDuty(($event.target as HTMLSelectElement).value as DutyStatus)">
            <option v-for="d in DUTIES" :key="d" :value="d">{{ DUTY_LABELS[d] }}</option>
          </select>
        </label>
        <AppButton v-if="myTableCount" size="sm" variant="outline" @click="openStaffTransfer(myStaff)">
          <ArrowLeftRight :size="14" /> Transferir minhas mesas
        </AppButton>
      </div>
    </header>

    <nav v-if="canManage" class="tabs">
      <button type="button" :class="{ on: tab === 'panel' }" @click="tab = 'panel'"><LayoutGrid :size="15" /> Painel</button>
      <button type="button" :class="{ on: tab === 'assign' }" @click="tab = 'assign'">
        <UserCog :size="15" /> Atribuição de garçons
        <span v-if="counts.unassigned" class="tab-badge">{{ counts.unassigned }}</span>
      </button>
    </nav>

    <div v-if="ops.loadError && !ops.tables.length" class="error-box">
      <p>{{ ops.loadError }}</p>
      <AppButton size="sm" variant="outline" @click="start"><RefreshCw :size="14" /> Tentar de novo</AppButton>
    </div>

    <template v-else-if="tab === 'panel' || !canManage">
      <section v-if="openRequests.length" class="requests">
        <h2><BellRing :size="16" /> Chamadas em aberto ({{ openRequests.length }})</h2>
        <div class="request-list">
          <RequestActions
            v-for="{ r, t } in openRequests"
            :key="r.id"
            :request="r"
            :table-label="tableLabel(t)"
            :me="me"
            :staff="ops.staff"
            :now="now"
            :busy="busy"
            @action="(a, who) => onRequest(r.id, a, who)"
          />
        </div>
      </section>

      <div class="toolbar">
        <div class="pills">
          <button v-for="f in FILTERS" :key="f.key" type="button" :class="{ on: filter === f.key }" @click="filter = f.key">
            {{ f.label }}
          </button>
        </div>
        <select v-if="me?.scope === 'all' && ops.staff.length" v-model="staffFilter" class="staff-filter" aria-label="Filtrar por garçom">
          <option value="">Todos os garçons</option>
          <option v-for="s in ops.staff" :key="s.id" :value="s.id">{{ s.name }} ({{ s.tables }})</option>
        </select>
      </div>

      <p v-if="ops.isLoading && !ops.tables.length" class="muted">A carregar mesas…</p>
      <EmptyState
        v-else-if="!ops.tables.length"
        :title="me?.scope === 'assigned' ? 'Ainda não tem mesas atribuídas' : 'Sem mesas'"
        :description="me?.scope === 'assigned' ? 'Peça ao gerente para lhe atribuir mesas.' : 'Crie mesas em Gestão de Mesas.'"
      />
      <p v-else-if="!visibleTables.length" class="muted">Nenhuma mesa com este filtro.</p>
      <div v-else class="grid">
        <TableOpsCard
          v-for="t in visibleTables"
          :key="t.id"
          :table="t"
          :now="now"
          :mine="!!me?.staffId && t.assignments.some(a => a.staffId === me?.staffId)"
          :can-transfer="canTransferTable(t)"
          @open="detailId = t.id"
          @transfer="openTableTransfer(t)"
        />
      </div>
    </template>

    <AssignmentPanel
      v-else
      :tables="ops.tables"
      :staff="ops.staff"
      :busy="busy"
      @assign="onAssign"
      @remove="onRemove"
      @duty="onDuty"
      @transfer-staff="openStaffTransfer"
    />

    <TableOpsDetailModal
      :table="detailTable"
      :me="me"
      :staff="ops.staff"
      :now="now"
      :busy="busy"
      @close="detailId = null"
      @transfer="detailTable && openTableTransfer(detailTable)"
      @remove="onRemove"
      @request="onRequest"
    />

    <TransferModal
      :is-open="transferOpen"
      :table="transferTable"
      :from-staff="transferStaff"
      :only-staff-id="canManage ? undefined : me?.staffId"
      :staff="ops.staff"
      :busy="busy"
      @close="transferOpen = false"
      @submit="submitTransfer"
    />
  </div>
</template>

<style scoped>
.ops-page {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.ops-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
}
.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}
.page-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}
.my-shift {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem;
}
.my-shift label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
}
.my-shift select,
.staff-filter {
  height: 36px;
  padding: 0 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  font-size: 0.85rem;
  color: var(--text-main);
}
.tabs {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
}
.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 0.9rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
}
.tabs button.on {
  color: var(--color-primary-700);
  border-bottom-color: var(--color-primary-700);
}
.tab-badge {
  min-width: 18px;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--color-amber-100);
  color: var(--color-amber-900);
  font-size: 0.7rem;
  text-align: center;
}
.requests {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.requests h2 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--color-danger-700);
}
.request-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 0.6rem;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}
.pills {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 2px;
}
.pills button {
  flex-shrink: 0;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-medium);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.pills button.on {
  border-color: var(--color-primary-600);
  background: var(--color-primary-600);
  color: #fff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  gap: 0.8rem;
}
.muted {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.error-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-danger-200);
  border-radius: var(--radius-lg);
  background: var(--color-danger-50);
  color: var(--color-danger-700);
}
.error-box p {
  margin: 0;
}
</style>
