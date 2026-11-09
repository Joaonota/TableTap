<script setup lang="ts">
import { computed, ref, watch, reactive } from 'vue'
import type { Order, TableSession } from '@/types'
import { orderService, tableSessionService } from '@/services'
import { useTableStore } from '@/stores/table'
import { useNfcTagStore } from '@/stores/nfcTag'
import { useServiceRequestStore } from '@/stores/serviceRequest'
import { useTenantStore } from '@/stores/tenant'
import { SESSION_STATUS_LABELS, effectiveTableStatus, formatDuration, formatStartTime, canStartSession } from '@/domain/tableRules'
import { NFC_TAG_STATUS_DESCRIPTIONS } from '@/domain/nfcTagRules'
import AppDrawer from '@/components/ui/AppDrawer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import PublicUrlField from '@/components/ui/PublicUrlField.vue'
import QrCodeModal from '@/components/ui/QrCodeModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TableStatusBadge from './TableStatusBadge.vue'
import NfcTagStatusBadge from '@/components/nfc-tags/NfcTagStatusBadge.vue'
import ExternalConfigNotice from '@/components/nfc-tags/ExternalConfigNotice.vue'
import {
  Play,
  Square,
  XCircle,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Ban,
  CheckCircle2,
  Receipt,
  BellRing,
  Users,
  Nfc,
  History,
  UtensilsCrossed,
  Loader2
} from 'lucide-vue-next'

const props = defineProps<{ tableId: string | null }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', tableId: string): void
}>()

const tableStore = useTableStore()
const nfcTagStore = useNfcTagStore()
const serviceRequestStore = useServiceRequestStore()
const tenantStore = useTenantStore()

const table = computed(() => tableStore.tables.find(t => t.id === props.tableId) ?? null)
const session = computed(() => (table.value ? tableStore.activeSessionByTableId.get(table.value.id) ?? null : null))
const tag = computed(() => (table.value ? nfcTagStore.tagByTableId.get(table.value.id) ?? null : null))
const url = computed(() => (table.value ? tableStore.tableUrl(table.value) : ''))
const status = computed(() => (table.value ? effectiveTableStatus(table.value) : 'free'))

const activeTab = ref<'overview' | 'history'>('overview')
const sessionOrders = ref<Order[]>([])
const history = ref<TableSession[]>([])
const historyOrders = ref<Map<string, number>>(new Map())
const isLoadingDetail = ref(false)
const isBusy = ref(false)
const isQrOpen = ref(false)

const pendingRequests = computed(() =>
  serviceRequestStore.requests.filter(r => r.tableId === props.tableId && (r.status === 'new' || r.status === 'in_progress'))
)

const loadDetail = async () => {
  if (!table.value || !tenantStore.currentRestaurant) return
  isLoadingDetail.value = true
  try {
    const [orders, sessions] = await Promise.all([
      orderService.getOrders(tenantStore.currentRestaurant.id),
      tableSessionService.getSessionsByTable(table.value.id)
    ])
    const current = session.value
    sessionOrders.value = current ? orders.filter(o => current.orderIds.includes(o.id) || o.tableSessionId === current.id) : []
    history.value = sessions.filter(s => s.status !== 'active')
    historyOrders.value = new Map(
      history.value.map(s => [s.id, orders.filter(o => s.orderIds.includes(o.id) || o.tableSessionId === s.id).length])
    )
  } finally {
    isLoadingDetail.value = false
  }
}

watch(
  () => props.tableId,
  id => {
    activeTab.value = 'overview'
    sessionOrders.value = []
    history.value = []
    if (id) loadDetail()
  },
  { immediate: true }
)
watch(() => session.value?.id, () => props.tableId && loadDetail())

// ---------- Iniciar sessão (pela equipa) ----------
const isStartOpen = ref(false)
const startForm = reactive({ name: '', partySize: 2 as number | undefined, notes: '' })
const startError = ref('')

const openStart = () => {
  startForm.name = ''
  startForm.partySize = Math.min(2, table.value?.capacity ?? 2)
  startForm.notes = ''
  startError.value = ''
  isStartOpen.value = true
}

