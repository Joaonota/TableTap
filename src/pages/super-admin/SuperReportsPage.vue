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
          <span class="kpi-label">Taxa de Renovação</span>
          <div class="kpi-val">96.5%</div>
          <span class="kpi-sub">Retenção de subscrições</span>
        </div>
      </div>
    </div>

    <!-- Detailed Analytics Cards -->
    <div class="reports-grid">
      <div class="super-card">
        <h3 class="report-card-title">Resumo Financeiro da Plataforma</h3>
        <p class="report-card-desc">Indicadores calculados com base nos contratos mock e pagamentos realizados</p>

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
                <td>Taxa de Churn Estimada:</td>
                <td class="font-bold text-green">1.8% / mês</td>
              </tr>
              <tr>
                <td>LTV Médio Estimado (Customer Lifetime Value):</td>
                <td class="font-bold text-primary">124.000 MT</td>
              </tr>
              <tr>
                <td>Período Médio de Permanência:</td>
                <td class="font-bold text-white">18.4 meses</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="super-card">
        <h3 class="report-card-title">Distribuição de Receita por Nível de Plano</h3>
        <p class="report-card-desc">Contribuição relativa de cada pacote para o faturamento global</p>

        <div class="revenue-tier-list">
          <div class="tier-item">
            <div class="tier-head">
              <strong>Plano Enterprise</strong>
              <span class="font-mono">9.990 MT (60.6%)</span>
            </div>
            <div class="tier-bar"><div class="tier-fill" style="width: 61%"></div></div>
          </div>

          <div class="tier-item">
            <div class="tier-head">
              <strong>Plano Pro</strong>
              <span class="font-mono">4.490 MT (27.2%)</span>
            </div>
            <div class="tier-bar"><div class="tier-fill" style="width: 27%"></div></div>
          </div>

          <div class="tier-item">
            <div class="tier-head">
              <strong>Plano Básico</strong>
              <span class="font-mono">1.990 MT (12.2%)</span>
            </div>
            <div class="tier-bar"><div class="tier-fill" style="width: 12%"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  color: #ffffff;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
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
  background: #1e293b;
  border: 1px solid #334155;
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

.kpi-icon-wrap.mrr { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.kpi-icon-wrap.arpu { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
.kpi-icon-wrap.rate { background: rgba(168, 85, 247, 0.15); color: #c084fc; }

.kpi-info {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
}

.kpi-val {
  font-size: 1.35rem;
  font-weight: 800;
  color: #ffffff;
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
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 1.25rem;
}

.report-card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.report-card-desc {
  font-size: 0.7813rem;
  color: #94a3b8;
  margin: 0.25rem 0 1.25rem;
}

.report-summary-table {
  width: 100%;
  border-collapse: collapse;
}

.report-summary-table td {
  padding: 0.75rem 0;
  border-bottom: 1px solid #334155;
  font-size: 0.8438rem;
  color: #cbd5e1;
}

.report-summary-table tr:last-child td {
  border-bottom: none;
}

.text-white { color: #ffffff; }
.text-yellow { color: #fbbf24; }
.text-green { color: #34d399; }
.text-primary { color: #38bdf8; }
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
  color: #ffffff;
  margin-bottom: 0.35rem;
}

.tier-bar {
  height: 8px;
  background: #0f172a;
  border-radius: 4px;
  overflow: hidden;
}

.tier-fill {
  height: 100%;
  background: #0d7a5f;
  border-radius: 4px;
}
</style>

