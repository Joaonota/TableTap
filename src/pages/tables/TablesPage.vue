<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { TABLE_AREAS, type Table, type TableStatus } from '@/types'
import type { TableInput } from '@/services'
import { useTableStore } from '@/stores/table'
import { useTenantStore } from '@/stores/tenant'
import { useNfcTagStore } from '@/stores/nfcTag'
import { useServiceRequestStore } from '@/stores/serviceRequest'
import { effectiveTableStatus, formatDuration, formatStartTime } from '@/domain/tableRules'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PlanLimitNotice from '@/components/plans/PlanLimitNotice.vue'
import { usePlanLimit } from '@/composables/usePlanLimit'
import PublicUrlField from '@/components/ui/PublicUrlField.vue'
import QrCodeModal from '@/components/ui/QrCodeModal.vue'
import TableGrid from '@/components/tables/TableGrid.vue'
import TableStatusBadge from '@/components/tables/TableStatusBadge.vue'
import TableFormModal from '@/components/tables/TableFormModal.vue'
import TableDetailDrawer from '@/components/tables/TableDetailDrawer.vue'
import NfcTagStatusBadge from '@/components/nfc-tags/NfcTagStatusBadge.vue'
import { LayoutGrid, Rows3, Plus, Search, Armchair, Loader2 } from 'lucide-vue-next'

const tableStore = useTableStore()
const tenantStore = useTenantStore()
const nfcTagStore = useNfcTagStore()
const serviceRequestStore = useServiceRequestStore()

const viewMode = ref<'grid' | 'list'>('grid')
const statusFilter = ref<'all' | TableStatus>('all')
const areaFilter = ref<'all' | string>('all')
const search = ref('')

const selectedTableId = ref<string | null>(null)
const isFormOpen = ref(false)
const editingTable = ref<Table | null>(null)
const isSaving = ref(false)
const qrTable = ref<Table | null>(null)

/** Limite de mesas do plano (por restaurante). */
const tablesLimit = usePlanLimit('TABLES')
watch(() => tableStore.tables.length, () => tablesLimit.refresh())

onMounted(async () => {
  await Promise.all([tableStore.loadTables(), serviceRequestStore.loadRequests()])
})

const filteredTables = computed(() => {
  const term = search.value.trim().toLowerCase()
  return tableStore.tables.filter(t => {
    if (statusFilter.value !== 'all' && effectiveTableStatus(t) !== statusFilter.value) return false
    if (areaFilter.value !== 'all' && t.area !== areaFilter.value) return false
    if (term && !`${t.number} ${t.name ?? ''} ${t.area}`.toLowerCase().includes(term)) return false
    return true
  })
})

const pendingRequestsByTable = computed(() => {
  const map = new Map<string, number>()
  for (const r of serviceRequestStore.requests) {
    if (r.status === 'new' || r.status === 'in_progress') map.set(r.tableId, (map.get(r.tableId) ?? 0) + 1)
  }
  return map
})

const statusCards = computed(() => [
  { key: 'all' as const, label: 'Total', value: tableStore.counts.total },
  { key: 'free' as const, label: 'Livres', value: tableStore.counts.free },
  { key: 'occupied' as const, label: 'Ocupadas', value: tableStore.counts.occupied },
  { key: 'unavailable' as const, label: 'Indisponíveis', value: tableStore.counts.unavailable }
])

const hasFilters = computed(() => statusFilter.value !== 'all' || areaFilter.value !== 'all' || !!search.value.trim())
const clearFilters = () => {
  statusFilter.value = 'all'
  areaFilter.value = 'all'
  search.value = ''
}

const openCreate = () => {
  if (!tablesLimit.guard()) return
  editingTable.value = null
  isFormOpen.value = true
}

const openEdit = (tableId: string) => {
  editingTable.value = tableStore.tables.find(t => t.id === tableId) ?? null
  isFormOpen.value = true
}

