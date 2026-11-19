<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { PaymentMethod } from '@/types'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ParticipantAvatar from './ParticipantAvatar.vue'
import { publicTableService } from '@/services'
import { useToastStore } from '@/stores/toast'
import { errorMessage } from '@/domain/errors'
import {
  SPLIT_MODE_LABELS,
  PAYMENT_STATUS_SHORT,
  formatMt,
  previewAmount,
  type BillLine,
  type ItemSelection,
  type SessionBill,
  type SplitMode
} from '@/domain/groupBill'
import {
  AlertCircle,
  Banknote,
  BellRing,
  CreditCard,
  Crown,
  DollarSign,
  LogOut,
  Minus,
  Phone,
  Plus,
  Share2,
  User,
  Users,
  Wallet
} from 'lucide-vue-next'

/**
 * Modo Grupo — conta da mesa no telemóvel do cliente.
 *   "Minha conta"   o que eu pedi, o que já está pago e os meus pagamentos
 *   "Conta da mesa" totais e consumo de cada participante
 *   "Pagar"         o meu consumo · dividir igualmente · escolher produtos · tudo
 * Os valores vêm do servidor (get_session_bill); ao pagar, o servidor
 * recalcula e recusa valores já pagos por outra pessoa.
 */
const props = defineProps<{
  isOpen: boolean
  sessionId: string | null
  participantToken?: string
  tableNumber?: string
  isOrganizer: boolean
  inviteUrl: string
  /** Muda quando chega um evento da conta (Realtime): recarrega. */
  refreshKey?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'left'): void
  (e: 'call-staff'): void
}>()

const toastStore = useToastStore()

type Tab = 'mine' | 'table' | 'pay'
const tab = ref<Tab>('mine')
const bill = ref<SessionBill | null>(null)
const loading = ref(false)
const submitting = ref(false)

const mode = ref<SplitMode>('own')
const method = ref<PaymentMethod>('mpesa')
const notes = ref('')
const selection = ref<Record<string, number>>({})

const load = async () => {
  if (!props.sessionId || !props.participantToken) return
  loading.value = true
  try {
    bill.value = await publicTableService.getSessionBill(props.sessionId, props.participantToken)
  } catch (e) {
    toastStore.error('Não foi possível abrir a conta', errorMessage(e))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.isOpen,
  open => {
    if (!open) return
    tab.value = 'mine'
    selection.value = {}
    void load()
  }
)
watch(
  () => props.refreshKey,
  () => props.isOpen && void load()
)

const me = computed(() => bill.value?.participants.find(p => p.isMe))
const myLines = computed(() => (bill.value?.lines ?? []).filter(l => l.participantId === me.value?.id))
const myPayments = computed(() => (bill.value?.payments ?? []).filter(p => p.isMine))
const linesOf = (participantId: string) => (bill.value?.lines ?? []).filter(l => l.participantId === participantId)
const tableOrderLines = computed(() => (bill.value?.lines ?? []).filter(l => !l.participantId))
const payableLines = computed(() => (bill.value?.lines ?? []).filter(l => l.outstanding > 0))
const nameOf = (participantId?: string) =>
  bill.value?.participants.find(p => p.id === participantId)?.name ?? 'Mesa'

const lineState = (l: BillLine) => {
  if (l.outstanding <= 0.005 && l.reserved <= 0.005) return { label: 'Pago', cls: 'paid' }
  if (l.outstanding <= 0.005) return { label: 'A confirmar', cls: 'reserved' }
  if (l.paid + l.reserved > 0.005) return { label: `Falta ${formatMt(l.outstanding)}`, cls: 'partial' }
  return { label: 'Por pagar', cls: 'open' }
}

// ---------------- Pagar
const selectionList = computed<ItemSelection[]>(() =>
  Object.entries(selection.value)
    .filter(([, q]) => q > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }))
)
const amountFor = (m: SplitMode) => (bill.value ? previewAmount(bill.value, m, selectionList.value) : 0)
const amount = computed(() => amountFor(mode.value))