const submitStart = async () => {
  if (!table.value) return
  if (startForm.partySize !== undefined && (!Number.isInteger(startForm.partySize) || startForm.partySize < 1)) {
    startError.value = 'Número de pessoas inválido.'
    return
  }
  isBusy.value = true
  const created = await tableStore.startSession(table.value.id, {
    primaryCustomerName: startForm.name.trim() || undefined,
    partySize: startForm.partySize,
    notes: startForm.notes.trim() || undefined
  })
  isBusy.value = false
  if (created) isStartOpen.value = false
}

// ---------- Confirmações ----------
type PendingAction = 'close' | 'cancel' | 'delete' | 'deactivate' | null
const pendingAction = ref<PendingAction>(null)

const confirmConfig = computed(() => {
  const n = table.value?.number ?? ''
  switch (pendingAction.value) {
    case 'close':
      return {
        title: 'Encerrar sessão',
        message: `Encerrar a sessão da Mesa ${n}? Total: ${(session.value?.total ?? 0).toLocaleString('pt-MZ')} MT. A mesa volta a ficar Livre e os clientes deixam de poder fazer pedidos nesta sessão.`,
        confirmLabel: 'Encerrar sessão',
        variant: 'primary' as const
      }
    case 'cancel':
      return {
        title: 'Cancelar sessão',
        message: `Cancelar a sessão da Mesa ${n}? Use apenas quando a sessão foi aberta por engano ou os clientes saíram. A mesa fica Livre.`,
        confirmLabel: 'Cancelar sessão',
        variant: 'danger' as const,
        inputLabel: 'Motivo (opcional)'
      }
    case 'delete':
      return {
        title: 'Remover mesa',
        message: `Remover a Mesa ${n}? A URL ${url.value} deixa de funcionar${tag.value ? ` e a etiqueta ${tag.value.code} fica sem mesa (terá de ser regravada se for reutilizada)` : ''}.`,
        confirmLabel: 'Remover mesa',
        variant: 'danger' as const
      }
    case 'deactivate':
      return {
        title: 'Desativar mesa',
        message: `Desativar a Mesa ${n}? Quem abrir a URL verá a mesa como indisponível. A etiqueta física não precisa de ser alterada.`,
        confirmLabel: 'Desativar',
        variant: 'warning' as const
      }
    default:
      return { title: '', message: '', confirmLabel: 'Confirmar', variant: 'primary' as const }
  }
})

const runConfirmed = async (input: string) => {
  if (!table.value) return
  isBusy.value = true
  const action = pendingAction.value
  try {
    if (action === 'close' && session.value) await tableStore.closeSession(session.value.id)
    if (action === 'cancel' && session.value) await tableStore.cancelSession(session.value.id, input)
    if (action === 'deactivate') await tableStore.setActive(table.value.id, false)
    if (action === 'delete') {
      const removed = await tableStore.deleteTable(table.value.id)
      if (removed) emit('close')
    }
  } finally {
    isBusy.value = false
    pendingAction.value = null
  }
}

const setStatus = async (next: 'free' | 'unavailable') => {
  if (!table.value) return
  isBusy.value = true
  await tableStore.setStatus(table.value.id, next)
  isBusy.value = false
}

const activate = async () => {
  if (!table.value) return
  isBusy.value = true
  await tableStore.setActive(table.value.id, true)
  isBusy.value = false
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-MZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })

const ORDER_STATUS: Record<Order['status'], { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  received: { label: 'Recebido', variant: 'warning' },
  confirmed: { label: 'Confirmado', variant: 'primary' },
  preparing: { label: 'A preparar', variant: 'warning' },
  ready: { label: 'Pronto', variant: 'success' },
  delivered: { label: 'Entregue', variant: 'neutral' },
  cancelled: { label: 'Cancelado', variant: 'danger' }
}

const REQUEST_LABELS: Record<string, string> = {
  waiter_call: 'Chamada de garçom',
  water: 'Água',
  cutlery: 'Talheres',
  bill: 'Pedido de conta',
  general_help: 'Assistência'
}

const updateRequest = (id: string, next: 'in_progress' | 'completed') => serviceRequestStore.updateRequestStatus(id, next)
</script>

