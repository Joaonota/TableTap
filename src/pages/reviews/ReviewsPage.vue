<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { reviewService } from '@/services'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import MetricCard from '@/components/ui/MetricCard.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { PublishedReviewsSummary, ReviewDashboard, ReviewRestaurantStats } from '@/types'
import {
  DEVICE_LABELS,
  REDIRECT_MODE_LABELS,
  REVIEW_STATE_DESCRIPTIONS,
  REVIEW_STATE_LABELS,
  type ReviewFunnelState,
  type ReviewRequestStatus
} from '@/domain/reviews'
import {
  Star,
  Send,
  MousePointerClick,
  Percent,
  ExternalLink,
  Calendar,
  Store,
  Info,
  AlertTriangle,
  CheckCircle2,
  Link2Off,
  Clock
} from 'lucide-vue-next'

/**
 * Avaliações — pedidos de avaliação no Google feitos pelo TapMenu no fim
 * de cada sessão. Mostra apenas o que o TapMenu observa (apresentado,
 * Google aberto, encaminhado); as avaliações publicadas no Google só
 * aparecerão com a integração oficial (reviewService.getPublishedSummary).
 */
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const PERIODS = { '7': 7, '30': 30, '90': 90 } as const
const period = ref<keyof typeof PERIODS>('30')
/** '' = todos os estabelecimentos que o utilizador gere. */
const restaurantFilter = ref('')

const dashboard = ref<ReviewDashboard | null>(null)
const published = ref<PublishedReviewsSummary>({ status: 'not_connected' })
const isLoading = ref(true)

const restaurants = computed(() => tenantStore.availableRestaurants)

const load = async () => {
  const company = tenantStore.currentCompany
  if (!company) return
  isLoading.value = true
  try {
    const from = new Date(Date.now() - PERIODS[period.value] * 24 * 60 * 60 * 1000)
    const [d, p] = await Promise.all([
      reviewService.getDashboard({ companyId: company.id, restaurantId: restaurantFilter.value || undefined, from, recentLimit: 25 }),
      reviewService.getPublishedSummary(restaurantFilter.value || tenantStore.currentRestaurant?.id || '')
    ])
    dashboard.value = d
    published.value = p
  } catch (e) {
    toastStore.error('Erro ao carregar avaliações', (e as Error).message)
  } finally {
    isLoading.value = false
  }
}

watch(() => [period.value, restaurantFilter.value, tenantStore.currentCompany?.id], load)
onMounted(load)

const totals = computed(() => {
  const rows = dashboard.value?.byRestaurant ?? []
  const sum = (k: keyof ReviewRestaurantStats) => rows.reduce((acc, r) => acc + Number(r[k] || 0), 0)
  const closedSessions = sum('closedSessions')
  const requestedSessions = sum('requestedSessions')
  return {
    closedSessions,
    notRequested: Math.max(closedSessions - requestedSessions, 0),
    presented: sum('presented'),
    opened: sum('opened'),
    forwarded: sum('forwarded'),
    autoRedirected: sum('autoRedirected'),
    reached: sum('reached')
  }
})

const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0)
const formatPct = (value: number) => `${value.toLocaleString('pt-MZ', { maximumFractionDigits: 1 })}%`
const formatInt = (value: number) => value.toLocaleString('pt-MZ')

/** Clientes que chegaram ao Google (automático ou botão) ÷ solicitações. */
const reachRate = computed(() => pct(totals.value.reached, totals.value.presented))

const withoutLink = computed(() => (dashboard.value?.byRestaurant ?? []).filter(r => !r.hasReviewUrl))

