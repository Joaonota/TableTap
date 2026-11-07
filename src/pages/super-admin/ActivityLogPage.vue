<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { auditService } from '@/services'
import type { PlatformAuditLog } from '@/types'
import { Activity, ShieldCheck, UserCheck, Clock, Search, Filter } from 'lucide-vue-next'

const logs = ref<PlatformAuditLog[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedActionFilter = ref('all')

onMounted(async () => {
  try {
    logs.value = await auditService.getLogs()
  } finally {
    isLoading.value = false
  }
})

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    const matchesSearch = !searchQuery.value ||
      log.userName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesAction = selectedActionFilter.value === 'all' || log.action.includes(selectedActionFilter.value)

    return matchesSearch && matchesAction
  })
})

const formatTime = (isoString?: string) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  return `${d.toLocaleDateString('pt-MZ')} às ${d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}`
}

const getActionColorClass = (action: string) => {
  if (action.includes('upgrade') || action.includes('renewed')) return 'text-success'
  if (action.includes('locked') || action.includes('suspended')) return 'text-warning'
  if (action.includes('delete') || action.includes('refused')) return 'text-danger'
  return 'text-primary'
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Registo de Atividades & Auditoria</h1>
        <p class="page-subtitle">Rastreamento de acessos, eventos de faturação, modificações de planos e segurança</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filters-bar">
      <div class="search-wrap">
        <Search :size="16" class="search-icon" />
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Pesquisar por utilizador, ação, recurso ou detalhe..."
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <Filter :size="15" />
        <select v-model="selectedActionFilter" class="filter-select">
          <option value="all">Todas as Ações</option>
          <option value="plan">Planos & Subscrições</option>
          <option value="menu">Menu & Tema</option>
          <option value="nfc">Acesso NFC</option>
          <option value="company">Empresas (Tenants)</option>
        </select>
      </div>
    </div>

    <!-- Logs Container -->
    <div class="super-card">
      <div v-if="isLoading" class="loading-state">
        Carregando registos de auditoria...
      </div>

      <div v-else class="logs-timeline">
        <div
          v-for="log in filteredLogs"
          :key="log.id"
          class="log-row"
        >
          <div class="log-indicator">
            <div class="log-icon">
              <Activity :size="15" />
            </div>
          </div>

          <div class="log-body">
            <div class="log-header">
              <span class="log-action font-mono" :class="getActionColorClass(log.action)">
                {{ log.action }}
              </span>
              <span class="log-time">
                <Clock :size="12" />
                {{ formatTime(log.createdAt) }}
              </span>
            </div>

            <div class="log-resource">
              Alvo: <strong>{{ log.resource }}</strong>
              <span v-if="log.tenantId" class="tenant-pill font-mono">{{ log.tenantId }}</span>
            </div>

            <p class="log-details">{{ log.details }}</p>

            <div class="log-user">
              <UserCheck :size="13" />
              <span>Operador: <strong>{{ log.userName }}</strong></span>
            </div>
          </div>
        </div>

        <div v-if="filteredLogs.length === 0" class="empty-state">
          Nenhum registo de auditoria corresponde aos filtros atuais.
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

.filters-bar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.search-wrap {
  display: flex;
  align-items: center;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0 0.85rem;
  flex: 1;
  max-width: 450px;
}

.search-icon {
  color: #64748b;
  margin-right: 0.5rem;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.65rem 0;
  color: #ffffff;
  font-size: 0.875rem;
  outline: none;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #94a3b8;
}

.filter-select {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  color: #ffffff;
  font-size: 0.875rem;
  outline: none;
}

.super-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 1.25rem;
}

.loading-state,
.empty-state {
  color: #94a3b8;
  text-align: center;
  padding: 3rem 0;
  font-size: 0.875rem;
}

.logs-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.log-row {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
}

.log-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.log-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-body {
  flex: 1;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-action {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
}

.log-time {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.log-resource {
  font-size: 0.8125rem;
  color: #cbd5e1;
  margin: 0.35rem 0 0.2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tenant-pill {
  font-size: 0.6875rem;
  color: #94a3b8;
  background: #1e293b;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.log-details {
  font-size: 0.8125rem;
  color: #94a3b8;
  margin: 0.25rem 0 0.65rem;
  line-height: 1.4;
}

.log-user {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: #64748b;
}

.log-user strong {
  color: #cbd5e1;
}

.text-success { color: #34d399; }
.text-warning { color: #fbbf24; }
.text-danger { color: #f87171; }
.text-primary { color: #38bdf8; }
</style>
