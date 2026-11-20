<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { companyInsightsService, categoryService, productService } from '@/services'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { errorMessage } from '@/domain/errors'
import MetricCard from '@/components/ui/MetricCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { Category, Product } from '@/types'
import {
  ALERT_TEXT,
  PERIODS,
  growth,
  periodRange,
  type CompanyAlert,
  type CompanyOverview,
  type MenuCopyReport,
  type PeriodKey
} from '@/domain/companyInsights'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Copy,
  DollarSign,
  Megaphone,
  Receipt,
  ShieldAlert,
  ShoppingBag,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle
} from 'lucide-vue-next'

/**
 * Empresa com vários estabelecimentos (só o proprietário):
 *   Visão geral   faturação, pedidos e produtos por localização + consolidado
 *   Alertas       situações incomuns detetadas nos registos reais
 *   Distribuir    copiar categorias e produtos para outras localizações
 *   Campanhas     a mesma promoção em vários estabelecimentos
 * As permissões por localização gerem-se em Funcionários.
 */
const tenantStore = useTenantStore()
const toastStore = useToastStore()

type Tab = 'overview' | 'alerts' | 'menu' | 'campaigns'
const tab = ref<Tab>('overview')
const period = ref<PeriodKey>('30d')

const companyId = computed(() => tenantStore.currentCompany?.id ?? '')
const restaurants = computed(() => tenantStore.availableRestaurants)
const restaurantName = (id: string) => restaurants.value.find(r => r.id === id)?.name ?? '—'

const mt = (v: number) => `${Math.round(v).toLocaleString('pt-MZ')} MT`
const pctText = (g: number | null) => (g === null ? 'sem base anterior' : `${g > 0 ? '+' : ''}${g}% vs período anterior`)

// ---------------- Visão geral + alertas
const overview = ref<CompanyOverview | null>(null)
const alerts = ref<CompanyAlert[]>([])
const loading = ref(false)

const load = async () => {
  if (!companyId.value) return
  loading.value = true
  const days = PERIODS.find(p => p.key === period.value)?.days ?? 30
  const { from, to } = periodRange(days)
  try {
    const [o, a] = await Promise.all([
      companyInsightsService.getOverview(companyId.value, from, to),
      companyInsightsService.getAlerts(companyId.value, from, to)
    ])
    overview.value = o
    alerts.value = a
  } catch (e) {
    toastStore.error('Não foi possível carregar os dados da empresa', errorMessage(e))
  } finally {
    loading.value = false
  }
}
watch([companyId, period], load)
onMounted(load)

const revenueGrowth = computed(() => (overview.value ? growth(overview.value.totals.revenue, overview.value.totals.prevRevenue) : null))
const maxRevenue = computed(() => Math.max(1, ...(overview.value?.restaurants.map(r => r.revenue) ?? [1])))
const highAlerts = computed(() => alerts.value.filter(a => a.severity === 'high').length)

// ---------------- Distribuir menu
const sourceId = ref('')
const sourceCategories = ref<Category[]>([])
const selectedCategories = ref<string[]>([])
const targetIds = ref<string[]>([])
const updateExisting = ref(false)
const copying = ref(false)
const copyReport = ref<MenuCopyReport[] | null>(null)

watch(sourceId, async id => {
  sourceCategories.value = []
  selectedCategories.value = []
  copyReport.value = null
  targetIds.value = targetIds.value.filter(t => t !== id)
  if (!id) return
  try {
    sourceCategories.value = await categoryService.getCategories(id)
    selectedCategories.value = sourceCategories.value.map(c => c.id)
  } catch (e) {
    toastStore.error('Não foi possível carregar as categorias', errorMessage(e))
  }
})

const copyMenu = async () => {
  if (!sourceId.value || !targetIds.value.length || !selectedCategories.value.length) return
  copying.value = true
  try {
    const all = selectedCategories.value.length === sourceCategories.value.length
    copyReport.value = await companyInsightsService.copyMenu(sourceId.value, targetIds.value, all ? null : selectedCategories.value, updateExisting.value)
    const created = copyReport.value.reduce((s, r) => s + r.productsCreated, 0)
    toastStore.success('Menu distribuído', `${created} ${created === 1 ? 'produto copiado' : 'produtos copiados'}.`)
  } catch (e) {
    toastStore.error('Não foi possível distribuir o menu', errorMessage(e))
  } finally {
    copying.value = false
  }
}