const saveTable = async (input: TableInput) => {
  isSaving.value = true
  try {
    const result = editingTable.value
      ? await tableStore.updateTable(editingTable.value.id, input)
      : await tableStore.createTable(input)
    if (result) {
      isFormOpen.value = false
      if (!editingTable.value) selectedTableId.value = result.id
    }
  } finally {
    isSaving.value = false
  }
}

</script>

<template>
  <div class="tables-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Mesas</h1>
        <p class="page-subtitle">Estado em tempo real, sessões, URL permanente e etiqueta NFC de cada mesa.</p>
      </div>
      <div class="header-actions">
        <div class="view-toggle" role="group" aria-label="Modo de visualização">
          <button type="button" class="toggle-btn" :class="{ 'is-active': viewMode === 'grid' }" @click="viewMode = 'grid'">
            <LayoutGrid :size="15" /> <span>Grelha</span>
          </button>
          <button type="button" class="toggle-btn" :class="{ 'is-active': viewMode === 'list' }" @click="viewMode = 'list'">
            <Rows3 :size="15" /> <span>Lista</span>
          </button>
        </div>
        <AppButton variant="primary" :disabled="tablesLimit.isReached.value" :title="tablesLimit.message.value || undefined" @click="openCreate">
          <template #icon-left><Plus :size="16" /></template>
          Nova mesa
        </AppButton>
      </div>
    </header>

    <PlanLimitNotice :evaluation="tablesLimit.evaluation.value" />

    <!-- Contadores por estado (clicáveis como filtro) -->
    <div class="status-cards">
      <button
        v-for="card in statusCards"
        :key="card.key"
        type="button"
        class="status-card"
        :class="[`is-${card.key}`, { 'is-selected': statusFilter === card.key }]"
        @click="statusFilter = card.key"
      >
        <span class="status-value">{{ card.value }}</span>
        <span class="status-label">{{ card.label }}</span>
      </button>
    </div>

    <!-- Filtros -->
    <div class="filters">
      <label class="search">
        <Search :size="15" />
        <input v-model="search" type="search" placeholder="Procurar mesa, nome ou área" aria-label="Procurar mesa" />
      </label>
      <select v-model="statusFilter" aria-label="Filtrar por estado">
        <option value="all">Todos os estados</option>
        <option value="free">Livre</option>
        <option value="occupied">Ocupada</option>
        <option value="unavailable">Indisponível</option>
      </select>
      <select v-model="areaFilter" aria-label="Filtrar por área">
        <option value="all">Todas as áreas</option>
        <option v-for="area in TABLE_AREAS" :key="area" :value="area">{{ area }}</option>
      </select>
    </div>

    <!-- Conteúdo -->
    <div v-if="tableStore.isLoading && !tableStore.hasLoaded" class="loading">
      <Loader2 :size="20" class="spin" /> A carregar mesas…
    </div>

    <EmptyState
      v-else-if="tableStore.tables.length === 0"
      :icon="Armchair"
      title="Ainda não há mesas"
      description="Crie as mesas do restaurante. Cada mesa recebe uma URL permanente para a etiqueta NFC e para o QR Code."
    >
      <AppButton variant="primary" :disabled="tablesLimit.isReached.value" :title="tablesLimit.message.value || undefined" @click="openCreate">
        <template #icon-left><Plus :size="16" /></template>
        Criar primeira mesa
      </AppButton>
    </EmptyState>

    <EmptyState v-else-if="filteredTables.length === 0" :icon="Search" title="Nenhuma mesa corresponde aos filtros">
      <AppButton v-if="hasFilters" variant="secondary" size="sm" @click="clearFilters">Limpar filtros</AppButton>
    </EmptyState>

    <TableGrid
      v-else-if="viewMode === 'grid'"
      :tables="filteredTables"
      :sessions-by-table="tableStore.activeSessionByTableId"
      :tags-by-table="nfcTagStore.tagByTableId"
      :pending-requests-by-table="pendingRequestsByTable"
      @select="t => (selectedTableId = t.id)"
    />

    <div v-else class="list-card">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mesa</th>
              <th>Área</th>
              <th>Lugares</th>
              <th>Estado</th>
              <th>Sessão</th>
              <th class="num">Total</th>
              <th>Etiqueta NFC</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in filteredTables" :key="t.id" class="clickable" @click="selectedTableId = t.id">
              <td>
                <strong>Mesa {{ t.number }}</strong>
                <span class="sub">{{ t.name }}</span>
              </td>
              <td>{{ t.area }}</td>
              <td>{{ t.capacity }}</td>
              <td><TableStatusBadge :table="t" /></td>
              <td>
                <template v-if="tableStore.activeSessionByTableId.get(t.id)">
                  {{ formatStartTime(tableStore.activeSessionByTableId.get(t.id)!.startedAt) }}
                  <span class="sub">{{ formatDuration(tableStore.activeSessionByTableId.get(t.id)!.startedAt) }}</span>
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">
                <template v-if="tableStore.activeSessionByTableId.get(t.id)">
                  {{ tableStore.activeSessionByTableId.get(t.id)!.total.toLocaleString('pt-MZ') }} MT
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <div v-if="nfcTagStore.tagByTableId.get(t.id)" class="tag-cell">
                  <code>{{ nfcTagStore.tagByTableId.get(t.id)!.code }}</code>
                  <NfcTagStatusBadge :status="nfcTagStore.tagByTableId.get(t.id)!.status" />
                </div>
                <span v-else class="muted">Sem etiqueta</span>
              </td>
              <td class="url-cell" @click.stop>
                <PublicUrlField :url="tableStore.tableUrl(t)" compact @show-qr="qrTable = t" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <TableDetailDrawer :table-id="selectedTableId" @close="selectedTableId = null" @edit="openEdit" />

    <TableFormModal
      :is-open="isFormOpen"
      :table="editingTable"
      :existing-tables="tableStore.tables"
      :restaurant-slug="tenantStore.currentRestaurant?.slug ?? ''"
      :is-saving="isSaving"
      @close="isFormOpen = false"
      @save="saveTable"
    />

    <QrCodeModal
      v-if="qrTable"
      :is-open="!!qrTable"
      :url="tableStore.tableUrl(qrTable)"
      :title="`QR Code — Mesa ${qrTable.number}`"
      :subtitle="tenantStore.currentRestaurant?.name"
      :filename="`qr-${tenantStore.currentRestaurant?.slug ?? 'mesa'}-${qrTable.slug}`"
      @close="qrTable = null"
    />
  </div>