const toggleLine = (l: BillLine) => {
  const next = { ...selection.value }
  if (next[l.itemId]) delete next[l.itemId]
  else next[l.itemId] = l.quantity
  selection.value = next
}
const stepLine = (l: BillLine, delta: number) => {
  const q = Math.min(l.quantity, Math.max(0, (selection.value[l.itemId] ?? 0) + delta))
  const next = { ...selection.value }
  if (q === 0) delete next[l.itemId]
  else next[l.itemId] = q
  selection.value = next
}

const METHODS: { key: PaymentMethod; label: string; icon: typeof DollarSign }[] = [
  { key: 'mpesa', label: 'M-Pesa', icon: DollarSign },
  { key: 'emola', label: 'e-Mola', icon: Phone },
  { key: 'card', label: 'Cartão POS', icon: CreditCard },
  { key: 'cash', label: 'Numerário', icon: Banknote }
]
const methodLabel = (m: PaymentMethod) => METHODS.find(x => x.key === m)?.label ?? m

const pay = async () => {
  if (!props.sessionId || !props.participantToken || amount.value <= 0) return
  submitting.value = true
  try {
    bill.value = await publicTableService.createSessionPayment({
      sessionId: props.sessionId,
      participantToken: props.participantToken,
      mode: mode.value,
      method: method.value,
      items: mode.value === 'items' ? selectionList.value : undefined,
      notes: notes.value
    })
    toastStore.success('Pagamento registado', 'A equipa foi avisada e vai confirmar o recebimento.')
    selection.value = {}
    notes.value = ''
    tab.value = 'mine'
  } catch (e) {
    toastStore.error('Não foi possível registar o pagamento', errorMessage(e))
    void load()
  } finally {
    submitting.value = false
  }
}

const cancelPayment = async (paymentId: string) => {
  if (!props.participantToken) return
  try {
    bill.value = await publicTableService.cancelSessionPayment(paymentId, props.participantToken)
    toastStore.info('Pagamento cancelado', 'Os valores voltaram a ficar por pagar.')
  } catch (e) {
    toastStore.error('Não foi possível cancelar', errorMessage(e))
  }
}

// ---------------- Organizador / sair
const invite = async () => {
  const data = { title: 'TapMenu', text: `Junte-se à Mesa ${props.tableNumber ?? ''} no TapMenu`, url: props.inviteUrl }
  try {
    if (navigator.share) {
      await navigator.share(data)
      return
    }
    await navigator.clipboard.writeText(props.inviteUrl)
    toastStore.success('Link copiado', 'Envie-o a quem está na mesa.')
  } catch {
    // Partilha cancelada pelo utilizador.
  }
}

