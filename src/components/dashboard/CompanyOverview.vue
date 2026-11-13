<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTenantStore } from '@/stores/tenant'
import { reportService, nfcTagService } from '@/services'
import { planAccessService } from '@/services/planAccessService'
import { Building2, Store, LayoutGrid, Nfc, Package, ShoppingBag, DollarSign, ArrowRight } from 'lucide-vue-next'

/**
 * Visão da EMPRESA (todos os estabelecimentos) para o responsável:
 * utilização do plano, mesas, tags, produtos, pedidos e vendas de hoje.
 * Os dados vêm do Supabase (RLS: só a empresa do utilizador).
 */
interface Row {
  id: string
  name: string
  tables: number
  tablesLimit: number | null
  occupied: number
  products: number
  productsLimit: number | null
  tags: number
  orders: number
  revenue: number
}

const router = useRouter()
const tenantStore = useTenantStore()

const planName = ref('')
const restaurantsUsed = ref(0)
const restaurantsLimit = ref<number | null>(null)
const rows = ref<Row[]>([])
const isLoading = ref(false)

const company = computed(() => tenantStore.currentCompany)

const load = async () => {
  const c = company.value
  if (!c) return
  isLoading.value = true
  try {
    const restaurants = tenantStore.allRestaurants.filter(r => r.tenantId === c.id)
    const [plan, restLimit] = await Promise.all([
      planAccessService.getTenantPlan(c.id),
      planAccessService.isLimitReached(c.id, 'RESTAURANTS')
    ])
    planName.value = plan?.name ?? '—'
    restaurantsUsed.value = restLimit.current
    restaurantsLimit.value = restLimit.limit

    rows.value = await Promise.all(
      restaurants.map(async r => {
        const [m, tables, products, tags] = await Promise.all([
          reportService.getDashboardMetrics(r.id, 1),
          planAccessService.isLimitReached(c.id, 'TABLES', r.id),
          planAccessService.isLimitReached(c.id, 'PRODUCTS', r.id),
          nfcTagService.getTags(r.id)
        ])
        return {
          id: r.id,
          name: r.name,
          tables: tables.current,
          tablesLimit: tables.limit,
          occupied: m.occupiedTables,
          products: products.current,
          productsLimit: products.limit,
          tags: tags.filter(t => t.tableId && (t.status === 'configured' || t.status === 'active')).length,
          orders: m.periodOrders,
          revenue: m.periodRevenue
        }
      })
    )
  } catch (e) {
    console.error('Erro ao carregar a visão da empresa', e)
  } finally {
    isLoading.value = false
  }
}

watch(() => [company.value?.id, tenantStore.allRestaurants.length], load, { immediate: true })

const sum = (k: keyof Row) => rows.value.reduce((acc, r) => acc + (r[k] as number), 0)
const totals = computed(() => ({
  tables: sum('tables'),
  occupied: sum('occupied'),
  products: sum('products'),
  tags: sum('tags'),
  orders: sum('orders'),
  revenue: sum('revenue')
}))

const fmtLimit = (v: number, limit: number | null) => (limit === null ? `${v} / ∞` : `${v} / ${limit}`)
const pct = (v: number, limit: number | null) => (limit ? Math.min(100, Math.round((v / limit) * 100)) : 0)
</script>

<template>
  <section v-if="company" class="overview">
    <header class="ov-head">
      <div>
        <h2><Building2 :size="18" /> {{ company.name }}</h2>
        <span class="muted">Plano <strong>{{ planName }}</strong> · visão de todos os estabelecimentos (hoje)</span>
      </div>
      <button type="button" class="link-btn" @click="router.push('/app/meu-plano')">
        Utilização do plano <ArrowRight :size="14" />
      </button>
    </header>

    <div class="kpis">
      <div class="kpi">
        <span class="kpi-label"><Store :size="14" /> Estabelecimentos</span>
        <strong>{{ fmtLimit(restaurantsUsed, restaurantsLimit) }}</strong>
        <div v-if="restaurantsLimit" class="bar"><span :style="{ width: pct(restaurantsUsed, restaurantsLimit) + '%' }" /></div>
      </div>
      <div class="kpi">
        <span class="kpi-label"><LayoutGrid :size="14" /> Mesas</span>
        <strong>{{ totals.tables }}</strong>
        <span class="muted">{{ totals.occupied }} ocupadas · {{ totals.tables - totals.occupied }} livres</span>
      </div>
      <div class="kpi">
        <span class="kpi-label"><Nfc :size="14" /> Tags NFC</span>
        <strong>{{ totals.tags }}</strong>
        <span class="muted">configuradas</span>
      </div>
      <div class="kpi">
        <span class="kpi-label"><Package :size="14" /> Produtos</span>
        <strong>{{ totals.products }}</strong>
      </div>
      <div class="kpi">
        <span class="kpi-label"><ShoppingBag :size="14" /> Pedidos hoje</span>
        <strong>{{ totals.orders }}</strong>
      </div>
      <div class="kpi">
        <span class="kpi-label"><DollarSign :size="14" /> Vendas hoje</span>
        <strong>{{ totals.revenue.toLocaleString('pt-MZ') }} MT</strong>
      </div>
    </div>

    <div v-if="rows.length > 1" class="table-scroll">
      <table class="ov-table">
        <thead>
          <tr>
            <th>Estabelecimento</th>
            <th>Mesas</th>
            <th>Ocupadas</th>
            <th>Produtos</th>
            <th>Tags</th>
            <th>Pedidos</th>
            <th class="num">Vendas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>
              <button type="button" class="name-btn" @click="tenantStore.setRestaurant(r.id)">{{ r.name }}</button>
            </td>
            <td>{{ fmtLimit(r.tables, r.tablesLimit) }}</td>
            <td>{{ r.occupied }}</td>
            <td>{{ fmtLimit(r.products, r.productsLimit) }}</td>
            <td>{{ r.tags }}</td>
            <td>{{ r.orders }}</td>
            <td class="num">{{ r.revenue.toLocaleString('pt-MZ') }} MT</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="isLoading" class="muted">A atualizar…</p>
  </section>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.ov-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.ov-head h2 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1.0625rem;
  font-weight: 800;
  color: #0f172a;
}

.muted {
  font-size: 0.8125rem;
  color: #64748b;
}

.link-btn,
.name-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  padding: 0;
  color: #0369a1;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.name-btn {
  color: #0f172a;
}

.link-btn:hover,
.name-btn:hover {
  text-decoration: underline;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.85rem;
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 10px;
}

.kpi-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.kpi strong {
  font-size: 1.25rem;
  color: #0f172a;
}

.bar {
  height: 5px;
  background: #e2e8f0;
  border-radius: 99px;
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  background: #0ea5e9;
}

.table-scroll {
  overflow-x: auto;
}

.ov-table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.ov-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
}

.ov-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.num {
  text-align: right !important;
}
</style>