<template>
  <AppDrawer :is-open="!!table" width="600px" @close="emit('close')">
    <template #header>
      <div v-if="table" class="drawer-head">
        <div class="head-title-row">
          <h3 class="head-title">Mesa {{ table.number }}</h3>
          <TableStatusBadge :table="table" />
        </div>
        <p class="head-sub">{{ table.name }} · {{ table.area }} · até {{ table.capacity }} pessoas</p>
      </div>
    </template>

    <div v-if="table" class="detail">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" class="tab" :class="{ 'is-active': activeTab === 'overview' }" @click="activeTab = 'overview'">
          Visão geral
        </button>
        <button type="button" role="tab" class="tab" :class="{ 'is-active': activeTab === 'history' }" @click="activeTab = 'history'">
          <History :size="14" /> Histórico de sessões
        </button>
      </div>

      <!-- ================= VISÃO GERAL ================= -->
      <template v-if="activeTab === 'overview'">
        <!-- Sessão atual -->
        <section class="block">
          <h4 class="block-title">Sessão atual</h4>

          <div v-if="session" class="session-card">
            <dl class="facts">
              <div>
                <dt>Ocupada desde</dt>
                <dd>{{ formatStartTime(session.startedAt) }} <span class="muted">({{ formatDuration(session.startedAt) }})</span></dd>
              </div>
              <div>
                <dt>Cliente principal</dt>
                <dd>{{ session.primaryCustomerName || '—' }}</dd>
              </div>
              <div>
                <dt>Pedidos</dt>
                <dd>{{ session.orderIds.length }}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd class="total">{{ session.total.toLocaleString('pt-MZ') }} MT</dd>
              </div>
            </dl>

            <div v-if="session.participants.length" class="participants">
              <Users :size="14" />
              <span>
                {{ session.participants.length }} {{ session.participants.length === 1 ? 'participante' : 'participantes' }}:
                {{ session.participants.map(p => p.name).join(', ') }}
              </span>
            </div>
            <div v-if="session.billRequestedAt" class="bill-flag">
              <Receipt :size="14" /> Conta pedida: {{ formatStartTime(session.billRequestedAt) }}
            </div>

            <div class="session-actions">
              <AppButton variant="primary" size="sm" :disabled="isBusy" @click="pendingAction = 'close'">
                <template #icon-left><Square :size="14" /></template>
                Encerrar sessão
              </AppButton>
              <AppButton variant="ghost" size="sm" :disabled="isBusy" @click="pendingAction = 'cancel'">
                <template #icon-left><XCircle :size="14" /></template>
                Cancelar sessão
              </AppButton>
            </div>
          </div>

          <div v-else class="no-session">
            <p class="muted">
              {{ status === 'unavailable' ? 'Mesa indisponível — não é possível iniciar sessões.' : 'Sem sessão ativa. A sessão começa quando um cliente abre a URL da mesa, ou pode iniciá-la aqui.' }}
            </p>
            <AppButton v-if="canStartSession(table)" variant="primary" size="sm" :disabled="isBusy" @click="openStart">
              <template #icon-left><Play :size="14" /></template>
              Iniciar sessão
            </AppButton>
          </div>
        </section>

        <!-- Pedidos da sessão -->
        <section v-if="session" class="block">
          <h4 class="block-title">Pedidos da sessão</h4>
          <div v-if="isLoadingDetail" class="loading-row"><Loader2 :size="16" class="spin" /> A carregar…</div>
          <EmptyState v-else-if="sessionOrders.length === 0" :icon="UtensilsCrossed" title="Ainda sem pedidos" />
          <ul v-else class="order-list">
            <li v-for="order in sessionOrders" :key="order.id" class="order-row">
              <div class="order-main">
                <strong>{{ order.orderCode }}</strong>
                <span class="muted">{{ fmtTime(order.createdAt) }} · {{ order.customerName || 'Cliente' }} · {{ order.items.reduce((s, i) => s + i.quantity, 0) }} itens</span>
              </div>
              <AppBadge :variant="ORDER_STATUS[order.status].variant">{{ ORDER_STATUS[order.status].label }}</AppBadge>
              <span class="order-total" :class="{ 'is-cancelled': order.status === 'cancelled' }">{{ order.total.toLocaleString('pt-MZ') }} MT</span>
            </li>
          </ul>
        </section>

        <!-- Atendimento pendente -->
        <section v-if="pendingRequests.length" class="block">
          <h4 class="block-title"><BellRing :size="14" /> Atendimento pendente</h4>
          <ul class="request-list">
            <li v-for="req in pendingRequests" :key="req.id" class="request-row">
              <div class="order-main">
                <strong>{{ REQUEST_LABELS[req.type] ?? req.type }}</strong>
                <span class="muted">{{ fmtTime(req.createdAt) }}{{ req.customerName ? ` · ${req.customerName}` : '' }}{{ req.notes ? ` · “${req.notes}”` : '' }}</span>
              </div>
              <div class="request-actions">
                <AppButton v-if="req.status === 'new'" variant="secondary" size="sm" @click="updateRequest(req.id, 'in_progress')">Assumir</AppButton>
                <AppButton variant="success" size="sm" @click="updateRequest(req.id, 'completed')">Concluir</AppButton>
              </div>
            </li>
          </ul>
        </section>

        <!-- URL e etiqueta -->
        <section class="block">
          <h4 class="block-title">URL da mesa</h4>
          <PublicUrlField :url="url" @show-qr="isQrOpen = true" />
          <p class="hint">URL permanente: é a mesma na etiqueta NFC e no QR Code, esteja a mesa livre ou ocupada.</p>
        </section>

        <section class="block">
          <h4 class="block-title"><Nfc :size="14" /> Etiqueta NFC</h4>
          <div v-if="tag" class="tag-card">
            <div class="tag-row">
              <strong class="tag-code">{{ tag.code }}</strong>
              <NfcTagStatusBadge :status="tag.status" />
            </div>
            <p class="hint">{{ NFC_TAG_STATUS_DESCRIPTIONS[tag.status] }}</p>
            <p v-if="tag.configuredAt" class="hint">Configuração registada em {{ fmtDateTime(tag.configuredAt) }}{{ tag.configuredBy ? ` por ${tag.configuredBy}` : '' }}.</p>
          </div>
          <div v-else class="no-tag">
            <p class="muted">Nenhuma etiqueta associada a esta mesa.</p>
            <router-link to="/app/tags-nfc" class="link">Gerir etiquetas NFC</router-link>
          </div>
          <ExternalConfigNotice compact />
        </section>
      </template>

      <!-- ================= HISTÓRICO ================= -->
      <template v-else>
        <div v-if="isLoadingDetail" class="loading-row"><Loader2 :size="16" class="spin" /> A carregar…</div>
        <EmptyState v-else-if="history.length === 0" :icon="History" title="Sem sessões anteriores" description="As sessões encerradas ou canceladas desta mesa aparecem aqui." />
        <div v-else class="table-scroll">
          <table class="history-table">
            <thead>
              <tr>
                <th>Início</th>
                <th>Duração</th>
                <th>Cliente</th>
                <th>Pedidos</th>
                <th class="num">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in history" :key="s.id">
                <td>{{ fmtDateTime(s.startedAt) }}</td>
                <td>{{ formatDuration(s.startedAt, s.closedAt) }}</td>
                <td>{{ s.primaryCustomerName || '—' }}</td>
                <td>{{ historyOrders.get(s.id) ?? 0 }}</td>
                <td class="num">{{ s.total.toLocaleString('pt-MZ') }} MT</td>
                <td>
                  <AppBadge :variant="s.status === 'closed' ? 'success' : 'danger'" :title="s.cancelReason">{{ SESSION_STATUS_LABELS[s.status] }}</AppBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <template v-if="table" #footer>
      <AppButton variant="ghost" size="sm" class="danger-text" :disabled="isBusy || !!session" title="Remover mesa" @click="pendingAction = 'delete'">
        <template #icon-left><Trash2 :size="14" /></template>
        Remover
      </AppButton>
      <span class="footer-spacer"></span>
      <AppButton v-if="table.isActive" variant="secondary" size="sm" :disabled="isBusy || !!session" @click="pendingAction = 'deactivate'">
        <template #icon-left><PowerOff :size="14" /></template>
        Desativar
      </AppButton>
      <AppButton v-else variant="secondary" size="sm" :disabled="isBusy" @click="activate">
        <template #icon-left><Power :size="14" /></template>
        Ativar
      </AppButton>
      <template v-if="table.isActive && !session">
        <AppButton v-if="table.status === 'free'" variant="secondary" size="sm" :disabled="isBusy" @click="setStatus('unavailable')">
          <template #icon-left><Ban :size="14" /></template>
          Marcar indisponível
        </AppButton>
        <AppButton v-else-if="table.status === 'unavailable'" variant="secondary" size="sm" :disabled="isBusy" @click="setStatus('free')">
          <template #icon-left><CheckCircle2 :size="14" /></template>
          Marcar livre
        </AppButton>
      </template>
      <AppButton variant="primary" size="sm" @click="emit('edit', table.id)">
        <template #icon-left><Pencil :size="14" /></template>
        Editar
      </AppButton>
    </template>
  </AppDrawer>

  <ConfirmDialog
    :is-open="pendingAction !== null"
    :title="confirmConfig.title"
    :message="confirmConfig.message"
    :confirm-label="confirmConfig.confirmLabel"
    :variant="confirmConfig.variant"
    :input-label="confirmConfig.inputLabel"
    :is-loading="isBusy"
    @cancel="pendingAction = null"
    @confirm="runConfirmed"
  />

  <AppModal :is-open="isStartOpen" :title="`Iniciar sessão — Mesa ${table?.number ?? ''}`" max-width="420px" @close="isStartOpen = false">
    <form class="start-form" @submit.prevent="submitStart">
      <label class="field">
        <span>Nome do cliente (opcional)</span>
        <input v-model="startForm.name" type="text" maxlength="60" placeholder="Ex.: Carlos Mateus" />
      </label>
      <label class="field">
        <span>Número de pessoas</span>
        <input v-model.number="startForm.partySize" type="number" min="1" :max="table?.capacity ?? 50" />
      </label>
      <label class="field">
        <span>Observações (opcional)</span>
        <input v-model="startForm.notes" type="text" maxlength="120" />
      </label>
      <p v-if="startError" class="field-error">{{ startError }}</p>
      <button type="submit" hidden></button>
    </form>
    <template #footer>
      <AppButton variant="secondary" :disabled="isBusy" @click="isStartOpen = false">Cancelar</AppButton>
      <AppButton variant="primary" :loading="isBusy" @click="submitStart">Iniciar sessão</AppButton>
    </template>
  </AppModal>

  <QrCodeModal
    v-if="table"
    :is-open="isQrOpen"
    :url="url"
    :title="`QR Code — Mesa ${table.number}`"
    :subtitle="tenantStore.currentRestaurant?.name"
    :filename="`qr-${tenantStore.currentRestaurant?.slug ?? 'mesa'}-${table.slug}`"
    @close="isQrOpen = false"
  />