// ---------------- Campanhas de preço
const companyProducts = ref<Product[]>([])
const productsLoaded = ref(false)
const campaignNames = ref<string[]>([])
const campaignDiscount = ref(10)
const campaignRestaurants = ref<string[]>([])
const campaignBusy = ref(false)

const loadProducts = async () => {
  try {
    const lists = await Promise.all(restaurants.value.map(r => productService.getProducts(r.id)))
    companyProducts.value = lists.flat()
    productsLoaded.value = true
  } catch (e) {
    toastStore.error('Não foi possível carregar os produtos', errorMessage(e))
  }
}
watch(tab, t => {
  if (t === 'campaigns' && !productsLoaded.value) void loadProducts()
})

/** Produtos agrupados pelo nome (o mesmo produto em várias localizações). */
const productGroups = computed(() => {
  const map = new Map<string, { name: string; locations: Product[] }>()
  for (const p of companyProducts.value) {
    const key = p.name.trim().toLowerCase()
    const g = map.get(key) ?? { name: p.name.trim(), locations: [] }
    g.locations.push(p)
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) => b.locations.length - a.locations.length || a.name.localeCompare(b.name))
})
const activePromotions = computed(() =>
  productGroups.value.filter(g => g.locations.some(p => p.isPromotion || p.promotionalPrice !== undefined))
)

const applyCampaign = async () => {
  if (!campaignNames.value.length) return
  campaignBusy.value = true
  try {
    const n = await companyInsightsService.applyPromotion(
      companyId.value,
      campaignNames.value,
      campaignDiscount.value,
      campaignRestaurants.value.length ? campaignRestaurants.value : null
    )
    toastStore.success('Campanha aplicada', `-${campaignDiscount.value}% em ${n} ${n === 1 ? 'produto' : 'produtos'}.`)
    campaignNames.value = []
    await loadProducts()
  } catch (e) {
    toastStore.error('Não foi possível aplicar a campanha', errorMessage(e))
  } finally {
    campaignBusy.value = false
  }
}

const endCampaign = async (names: string[]) => {
  campaignBusy.value = true
  try {
    const n = await companyInsightsService.endPromotion(companyId.value, names, null)
    toastStore.success('Campanha terminada', `${n} ${n === 1 ? 'produto voltou' : 'produtos voltaram'} ao preço normal.`)
    await loadProducts()
  } catch (e) {
    toastStore.error('Não foi possível terminar a campanha', errorMessage(e))
  } finally {
    campaignBusy.value = false
  }
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])
</script>

