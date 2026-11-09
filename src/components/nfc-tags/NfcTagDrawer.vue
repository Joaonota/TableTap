<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { NfcTagEvent, Restaurant } from '@/types'
import { useNfcTagStore } from '@/stores/nfcTag'
import { allowedTagActions, NFC_TAG_STATUS_DESCRIPTIONS, NFC_TAG_STATUS_LABELS, type NfcTagAction } from '@/domain/nfcTagRules'
import { toAbsoluteUrl } from '@/domain/publicUrl'
import AppDrawer from '@/components/ui/AppDrawer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import PublicUrlField from '@/components/ui/PublicUrlField.vue'
import QrCodeModal from '@/components/ui/QrCodeModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NfcTagStatusBadge from './NfcTagStatusBadge.vue'
import NfcTagAssignModal from './NfcTagAssignModal.vue'
import ExternalConfigNotice from './ExternalConfigNotice.vue'
import { Link2, ArrowRightLeft, Unlink, CheckCircle2, CircleCheck, Ban, RefreshCw, History, AlertTriangle, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  tagId: string | null
  /** 'restaurant': painel do restaurante; 'platform': equipa TapMenu (super admin). */
  scope: 'restaurant' | 'platform'
  restaurantsById: Map<string, Restaurant>
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useNfcTagStore()

const tag = computed(() => store.tags.find(t => t.id === props.tagId) ?? null)
const restaurant = computed(() => (tag.value ? props.restaurantsById.get(tag.value.restaurantId) ?? null : null))
const table = computed(() => (tag.value?.tableId ? store.tablesById.get(tag.value.tableId) ?? null : null))
const targetUrl = computed(() => (tag.value?.targetPath ? toAbsoluteUrl(tag.value.targetPath) : ''))
const configuredUrl = computed(() => (tag.value?.configuredPath ? toAbsoluteUrl(tag.value.configuredPath) : ''))
const restaurantTables = computed(() => store.tables.filter(t => t.restaurantId === tag.value?.restaurantId))

/** Ações físicas/administrativas da equipa TapMenu só aparecem no painel da plataforma. */
const PLATFORM_ONLY: NfcTagAction[] = ['mark_configured', 'activate']
const actions = computed(() => {
  if (!tag.value) return []
  const allowed = allowedTagActions(tag.value)
  return props.scope === 'platform' ? allowed : allowed.filter(a => !PLATFORM_ONLY.includes(a))
})
const has = (a: NfcTagAction) => actions.value.includes(a)
const awaitingTeam = computed(
  () => props.scope === 'restaurant' && !!tag.value?.tableId && (tag.value.status === 'pending' || tag.value.status === 'reassignment_pending')
)

const history = ref<NfcTagEvent[]>([])
const isLoadingHistory = ref(false)
const loadHistory = async () => {
  if (!props.tagId) return
  isLoadingHistory.value = true
  history.value = await store.getHistory(props.tagId)
  isLoadingHistory.value = false
}
watch(() => props.tagId, id => (id ? loadHistory() : (history.value = [])), { immediate: true })
watch(() => tag.value?.updatedAt, () => props.tagId && loadHistory())

const isBusy = ref(false)
const isAssignOpen = ref(false)
const isQrOpen = ref(false)
type Pending = 'unassign' | 'mark_configured' | 'activate' | 'disable' | 'reactivate' | null
const pending = ref<Pending>(null)

const confirmConfig = computed(() => {
  const code = tag.value?.code ?? ''
  switch (pending.value) {
    case 'mark_configured':
      return {
        title: 'Registar configuração física',
        message: `Confirma que a equipa TapMenu gravou ${targetUrl.value} na etiqueta ${code} com a aplicação externa? Isto é apenas um registo administrativo: o TapMenu não comunica com a etiqueta.`,
        confirmLabel: 'Marcar como configurada',
        variant: 'primary' as const,
        inputLabel: 'Nota (opcional)'
      }
    case 'activate':
      return {
        title: 'Confirmar instalação',
        message: `A etiqueta ${code} está instalada na ${table.value ? `Mesa ${table.value.number}` : 'mesa'} e em uso?`,
        confirmLabel: 'Marcar como ativa',
        variant: 'primary' as const
      }
    case 'unassign':
      return {
        title: 'Remover associação',
        message: tag.value?.configuredPath
          ? `${code} já foi gravada com a URL da mesa. Sem associação, fica em "Reatribuição pendente" até ser regravada para outra mesa.`
          : `Remover a associação de ${code} à mesa?`,
        confirmLabel: 'Remover associação',
        variant: 'warning' as const
      }
    case 'disable':
      return {
        title: 'Desativar etiqueta',
        message: `Desativar ${code}? Deixa de estar associada a qualquer mesa. A URL da mesa continua a funcionar (também é usada pelo QR Code); retire a etiqueta física da mesa se necessário.`,
        confirmLabel: 'Desativar',
        variant: 'danger' as const,
        inputLabel: 'Motivo (opcional)',
        inputPlaceholder: 'Ex.: danificada, perdida'
      }
    case 'reactivate':
      return {
        title: 'Reativar etiqueta',
        message: `Reativar ${code}? Fica disponível para ser associada a uma mesa.`,
        confirmLabel: 'Reativar',
        variant: 'primary' as const
      }
    default:
      return { title: '', message: '', confirmLabel: 'Confirmar', variant: 'primary' as const }
  }
})

const runConfirmed = async (input: string) => {
  if (!tag.value) return
  isBusy.value = true
  const id = tag.value.id
  try {
    if (pending.value === 'mark_configured') await store.markConfigured(id, input || undefined)
    if (pending.value === 'activate') await store.activate(id)
    if (pending.value === 'unassign') await store.unassign(id)
    if (pending.value === 'disable') await store.disable(id, input || undefined)
    if (pending.value === 'reactivate') await store.reactivate(id)
  } finally {
    isBusy.value = false
    pending.value = null
  }
}

const assign = async (tableId: string) => {
  if (!tag.value) return
  isBusy.value = true
  const result = await store.assign(tag.value.id, tableId)
  isBusy.value = false
  if (result) isAssignOpen.value = false
}

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
</script>

<template>
  <AppDrawer :is-open="!!tag" width="560px" @close="emit('close')">
    <template #header>
      <div v-if="tag" class="head">
        <div class="head-row">
          <h3 class="head-code">{{ tag.code }}</h3>
          <NfcTagStatusBadge :status="tag.status" />
        </div>
        <p class="head-sub">{{ restaurant?.name ?? '—' }}</p>
      </div>
    </template>

    <div v-if="tag" class="content">
      <p class="status-desc">{{ NFC_TAG_STATUS_DESCRIPTIONS[tag.status] }}</p>

      <div v-if="tag.status === 'reassignment_pending'" class="warning">
        <AlertTriangle :size="16" />
        <div>
          <strong>Regravação necessária.</strong>
          <span v-if="configuredUrl"> A etiqueta contém <code>{{ configuredUrl }}</code></span>
          <span v-if="targetUrl"> e deve passar a conter <code>{{ targetUrl }}</code>.</span>
          <span v-else>. Associe-a a uma mesa antes de a regravar.</span>
        </div>
      </div>

      <dl class="facts">
        <div>
          <dt>ID interno</dt>
          <dd><code>{{ tag.id }}</code></dd>
        </div>
        <div>
          <dt>Mesa associada</dt>
          <dd>{{ table ? `Mesa ${table.number}${table.name ? ` — ${table.name}` : ''}` : '—' }}</dd>
        </div>
        <div>
          <dt>Configurada em</dt>
          <dd>{{ fmt(tag.configuredAt) }}<span v-if="tag.configuredBy" class="muted"> · {{ tag.configuredBy }}</span></dd>
        </div>
        <div>
          <dt>Última alteração</dt>
          <dd>{{ fmt(tag.updatedAt) }}</dd>
        </div>
        <div v-if="tag.notes" class="full">
          <dt>Notas</dt>
          <dd>{{ tag.notes }}</dd>
        </div>
      </dl>

      <section v-if="targetUrl" class="block">
        <h4 class="block-title">URL a gravar na etiqueta</h4>
        <PublicUrlField :url="targetUrl" @show-qr="isQrOpen = true" />
      </section>

      <ExternalConfigNotice compact />

      <p v-if="awaitingTeam" class="awaiting">A aguardar configuração física pela equipa TapMenu.</p>

      <section class="block">
        <h4 class="block-title">Ações</h4>
        <div class="actions">
          <AppButton v-if="has('associate')" variant="primary" size="sm" @click="isAssignOpen = true">
            <template #icon-left><Link2 :size="14" /></template>
            Associar à mesa
          </AppButton>
          <AppButton v-if="has('change_association')" variant="secondary" size="sm" @click="isAssignOpen = true">
            <template #icon-left><ArrowRightLeft :size="14" /></template>
            Alterar associação
          </AppButton>
          <AppButton v-if="has('reassign')" variant="secondary" size="sm" @click="isAssignOpen = true">
            <template #icon-left><ArrowRightLeft :size="14" /></template>
            Reatribuir
          </AppButton>
          <AppButton v-if="has('mark_configured')" variant="primary" size="sm" @click="pending = 'mark_configured'">
            <template #icon-left><CheckCircle2 :size="14" /></template>
            Marcar como configurada
          </AppButton>
          <AppButton v-if="has('activate')" variant="success" size="sm" @click="pending = 'activate'">
            <template #icon-left><CircleCheck :size="14" /></template>
            Confirmar instalação
          </AppButton>
          <AppButton v-if="has('unassign')" variant="ghost" size="sm" @click="pending = 'unassign'">
            <template #icon-left><Unlink :size="14" /></template>
            Remover associação
          </AppButton>
          <AppButton v-if="has('reactivate')" variant="primary" size="sm" @click="pending = 'reactivate'">
            <template #icon-left><RefreshCw :size="14" /></template>
            Reativar
          </AppButton>
          <AppButton v-if="has('disable')" variant="ghost" size="sm" class="danger-text" @click="pending = 'disable'">
            <template #icon-left><Ban :size="14" /></template>
            Desativar
          </AppButton>
        </div>
      </section>

      <section class="block">
        <h4 class="block-title"><History :size="14" /> Histórico</h4>
        <div v-if="isLoadingHistory" class="loading"><Loader2 :size="16" class="spin" /> A carregar…</div>
        <EmptyState v-else-if="history.length === 0" title="Sem eventos registados" />
        <ol v-else class="timeline">
          <li v-for="evt in history" :key="evt.id" class="event">
            <span class="event-dot" :class="`is-${evt.type}`"></span>
            <div class="event-body">
              <p class="event-desc">{{ evt.description }}</p>
              <p class="event-meta">
                {{ fmt(evt.createdAt) }} · {{ evt.actor }}
                <template v-if="evt.toStatus && evt.fromStatus !== evt.toStatus"> · {{ evt.fromStatus ? `${NFC_TAG_STATUS_LABELS[evt.fromStatus]} → ` : '' }}{{ NFC_TAG_STATUS_LABELS[evt.toStatus] }}</template>
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </AppDrawer>

  <NfcTagAssignModal
    :is-open="isAssignOpen"
    :tag="tag"
    :restaurant="restaurant"
    :tables="restaurantTables"
    :taken-by="store.tagByTableId"
    :is-saving="isBusy"
    @close="isAssignOpen = false"
    @confirm="assign"
  />

  <ConfirmDialog
    :is-open="pending !== null"
    :title="confirmConfig.title"
    :message="confirmConfig.message"
    :confirm-label="confirmConfig.confirmLabel"
    :variant="confirmConfig.variant"
    :input-label="confirmConfig.inputLabel"
    :input-placeholder="confirmConfig.inputPlaceholder"
    :is-loading="isBusy"
    @cancel="pending = null"
    @confirm="runConfirmed"
  />

  <QrCodeModal
    v-if="tag && targetUrl"
    :is-open="isQrOpen"
    :url="targetUrl"
    :title="`QR Code — ${table ? `Mesa ${table.number}` : tag.code}`"
    :subtitle="restaurant?.name"
    :filename="`qr-${restaurant?.slug ?? 'mesa'}-${table?.slug ?? tag.code}`"
    @close="isQrOpen = false"
  />
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.head-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.head-code {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.head-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.status-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-main);
}