</template>

<style scoped>
.drawer-head {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.head-title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.head-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.head-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  border: none;
  background: none;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
}

.tab.is-active {
  color: var(--color-primary-700);
  border-bottom-color: var(--color-primary-600);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.block-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.session-card,
.tag-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: #fff;
}

.facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.facts dt {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.facts dd {
  margin: 0.1rem 0 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.facts .total {
  color: var(--color-primary-800);
}

.participants,
.bill-flag {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.bill-flag {
  color: var(--color-amber-800);
  font-weight: 600;
}

.session-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.no-session,
.no-tag {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
}

.muted {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin: 0;
}

.hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.link {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary-700);
}

.order-list,
.request-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.order-row,
.request-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  background: #fff;
}

.order-row:last-child,
.request-row:last-child {
  border-bottom: none;
}

.order-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.8125rem;
}

.order-main .muted {
  font-size: 0.72rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-total {
  font-size: 0.8125rem;
  font-weight: 700;
  white-space: nowrap;
}

.order-total.is-cancelled {
  text-decoration: line-through;
  color: var(--text-muted);
}

.request-actions {
  display: flex;
  gap: 0.35rem;
}

.tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tag-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9rem;
}

.loading-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.history-table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.history-table th,
.history-table td {
  padding: 0.55rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.history-table th {
  background: var(--color-neutral-50);
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 700;
}

.history-table tr:last-child td {
  border-bottom: none;
}

.num {
  text-align: right !important;
}

.footer-spacer {
  flex: 1;
}

.danger-text {
  color: var(--color-danger-600);
}

.start-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.field input {
  padding: 0.6rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.field input:focus {
  border-color: var(--color-primary-500);
}

.field-error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-danger-600);
}

@media (max-width: 480px) {
  .facts {
    grid-template-columns: 1fr 1fr;
  }

  .order-row {
    flex-wrap: wrap;
  }

  .footer-spacer {
    display: none;
  }
}
</style>