<template>
  <div class="company-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Empresa</h1>
        <p class="page-subtitle">
          {{ tenantStore.currentCompany?.name }} · {{ restaurants.length }} {{ restaurants.length === 1 ? 'estabelecimento' : 'estabelecimentos' }}
        </p>
      </div>
      <div v-if="tab === 'overview' || tab === 'alerts'" class="filter-wrap">
        <Calendar :size="15" />
        <select v-model="period" class="filter-select" aria-label="Período">
          <option v-for="p in PERIODS" :key="p.key" :value="p.key">{{ p.label }}</option>
        </select>
      </div>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" :class="{ on: tab === 'overview' }" @click="tab = 'overview'"><BarChart3 :size="15" /> Visão geral</button>
      <button type="button" role="tab" :class="{ on: tab === 'alerts' }" @click="tab = 'alerts'">
        <ShieldAlert :size="15" /> Alertas
        <span v-if="alerts.length" class="tab-badge" :class="{ high: highAlerts > 0 }">{{ alerts.length }}</span>
      </button>
      <button type="button" role="tab" :class="{ on: tab === 'menu' }" @click="tab = 'menu'"><Copy :size="15" /> Distribuir menu</button>
      <button type="button" role="tab" :class="{ on: tab === 'campaigns' }" @click="tab = 'campaigns'"><Megaphone :size="15" /> Campanhas</button>
    </div>

    <!-- ===================== VISÃO GERAL ===================== -->
    <template v-if="tab === 'overview'">
      <div v-if="loading && !overview" class="loading-box">A carregar…</div>
      <template v-else-if="overview">
        <div class="metrics-grid">
          <MetricCard
            title="Faturação consolidada"
            :value="mt(overview.totals.revenue)"
            :icon="DollarSign"
            variant="primary"
            :subtitle="pctText(revenueGrowth)"
          />
          <MetricCard title="Pedidos" :value="overview.totals.orders.toLocaleString('pt-MZ')" :icon="ShoppingBag" variant="success" :subtitle="`${overview.totals.cancelled} cancelados`" />
          <MetricCard title="Ticket médio" :value="mt(overview.totals.averageTicket)" :icon="Receipt" variant="neutral" />
          <MetricCard title="Reembolsos" :value="overview.totals.refunds" :icon="XCircle" :variant="overview.totals.refunds ? 'warning' : 'neutral'" />
        </div>

        <section class="card">
          <h2 class="card-title">Comparação entre localizações</h2>
          <EmptyState v-if="!overview.restaurants.length" :icon="BarChart3" title="Sem estabelecimentos" />
          <div v-else class="table-wrap">
            <table class="cmp">
              <thead>
                <tr>
                  <th>Estabelecimento</th>
                  <th class="num">Faturação</th>
                  <th class="num">Variação</th>
                  <th class="num">Pedidos</th>
                  <th class="num">Ticket médio</th>
                  <th class="num">Cancelados</th>
                  <th class="num">Reembolsos</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in overview.restaurants" :key="r.id">
                  <td>
                    <strong>{{ r.name }}</strong>
                    <div class="bar"><span :style="{ width: `${(r.revenue / maxRevenue) * 100}%` }"></span></div>
                  </td>
                  <td class="num">{{ mt(r.revenue) }}</td>
                  <td class="num">
                    <span v-if="growth(r.revenue, r.prevRevenue) !== null" class="trend" :class="(growth(r.revenue, r.prevRevenue) ?? 0) >= 0 ? 'up' : 'down'">
                      <component :is="(growth(r.revenue, r.prevRevenue) ?? 0) >= 0 ? TrendingUp : TrendingDown" :size="13" />
                      {{ growth(r.revenue, r.prevRevenue) }}%
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="num">{{ r.orders }}</td>
                  <td class="num">{{ mt(r.averageTicket) }}</td>
                  <td class="num" :class="{ warn: r.cancellationRate >= 10 }">{{ r.cancelled }} <small>({{ r.cancellationRate }}%)</small></td>
                  <td class="num" :class="{ warn: r.refunds > 0 }">{{ r.refunds }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Desempenho dos produtos</h2>
          <EmptyState v-if="!overview.products.length" :icon="ShoppingBag" title="Sem vendas no período" />
          <div v-else class="table-wrap">
            <table class="cmp">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th class="num">Quantidade</th>
                  <th class="num">Faturação</th>
                  <th>Por localização</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in overview.products" :key="p.name">
                  <td><strong>{{ p.name }}</strong></td>
                  <td class="num">{{ p.quantity }}</td>
                  <td class="num">{{ mt(p.revenue) }}</td>
                  <td>
                    <span v-for="b in p.byRestaurant" :key="b.restaurantId" class="loc-chip">
                      {{ restaurantName(b.restaurantId) }}: {{ b.quantity }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <p class="footnote">
          <Users :size="13" /> As permissões de cada funcionário por localização gerem-se em
          <router-link to="/app/funcionarios">Funcionários</router-link>.
        </p>
      </template>
    </template>

    <!-- ===================== ALERTAS ===================== -->
    <template v-else-if="tab === 'alerts'">
      <p class="intro">
        Situações incomuns detetadas nos pedidos, pagamentos e mesas do período. Um alerta não é uma acusação: é um sinal para
        confirmar com a equipa.
      </p>
      <div v-if="loading && !alerts.length" class="loading-box">A analisar…</div>
      <div v-else-if="!alerts.length" class="all-good">
        <CheckCircle2 :size="20" /> Nenhuma situação incomum no período.
      </div>
      <ul v-else class="alerts">
        <li v-for="(a, i) in alerts" :key="i" :class="a.severity">
          <AlertTriangle :size="18" class="a-icon" />
          <div class="a-body">
            <div class="a-head">
              <strong>{{ ALERT_TEXT[a.kind].title }}</strong>
              <span class="a-sev">{{ a.severity === 'high' ? 'Prioridade alta' : 'A verificar' }}</span>
            </div>
            <p class="a-where">{{ a.restaurantName || restaurantName(a.restaurantId) }}<template v-if="a.amount"> · {{ mt(a.amount) }}</template></p>
            <p>{{ ALERT_TEXT[a.kind].describe(a) }}</p>
            <p class="a-action">{{ ALERT_TEXT[a.kind].action }}</p>
          </div>
        </li>
      </ul>
      <p class="footnote">Descontos manuais ainda não existem no TapMenu; quando existirem, também serão analisados aqui.</p>
    </template>

    <!-- ===================== DISTRIBUIR MENU ===================== -->
    <template v-else-if="tab === 'menu'">
      <section class="card">
        <h2 class="card-title">Copiar menu para outras localizações</h2>
        <p class="intro">
          As categorias com o mesmo nome são reutilizadas. Produtos que já existem no destino (mesmo nome) não são duplicados.
        </p>
        <label class="field">
          <span>Copiar de</span>
          <select v-model="sourceId" class="input">
            <option value="">Escolha o estabelecimento de origem</option>
            <option v-for="r in restaurants" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </label>

        <div v-if="sourceId" class="field">
          <span>Categorias</span>
          <div class="checks">
            <label v-for="c in sourceCategories" :key="c.id" class="check">
              <input type="checkbox" :checked="selectedCategories.includes(c.id)" @change="selectedCategories = toggle(selectedCategories, c.id)" />
              {{ c.name }}
            </label>
            <span v-if="!sourceCategories.length" class="muted">Este estabelecimento ainda não tem categorias.</span>
          </div>
        </div>

        <div v-if="sourceId" class="field">
          <span>Para</span>
          <div class="checks">
            <label v-for="r in restaurants.filter(x => x.id !== sourceId)" :key="r.id" class="check">
              <input type="checkbox" :checked="targetIds.includes(r.id)" @change="targetIds = toggle(targetIds, r.id)" />
              {{ r.name }}
            </label>
          </div>
        </div>

        <label v-if="sourceId" class="check">
          <input v-model="updateExisting" type="checkbox" />
          Atualizar preço, descrição e foto dos produtos que já existem no destino
        </label>

        <AppButton
          variant="primary"
          :loading="copying"
          :disabled="!sourceId || !targetIds.length || !selectedCategories.length"
          @click="copyMenu"
        >
          <Copy :size="15" /> Distribuir menu
        </AppButton>

        <div v-if="copyReport" class="table-wrap">
          <table class="cmp">
            <thead>
              <tr>
                <th>Destino</th>
                <th class="num">Categorias novas</th>
                <th class="num">Produtos copiados</th>
                <th class="num">Atualizados</th>
                <th class="num">Já existiam</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in copyReport" :key="r.restaurantId">
                <td>{{ r.name }}</td>
                <td class="num">{{ r.categoriesCreated }}</td>
                <td class="num">{{ r.productsCreated }}</td>
                <td class="num">{{ r.productsUpdated }}</td>
                <td class="num">{{ r.productsSkipped }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ===================== CAMPANHAS ===================== -->
    <template v-else>
      <section class="card">
        <h2 class="card-title">Nova campanha de preço</h2>
        <p class="intro">Aplique o mesmo desconto a produtos com o mesmo nome em várias localizações. O preço normal mantém-se guardado.</p>
        <div class="field">
          <span>Produtos</span>
          <div class="checks scroll">
            <label v-for="g in productGroups" :key="g.name" class="check">
              <input type="checkbox" :checked="campaignNames.includes(g.name)" @change="campaignNames = toggle(campaignNames, g.name)" />
              {{ g.name }} <small class="muted">({{ g.locations.length }} {{ g.locations.length === 1 ? 'local' : 'locais' }})</small>
            </label>
            <span v-if="productsLoaded && !productGroups.length" class="muted">Ainda não há produtos.</span>
            <span v-if="!productsLoaded" class="muted">A carregar produtos…</span>
          </div>
        </div>
        <label class="field narrow">
          <span>Desconto (%)</span>
          <input v-model.number="campaignDiscount" type="number" min="1" max="99" class="input" />
        </label>
        <div class="field">
          <span>Estabelecimentos <small class="muted">(nenhum escolhido = todos)</small></span>
          <div class="checks">
            <label v-for="r in restaurants" :key="r.id" class="check">
              <input type="checkbox" :checked="campaignRestaurants.includes(r.id)" @change="campaignRestaurants = toggle(campaignRestaurants, r.id)" />
              {{ r.name }}
            </label>
          </div>
        </div>
        <AppButton
          variant="primary"
          :loading="campaignBusy"
          :disabled="!campaignNames.length || campaignDiscount < 1 || campaignDiscount > 99"
          @click="applyCampaign"
        >
          <Tag :size="15" /> Aplicar campanha
        </AppButton>
      </section>

      <section class="card">
        <h2 class="card-title">Promoções ativas</h2>
        <EmptyState v-if="!activePromotions.length" :icon="Tag" title="Sem promoções ativas" />
        <ul v-else class="promos">
          <li v-for="g in activePromotions" :key="g.name">
            <div>
              <strong>{{ g.name }}</strong>
              <div class="promo-locs">
                <span v-for="p in g.locations.filter(x => x.isPromotion || x.promotionalPrice !== undefined)" :key="p.id" class="loc-chip">
                  {{ restaurantName(p.restaurantId) }}: {{ mt(p.promotionalPrice ?? p.price) }} <s>{{ mt(p.price) }}</s>
                </span>
              </div>
            </div>
            <AppButton variant="ghost" size="sm" :disabled="campaignBusy" @click="endCampaign([g.name])">Terminar</AppButton>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.company-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
  background: #fef3c7;
  color: #92400e;
  font-size: 0.7rem;
  line-height: 18px;
  text-align: center;
}

.tab-badge.high {
  background: #fee2e2;
  color: #991b1b;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.25rem;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.table-wrap {
  overflow-x: auto;
}

.cmp {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.cmp th {
  text-align: left;
  padding: 0.5rem 0.6rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.cmp td {
  padding: 0.6rem;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.num {
  text-align: right !important;
  white-space: nowrap;
}

.bar {
  margin-top: 0.3rem;
  height: 5px;
  background: var(--color-slate-100, #f1f5f9);
  border-radius: 999px;
  overflow: hidden;
  max-width: 220px;
}

.bar span {
  display: block;
  height: 100%;
  background: var(--color-primary-600, #2563eb);
  border-radius: inherit;
}

.trend {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-weight: 700;
}

.trend.up {
  color: #059669;
}

.trend.down {
  color: #dc2626;
}

.warn {
  color: #b45309;
  font-weight: 700;
}

.muted {
  color: var(--text-muted);
}

.loc-chip {
  display: inline-block;
  margin: 0.15rem 0.35rem 0.15rem 0;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--color-slate-100, #f1f5f9);
  font-size: 0.74rem;
  white-space: nowrap;
}

.loc-chip s {
  color: var(--text-muted);
  margin-left: 0.2rem;
}

.footnote,
.intro {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.footnote {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.loading-box,
.all-good {
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  background: #fff;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.all-good {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #166534;
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.alerts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alerts li {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: #fff;
  border: 1px solid var(--border-color);
  border-left: 4px solid #f59e0b;
  border-radius: var(--radius-lg);
}

.alerts li.high {
  border-left-color: #dc2626;
}

.a-icon {
  flex-shrink: 0;
  color: #d97706;
}

.alerts li.high .a-icon {
  color: #dc2626;
}

.a-body p {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
}

.a-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.a-sev {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
}

.alerts li.high .a-sev {
  background: #fee2e2;
  color: #991b1b;
}

.a-where {
  color: var(--text-muted);
  font-weight: 600;
}

.a-action {
  color: var(--text-muted);
  font-style: italic;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.field.narrow {
  max-width: 160px;
}

.input {
  padding: 0.55rem 0.7rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  max-width: 420px;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  font-weight: 500;
}

.checks.scroll {
  max-height: 220px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.promos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.promos li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--border-color);
}

.promo-locs {
  margin-top: 0.25rem;
}
</style>
