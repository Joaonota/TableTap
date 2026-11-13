<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { usePlatformStore } from '@/stores/platform'
import AppButton from '@/components/ui/AppButton.vue'
import { Download, TrendingUp, BarChart3, PieChart, ShieldCheck, DollarSign } from 'lucide-vue-next'

const platformStore = usePlatformStore()
const isLoading = ref(true)

onMounted(async () => {
  try {
    await platformStore.fetchPlatformData()
  } finally {
    isLoading.value = false
  }
})

const arpu = computed(() => {
  const activeCount = platformStore.activeSubscriptionsCount
  return activeCount > 0 ? Math.round(platformStore.mrr / activeCount) : 0
})

/** Subscrições que terminaram (canceladas ou expiradas). */
const endedCount = computed(() => platformStore.subscriptions.filter(s => s.status === 'cancelled' || s.status === 'expired').length)

/** Retenção: subscrições que continuam (ativas, em teste ou suspensas) sobre o total. */
const retentionRate = computed(() => {
  const total = platformStore.subscriptions.length
  return total ? Math.round(((total - endedCount.value) / total) * 1000) / 10 : null
})

/** Tempo médio (meses) desde o início de cada subscrição ainda em curso. */
const averageTenureMonths = computed(() => {
  const ongoing = platformStore.subscriptions.filter(s => s.status !== 'cancelled' && s.status !== 'expired')
  if (!ongoing.length) return null
  const months = ongoing.map(s => (Date.now() - new Date(s.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  return Math.round((months.reduce((a, b) => a + b, 0) / ongoing.length) * 10) / 10
})

/** Receita mensal (MRR) por plano, só subscrições ativas. */
const revenueByPlan = computed(() => {
  const map = new Map<string, number>()
  for (const s of platformStore.subscriptions.filter(s => s.status === 'active')) {
    map.set(s.planName, (map.get(s.planName) ?? 0) + s.monthlyPrice)
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0)
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount, percent: total ? Math.round((amount / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount)
})

const exportPlatformCsv = () => {
  const headers = ['Tenant ID', 'Empresa', 'Plano', 'Valor Mensal (MT)', 'Estado', 'Data Inicio', 'Renovacao']
  const rows = platformStore.subscriptions.map(s => [
    s.tenantId,
    `"${s.companyName.replace(/"/g, '""')}"`,
    s.planName,
    s.monthlyPrice,
    s.status,
    s.startDate,
    s.renewalDate
  ])

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `tapmenu_relatorio_saas_${new Date().toISOString().substring(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Relatórios Executivos SaaS</h1>
        <p class="page-subtitle">Métricas financeiras globais, crescimento de assinaturas e exportação de dados analíticos</p>
      </div>

      <AppButton variant="primary" @click="exportPlatformCsv">
        <Download :size="16" />
        <span>Exportar Relatório CSV</span>
      </AppButton>
    </div>

    <!-- Executive KPIs -->
    <div class="kpis-grid">
      <div class="kpi-card">
        <div class="kpi-icon-wrap mrr">
          <DollarSign :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">MRR Consolidado</span>
          <div class="kpi-val font-mono">{{ platformStore.mrr.toLocaleString('pt-MZ') }} MT</div>
          <span class="kpi-sub">Receita líquida recorrente</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap arpu">
          <TrendingUp :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">ARPU (Receita Média por Cliente)</span>
          <div class="kpi-val font-mono">{{ arpu.toLocaleString('pt-MZ') }} MT</div>
          <span class="kpi-sub">Média por empresa ativa</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap rate">
          <BarChart3 :size="20" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Taxa de Retenção</span>
          <div class="kpi-val">{{ retentionRate === null ? '—' : `${retentionRate.toLocaleString('pt-MZ')}%` }}</div>
          <span class="kpi-sub">Subscrições que não foram canceladas nem expiraram</span>
        </div>
      </div>
    </div>

    <!-- Detailed Analytics Cards -->
    <div class="reports-grid">
      <div class="super-card">
        <h3 class="report-card-title">Resumo Financeiro da Plataforma</h3>
        <p class="report-card-desc">Indicadores calculados a partir das subscrições registadas</p>

        <div class="metrics-table-wrap">
          <table class="report-summary-table">
            <tbody>
              <tr>
                <td>Subscrições Ativas:</td>
                <td class="font-bold text-white">{{ platformStore.activeSubscriptionsCount }}</td>
              </tr>
              <tr>
                <td>Subscrições em Período Experimental:</td>
                <td class="font-bold text-yellow">{{ platformStore.trialSubscriptionsCount }}</td>
              </tr>
              <tr>
                <td>Subscrições canceladas ou expiradas:</td>
                <td class="font-bold">{{ endedCount }}</td>
              </tr>
              <tr>
                <td>Permanência média (subscrições em curso):</td>
                <td class="font-bold">{{ averageTenureMonths === null ? '—' : `${averageTenureMonths.toLocaleString('pt-MZ')} meses` }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="super-card">
        <h3 class="report-card-title">Distribuição de Receita por Nível de Plano</h3>
        <p class="report-card-desc">Receita mensal recorrente (MRR) das subscrições ativas, por plano</p>

        <div v-if="!revenueByPlan.length" class="empty-block">Ainda não há subscrições ativas a gerar receita.</div>
        <div v-else class="revenue-tier-list">
          <div v-for="tier in revenueByPlan" :key="tier.name" class="tier-item">
            <div class="tier-head">
              <strong>{{ tier.name }}</strong>
              <span class="font-mono">{{ tier.amount.toLocaleString('pt-MZ') }} MT ({{ tier.percent.toLocaleString('pt-MZ') }}%)</span>
            </div>
            <div class="tier-bar"><div class="tier-fill" :style="{ width: `${tier.percent}%` }"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-block {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-muted);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-md);
}

.super-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.2rem;
}

.kpis-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .kpis-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.kpi-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-icon-wrap.mrr { background: rgba(16, 185, 129, 0.15); color: #047857; }
.kpi-icon-wrap.arpu { background: rgba(56, 189, 248, 0.15); color: #0369a1; }
.kpi-icon-wrap.rate { background: rgba(168, 85, 247, 0.15); color: #7e22ce; }

.kpi-info {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

.kpi-val {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0.15rem 0;
}

.kpi-sub {
  font-size: 0.7188rem;
  color: #64748b;
}

.reports-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .reports-grid {
    grid-template-columns: 1fr;
  }
}

.super-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
}

.report-card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.report-card-desc {
  font-size: 0.7813rem;
  color: #64748b;
  margin: 0.25rem 0 1.25rem;
}

.report-summary-table {
  width: 100%;
  border-collapse: collapse;
}

.report-summary-table td {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.8438rem;
  color: #334155;
}

.report-summary-table tr:last-child td {
  border-bottom: none;
}

.text-white { color: #0f172a; }
.text-yellow { color: #b45309; }
.text-green { color: #047857; }
.text-primary { color: #0369a1; }
.font-bold { font-weight: 700; text-align: right; }

.revenue-tier-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tier-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: #0f172a;
  margin-bottom: 0.35rem;
}

.tier-bar {
  height: 8px;
  background: #f8fafc;
  border-radius: 4px;
  overflow: hidden;
}

.tier-fill {
  height: 100%;
  background: #0d7a5f;
  border-radius: 4px;
}
</style>