const periodLabel = computed(() => `Últimos ${PERIODS[period.value]} dias`)

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}`
}

const STATUS_VARIANT: Record<ReviewRequestStatus, 'neutral' | 'primary' | 'success'> = {
  presented: 'neutral',
  google_opened: 'primary',
  forwarded: 'success'
}

const FUNNEL_ORDER: ReviewFunnelState[] = ['not_requested', 'presented', 'google_opened', 'forwarded']
</script>

<template>
  <div class="reviews-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Avaliações</h1>
        <p class="page-subtitle">Pedidos de avaliação no Google apresentados aos clientes no fim de cada sessão</p>
      </div>

      <div class="header-actions">
        <div class="filter-wrap">
          <Calendar :size="15" />
          <select v-model="period" class="filter-select" aria-label="Período">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
        <div v-if="restaurants.length > 1" class="filter-wrap">
          <Store :size="15" />
          <select v-model="restaurantFilter" class="filter-select" aria-label="Estabelecimento">
            <option value="">Todos os estabelecimentos</option>
            <option v-for="r in restaurants" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Aviso obrigatório: isto não são avaliações publicadas -->
    <div class="info-banner" role="note">
      <Info :size="18" class="info-icon" />
      <p>
        Os dados apresentados aqui correspondem apenas às solicitações de avaliação realizadas pelo TapMenu.
        As avaliações publicadas no Google ainda não estão sincronizadas.
      </p>
    </div>

    <!-- Estabelecimentos sem link -->
    <div v-if="withoutLink.length" class="warn-banner" role="status">
      <AlertTriangle :size="18" class="warn-icon" />
      <div>
        <strong>{{ withoutLink.length === 1 ? 'Um estabelecimento não tem' : `${withoutLink.length} estabelecimentos não têm` }} link de avaliação Google:</strong>
        {{ withoutLink.map(r => r.restaurantName).join(', ') }}.
        <span class="warn-sub">
          Os clientes destes estabelecimentos não recebem o pedido de avaliação. Configure o link de cada um em
          <router-link to="/app/estabelecimentos">Estabelecimentos → Google</router-link>.
        </span>
      </div>
    </div>

    <div v-if="isLoading && !dashboard" class="loading-box">A carregar…</div>

    <template v-else-if="dashboard">
      <!-- Indicadores -->
      <div class="metrics-grid">
        <MetricCard
          title="Solicitações"
          :value="formatInt(totals.presented)"
          :icon="Send"
          variant="primary"
          :subtitle="`Ecrãs de avaliação apresentados · ${periodLabel}`"
        />
        <MetricCard
          title="Encaminhados para o Google"
          :value="formatInt(totals.reached)"
          :icon="ExternalLink"
          variant="success"
          :subtitle="`${formatInt(totals.autoRedirected)} automaticamente · ${formatInt(totals.opened)} pelo botão`"
        />
        <MetricCard
          title="Taxa de encaminhamento"
          :value="formatPct(reachRate)"
          :icon="Percent"
          variant="neutral"
          subtitle="Encaminhados ÷ solicitações"
        />
        <MetricCard
          title="Cliques no botão"
          :value="formatInt(totals.opened)"
          :icon="MousePointerClick"
          variant="warning"
          subtitle='Toques em "Avaliar no Google" (ex.: ao cancelar ou voltar ao TapMenu)'
        />
      </div>

      <!-- Funil por estado -->
      <div class="app-card">
        <div class="card-header">
          <div class="header-icon"><CheckCircle2 :size="18" /></div>
          <div>
            <h2 class="card-title">Estado dos pedidos</h2>
            <p class="card-desc">{{ formatInt(totals.closedSessions) }} sessões encerradas · {{ periodLabel }}</p>
          </div>
        </div>
        <ul class="funnel">
          <li v-for="state in FUNNEL_ORDER" :key="state" class="funnel-row">
            <div class="funnel-head">
              <span class="funnel-label">{{ REVIEW_STATE_LABELS[state] }}</span>
              <span class="funnel-value">
                {{
                  formatInt(
                    state === 'not_requested'
                      ? totals.notRequested
                      : state === 'presented'
                        ? totals.presented
                        : state === 'google_opened'
                          ? totals.opened
                          : totals.forwarded
                  )
                }}
              </span>
            </div>
            <p class="funnel-desc">{{ REVIEW_STATE_DESCRIPTIONS[state] }}</p>
          </li>
        </ul>
        <p class="funnel-note">
          "Não solicitado" conta sessões; os restantes estados contam telemóveis (cada participante da mesa recebe o seu
          próprio pedido).
        </p>
      </div>

      <!-- Por estabelecimento -->
      <div v-if="dashboard.byRestaurant.length > 1" class="app-card">
        <div class="card-header">
          <div class="header-icon"><Store :size="18" /></div>
          <div>
            <h2 class="card-title">Por estabelecimento</h2>
            <p class="card-desc">Cada estabelecimento encaminha para o seu próprio link do Google</p>
          </div>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th>Link Google</th>
                <th class="num">Sessões encerradas</th>
                <th class="num">Solicitações</th>
                <th class="num">Encaminhados</th>
                <th class="num">Taxa</th>
                <th class="num">Automático</th>
                <th class="num">Botão</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in dashboard.byRestaurant" :key="r.restaurantId">
                <td><strong>{{ r.restaurantName }}</strong></td>
                <td>
                  <AppBadge v-if="r.hasReviewUrl" variant="success" dot>Configurado</AppBadge>
                  <AppBadge v-else variant="warning"><Link2Off :size="12" /> Em falta</AppBadge>
                </td>
                <td class="num">{{ formatInt(r.closedSessions) }}</td>
                <td class="num">{{ formatInt(r.presented) }}</td>
                <td class="num">{{ formatInt(r.reached) }}</td>
                <td class="num">{{ formatPct(pct(r.reached, r.presented)) }}</td>
                <td class="num">{{ formatInt(r.autoRedirected) }}</td>
                <td class="num">{{ formatInt(r.opened) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Últimas solicitações -->
      <div class="app-card">
        <div class="card-header">
          <div class="header-icon"><Clock :size="18" /></div>
          <div>
            <h2 class="card-title">Últimas solicitações</h2>
            <p class="card-desc">Pedidos de avaliação mais recentes no período</p>
          </div>
        </div>

        <EmptyState
          v-if="!dashboard.recent.length"
          title="Ainda sem pedidos de avaliação"
          description="Os pedidos aparecem aqui quando uma sessão de mesa é encerrada num estabelecimento com link de avaliação Google configurado."
        />

        <div v-else class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data / hora</th>
                <th v-if="restaurants.length > 1 && !restaurantFilter">Estabelecimento</th>
                <th>Mesa</th>
                <th>Estado</th>
                <th>Via</th>
                <th>Dispositivo</th>
                <th>Link utilizado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in dashboard.recent" :key="q.id">
                <td class="nowrap">{{ formatDateTime(q.presentedAt) }}</td>
                <td v-if="restaurants.length > 1 && !restaurantFilter">{{ q.restaurantName }}</td>
                <td>{{ q.tableNumber ? `Mesa ${q.tableNumber}` : '—' }}</td>
                <td>
                  <AppBadge :variant="STATUS_VARIANT[q.status]" :title="REVIEW_STATE_DESCRIPTIONS[q.status]">
                    {{ REVIEW_STATE_LABELS[q.status] }}
                  </AppBadge>
                </td>
                <td>{{ q.redirectMode ? REDIRECT_MODE_LABELS[q.redirectMode] : '—' }}</td>
                <td>{{ q.deviceType ? DEVICE_LABELS[q.deviceType] : '—' }}</td>
                <td class="url-cell">
                  <a :href="q.reviewUrl" target="_blank" rel="noopener noreferrer" :title="q.reviewUrl">
                    {{ q.reviewUrl.replace(/^https:\/\//, '') }}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Avaliações publicadas (integração futura — sem dados simulados) -->
      <div class="app-card published-card">
        <div class="card-header">
          <div class="header-icon muted"><Star :size="18" /></div>
          <div>
            <h2 class="card-title">Avaliações publicadas no Google</h2>
            <p class="card-desc">
              {{ published.status === 'not_connected' ? 'Integração oficial com o Google Business Profile ainda não disponível' : 'Sincronizado com o Google' }}
            </p>
          </div>
        </div>
        <div v-if="published.status === 'not_connected'" class="published-empty">
          <p>
            Quando a integração oficial for ativada, poderá ver aqui a classificação média, o número de avaliações, as
            avaliações e comentários recentes, a evolução da classificação e as respostas, quando suportadas.
          </p>
          <p class="muted-small">Até lá, o TapMenu não apresenta nem estima avaliações do Google.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reviews-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: #fff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.filter-select {
  border: none;
  background: transparent;
  outline: none;
  font-weight: 600;
  color: var(--color-neutral-800);
  cursor: pointer;
  max-width: 220px;
}

.info-banner,
.warn-banner {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  line-height: 1.45;
}

.info-banner {
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200, #bfdbfe);
  color: var(--color-primary-900, #1e3a8a);
}

.info-banner p {
  margin: 0;
}

.info-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.warn-banner {
  background: var(--color-warning-50, #fffbeb);
  border: 1px solid var(--color-warning-200, #fde68a);
  color: var(--color-warning-900, #78350f);
}

.warn-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.warn-sub {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
}

.warn-sub a {
  font-weight: 700;
  color: inherit;
}

.loading-box {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--border-subtle);
}

.header-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-icon.muted {
  background: var(--color-neutral-100, #f1f5f9);
  color: var(--color-neutral-500, #64748b);
}

.card-title {
  font-size: 1.0625rem;
  font-weight: 700;
}

.card-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.funnel {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.funnel-row {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.875rem;
  background: var(--color-neutral-50);
}

.funnel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.funnel-label {
  font-size: 0.8125rem;
  font-weight: 700;
}

.funnel-value {
  font-size: 1.25rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.funnel-desc {
  margin: 0.3rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.funnel-note {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.data-table th {
  padding: 0.65rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.data-table td {
  padding: 0.7rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.data-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.nowrap {
  white-space: nowrap;
}

.url-cell {
  max-width: 260px;
}

.url-cell a {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-primary-700);
  font-size: 0.8rem;
}

.published-empty p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-neutral-700);
  line-height: 1.5;
}

.published-empty .muted-small {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 560px) {
  .header-actions,
  .filter-wrap {
    width: 100%;
  }

  .filter-select {
    max-width: none;
    flex: 1;
  }
}
</style>