const canLeave = computed(() => !!me.value && me.value.pending <= 0.005)
const leave = async () => {
  if (!props.sessionId || !props.participantToken) return
  try {
    await publicTableService.leaveSession(props.sessionId, props.participantToken)
    toastStore.info('Saiu da mesa', 'Obrigado pela visita!')
    emit('left')
  } catch (e) {
    toastStore.error('Não foi possível sair', errorMessage(e))
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    title="Conta"
    :subtitle="tableNumber ? `Mesa ${tableNumber}` : ''"
    max-width="560px"
    @close="emit('close')"
  >
    <div class="gb">
      <div class="gb-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="tab === 'mine'" :class="{ on: tab === 'mine' }" @click="tab = 'mine'">
          <User :size="15" /> Minha conta
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'table'" :class="{ on: tab === 'table' }" @click="tab = 'table'">
          <Users :size="15" /> Conta da mesa
        </button>
        <button type="button" role="tab" :aria-selected="tab === 'pay'" :class="{ on: tab === 'pay' }" @click="tab = 'pay'">
          <Wallet :size="15" /> Pagar
        </button>
      </div>

      <p v-if="loading && !bill" class="gb-muted">A carregar a conta…</p>

      <template v-else-if="bill">
        <!-- ============ MINHA CONTA ============ -->
        <section v-if="tab === 'mine'" class="gb-section">
          <div class="gb-summary">
            <div><span>O meu consumo</span><strong>{{ formatMt(me?.consumption ?? 0) }}</strong></div>
            <div><span>Pago</span><strong class="ok">{{ formatMt(me?.paid ?? 0) }}</strong></div>
            <div><span>Por pagar</span><strong :class="{ warn: (me?.pending ?? 0) > 0 }">{{ formatMt(me?.pending ?? 0) }}</strong></div>
          </div>

          <ul v-if="myLines.length" class="gb-lines">
            <li v-for="l in myLines" :key="l.itemId">
              <div class="ln-main">
                <span class="ln-name">{{ l.quantity }}× {{ l.productName }}</span>
                <span class="ln-sub">{{ formatMt(l.unitPrice) }} cada · {{ l.orderCode }}</span>
              </div>
              <div class="ln-side">
                <strong>{{ formatMt(l.due) }}</strong>
                <span class="chip" :class="lineState(l).cls">{{ lineState(l).label }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="gb-muted">Ainda não fez pedidos.</p>

          <div v-if="myPayments.length" class="gb-payments">
            <h4>Os meus pagamentos</h4>
            <div v-for="p in myPayments" :key="p.id" class="pay-row">
              <span>{{ formatMt(p.amount) }} · {{ methodLabel(p.method) }}</span>
              <span class="chip" :class="p.status">{{ PAYMENT_STATUS_SHORT[p.status] ?? p.status }}</span>
              <button
                v-if="p.status === 'awaiting_confirmation' || p.status === 'pending'"
                type="button"
                class="link-btn"
                @click="cancelPayment(p.id)"
              >
                Cancelar
              </button>
            </div>
          </div>

          <AppButton v-if="(me?.outstanding ?? 0) > 0" variant="primary" class="gb-cta" @click="mode = 'own'; tab = 'pay'">
            Pagar o meu consumo ({{ formatMt(me?.outstanding ?? 0) }})
          </AppButton>
        </section>

        <!-- ============ CONTA DA MESA ============ -->
        <section v-else-if="tab === 'table'" class="gb-section">
          <div class="gb-summary four">
            <div><span>Total</span><strong>{{ formatMt(bill.totals.total) }}</strong></div>
            <div><span>Pago</span><strong class="ok">{{ formatMt(bill.totals.paid) }}</strong></div>
            <div><span>A confirmar</span><strong>{{ formatMt(bill.totals.reserved) }}</strong></div>
            <div><span>Por pagar</span><strong :class="{ warn: bill.totals.outstanding > 0 }">{{ formatMt(bill.totals.outstanding) }}</strong></div>
          </div>

          <details v-for="p in bill.participants" :key="p.id" class="gb-person" :open="p.isMe">
            <summary>
              <ParticipantAvatar :id="p.id" :name="p.name" :avatar="p.avatar" :size="30" />
              <span class="ps-name">
                {{ p.name }}<template v-if="p.isMe"> (eu)</template>
                <Crown v-if="p.isPrimary" :size="13" class="crown" aria-label="Organizador" />
              </span>
              <span class="ps-vals">
                <strong>{{ formatMt(p.consumption) }}</strong>
                <small :class="p.pending > 0 ? 'warn' : 'ok'">{{ p.pending > 0 ? `falta ${formatMt(p.pending)}` : 'pago' }}</small>
              </span>
            </summary>
            <ul class="gb-lines compact">
              <li v-for="l in linesOf(p.id)" :key="l.itemId">
                <span class="ln-name">{{ l.quantity }}× {{ l.productName }}</span>
                <span class="ln-side"><span>{{ formatMt(l.due) }}</span><span class="chip" :class="lineState(l).cls">{{ lineState(l).label }}</span></span>
              </li>
            </ul>
          </details>

          <details v-if="tableOrderLines.length" class="gb-person">
            <summary>
              <span class="ps-name">Pedidos registados pela equipa</span>
            </summary>
            <ul class="gb-lines compact">
              <li v-for="l in tableOrderLines" :key="l.itemId">
                <span class="ln-name">{{ l.quantity }}× {{ l.productName }}</span>
                <span class="ln-side"><span>{{ formatMt(l.due) }}</span><span class="chip" :class="lineState(l).cls">{{ lineState(l).label }}</span></span>
              </li>
            </ul>
          </details>

          <div v-if="bill.payments.length" class="gb-payments">
            <h4>Pagamentos da mesa</h4>
            <div v-for="p in bill.payments" :key="p.id" class="pay-row">
              <span>{{ p.payerName ?? nameOf(p.participantId) }} · {{ formatMt(p.amount) }}</span>
              <span class="chip" :class="p.status">{{ PAYMENT_STATUS_SHORT[p.status] ?? p.status }}</span>
            </div>
          </div>

          <div class="gb-actions">
            <AppButton v-if="isOrganizer" variant="secondary" size="sm" @click="emit('call-staff')">
              <BellRing :size="15" /> Chamar a equipa para a conta
            </AppButton>
            <AppButton v-if="isOrganizer" variant="ghost" size="sm" @click="invite">
              <Share2 :size="15" /> Convidar para a mesa
            </AppButton>
            <AppButton
              variant="ghost"
              size="sm"
              :disabled="!canLeave"
              :title="canLeave ? undefined : 'Pague o seu consumo antes de sair'"
              @click="leave"
            >
              <LogOut :size="15" /> Sair da mesa
            </AppButton>
          </div>
        </section>

        <!-- ============ PAGAR ============ -->
        <section v-else class="gb-section">
          <p v-if="bill.totals.outstanding <= 0" class="gb-done">
            Não há valores por pagar. Os pagamentos registados aguardam a confirmação da equipa.
          </p>
          <template v-else>
            <div class="modes">
              <button
                v-for="m in (['own', 'equal', 'items', 'all'] as SplitMode[])"
                :key="m"
                type="button"
                class="mode"
                :class="{ on: mode === m }"
                :disabled="m !== 'items' && amountFor(m) <= 0"
                @click="mode = m"
              >
                <span class="mode-title">{{ SPLIT_MODE_LABELS[m].title }}</span>
                <span class="mode-hint">
                  {{ m === 'equal' ? `${SPLIT_MODE_LABELS[m].hint} (${bill.equalPayers} ${bill.equalPayers === 1 ? 'pessoa' : 'pessoas'})` : SPLIT_MODE_LABELS[m].hint }}
                </span>
                <strong v-if="m !== 'items'" class="mode-amt">{{ formatMt(amountFor(m)) }}</strong>
              </button>
            </div>

            <ul v-if="mode === 'items'" class="gb-lines pick">
              <li v-for="l in payableLines" :key="l.itemId" :class="{ sel: !!selection[l.itemId] }">
                <label class="pick-main">
                  <input type="checkbox" :checked="!!selection[l.itemId]" @change="toggleLine(l)" />
                  <span>
                    <span class="ln-name">{{ l.quantity }}× {{ l.productName }}</span>
                    <span class="ln-sub">{{ nameOf(l.participantId) }} · falta {{ formatMt(l.outstanding) }}</span>
                  </span>
                </label>
                <div v-if="l.quantity > 1 && selection[l.itemId]" class="stepper">
                  <button type="button" aria-label="Menos" @click="stepLine(l, -1)"><Minus :size="13" /></button>
                  <span>{{ selection[l.itemId] }}</span>
                  <button type="button" aria-label="Mais" @click="stepLine(l, 1)"><Plus :size="13" /></button>
                </div>
              </li>
            </ul>

            <div class="methods">
              <button
                v-for="m in METHODS"
                :key="m.key"
                type="button"
                class="method"
                :class="{ on: method === m.key }"
                @click="method = m.key"
              >
                <component :is="m.icon" :size="16" /> {{ m.label }}
              </button>
            </div>
            <input v-model="notes" type="text" class="gb-input" maxlength="300" placeholder="NUIT na fatura ou observações (opcional)" />

            <AppButton variant="primary" class="gb-cta" :loading="submitting" :disabled="amount <= 0" @click="pay">
              Pagar {{ formatMt(amount) }}
            </AppButton>
            <p class="gb-note">
              <AlertCircle :size="14" />
              A equipa é avisada e confirma o recebimento. O pagamento só fica concluído depois dessa confirmação.
            </p>
          </template>
        </section>
      </template>
    </div>
  </AppModal>
</template>

<style scoped>
.gb {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gb-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--color-slate-100, #f1f5f9);
  border-radius: 12px;
}

.gb-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 38px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-muted, #64748b);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.gb-tabs button.on {
  background: #fff;
  color: var(--color-primary-800, #1e40af);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.gb-section {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.gb-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.gb-summary.four {
  grid-template-columns: repeat(2, 1fr);
}

.gb-summary > div {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.65rem 0.75rem;
  background: var(--color-slate-50, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.gb-summary span {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
}

.gb-summary strong {
  font-size: 1rem;
  color: var(--text-main, #0f172a);
}

.ok {
  color: #059669 !important;
}

.warn {
  color: #b45309 !important;
}

.gb-lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.gb-lines li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
}

.gb-lines.compact li {
  padding: 0.4rem 0.2rem;
  border: none;
  border-bottom: 1px dashed var(--border-color, #e2e8f0);
  border-radius: 0;
  font-size: 0.82rem;
}

.ln-main,
.pick-main > span {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ln-name {
  font-weight: 600;
  font-size: 0.86rem;
  color: var(--text-main, #0f172a);
}

.ln-sub {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
}

.ln-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  flex-shrink: 0;
}

.gb-lines.compact .ln-side {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}

.chip {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #475569;
  white-space: nowrap;
}

.chip.paid,
.chip.confirmed {
  background: #dcfce7;
  color: #166534;
}

.chip.reserved,
.chip.awaiting_confirmation,
.chip.pending {
  background: #fef3c7;
  color: #92400e;
}

.chip.partial {
  background: #e0f2fe;
  color: #075985;
}

.chip.open {
  background: #fee2e2;
  color: #991b1b;
}

.chip.refunded {
  background: #ede9fe;
  color: #5b21b6;
}

.gb-payments h4 {
  margin: 0 0 0.4rem;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted, #64748b);
}

.pay-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-size: 0.84rem;
}

.pay-row > span:first-child {
  flex: 1;
  min-width: 0;
}

.link-btn {
  border: none;
  background: none;
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.25rem;
}

.gb-person {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 0.55rem 0.7rem;
}

.gb-person summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  list-style: none;
}

.gb-person summary::-webkit-details-marker {
  display: none;
}

.ps-name {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 700;
  font-size: 0.88rem;
}

.crown {
  color: #d97706;
}

.ps-vals {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.85rem;
}

.ps-vals small {
  font-size: 0.7rem;
  font-weight: 700;
}

.gb-person .gb-lines {
  margin-top: 0.5rem;
}

.gb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.modes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.7rem;
  border: 1.5px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.mode.on {
  border-color: var(--color-primary-700, #1d4ed8);
  background: #eff6ff;
}

.mode:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mode-title {
  font-weight: 800;
  font-size: 0.84rem;
  color: var(--text-main, #0f172a);
}

.mode-hint {
  font-size: 0.7rem;
  color: var(--text-muted, #64748b);
  line-height: 1.35;
}

.mode-amt {
  margin-top: 0.15rem;
  font-size: 0.95rem;
  color: var(--color-primary-800, #1e40af);
}

.gb-lines.pick li.sel {
  border-color: var(--color-primary-600, #2563eb);
  background: #eff6ff;
}

.pick-main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.pick-main input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.stepper button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.methods {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.method {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 42px;
  border: 1.5px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  background: #fff;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
}

.method.on {
  border-color: var(--color-primary-700, #1d4ed8);
  background: #eff6ff;
  color: var(--color-primary-900, #1e3a8a);
}

.gb-input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1.5px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  font-size: 0.85rem;
  box-sizing: border-box;
}

.gb-cta {
  width: 100%;
}

.gb-note {
  display: flex;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.74rem;
  color: var(--text-muted, #64748b);
}

.gb-muted,
.gb-done {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted, #64748b);
}

.gb-done {
  padding: 0.8rem;
  background: #f0fdf4;
  border-radius: 10px;
  color: #166534;
}

@media (max-width: 420px) {
  .modes {
    grid-template-columns: 1fr;
  }

  .gb-summary {
    grid-template-columns: repeat(3, 1fr);
  }

  .gb-tabs button {
    font-size: 0.74rem;
  }
}
</style>