</template>

<style scoped>
.tables-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.view-toggle {
  display: flex;
  padding: 0.2rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--color-neutral-100);
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
}

.toggle-btn.is-active {
  background: #fff;
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.status-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.875rem 1rem;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.status-card:hover {
  border-color: var(--color-primary-300);
}

.status-card.is-selected {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 2px rgba(30, 64, 175, 0.12);
}

.status-value {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--text-main);
}

.is-free .status-value {
  color: var(--color-success-600);
}

.is-occupied .status-value {
  color: var(--color-primary-700);
}

.is-unavailable .status-value {
  color: var(--color-neutral-500);
}

.status-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}

.filters {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.search {
  flex: 1 1 240px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-muted);
}

.search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  padding: 0.55rem 0;
  font-size: 0.875rem;
  background: transparent;
}

.filters select {
  flex: 0 1 200px;
  padding: 0.55rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #fff;
  font-size: 0.8125rem;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  justify-content: center;
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

.list-card {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th,
.data-table td {
  padding: 0.7rem 0.875rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

.data-table th {
  background: var(--color-neutral-50);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.data-table tr:last-child td {
  border-bottom: none;
}

.clickable {
  cursor: pointer;
}

.clickable:hover td {
  background: var(--color-neutral-50);
}

.sub {
  display: block;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.muted {
  color: var(--text-muted);
}

.num {
  text-align: right !important;
  white-space: nowrap;
}

.tag-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tag-cell code {
  font-size: 0.75rem;
}

.url-cell {
  min-width: 240px;
  max-width: 300px;
}

@media (max-width: 720px) {
  .status-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filters select {
    flex: 1 1 140px;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