.warning {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  background: var(--color-amber-50);
  border: 1px solid var(--color-amber-200);
  color: var(--color-amber-900);
  font-size: 0.78rem;
  line-height: 1.5;
  word-break: break-word;
}

.warning svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}

.facts .full {
  grid-column: 1 / -1;
}

.facts dt {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.facts dd {
  margin: 0.15rem 0 0;
  font-size: 0.8125rem;
  font-weight: 600;
  word-break: break-word;
}

.muted {
  color: var(--text-muted);
  font-weight: 400;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.awaiting {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-amber-800);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.danger-text {
  color: var(--color-danger-600);
}

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.event {
  position: relative;
  display: flex;
  gap: 0.75rem;
  padding-bottom: 0.9rem;
}

.event:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: var(--border-color);
}

.event-dot {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin-top: 0.2rem;
  border-radius: 50%;
  background: var(--color-neutral-300);
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px var(--color-neutral-300);
}

.event-dot.is-configured,
.event-dot.is-activated {
  background: var(--color-success-500);
  box-shadow: 0 0 0 1px var(--color-success-500);
}

.event-dot.is-association_changed,
.event-dot.is-unassigned {
  background: var(--color-warning-500);
  box-shadow: 0 0 0 1px var(--color-warning-500);
}

.event-dot.is-disabled {
  background: var(--color-danger-500);
  box-shadow: 0 0 0 1px var(--color-danger-500);
}

.event-dot.is-associated,
.event-dot.is-reactivated {
  background: var(--color-primary-500);
  box-shadow: 0 0 0 1px var(--color-primary-500);
}

.event-desc {
  margin: 0;
  font-size: 0.8125rem;
  word-break: break-word;
}

.event-meta {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.loading {
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

@media (max-width: 420px) {
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
