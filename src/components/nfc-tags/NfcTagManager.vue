<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { NfcTag, NfcTagStatus, Restaurant } from '@/types'
import type { RegisterNfcTagsInput } from '@/services'
import { useNfcTagStore } from '@/stores/nfcTag'
import { NFC_TAG_STATUS_LABELS } from '@/domain/nfcTagRules'
import { toAbsoluteUrl } from '@/domain/publicUrl'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PublicUrlField from '@/components/ui/PublicUrlField.vue'
import QrCodeModal from '@/components/ui/QrCodeModal.vue'
import NfcTagStatusBadge from './NfcTagStatusBadge.vue'
import NfcTagDrawer from './NfcTagDrawer.vue'
import NfcTagRegisterModal from './NfcTagRegisterModal.vue'
import ExternalConfigNotice from './ExternalConfigNotice.vue'
import { Search, Nfc, PackagePlus, Download, Loader2, ChevronRight } from 'lucide-vue-next'

/**
 * Lista e gestão das etiquetas NFC.
 *  - scope 'restaurant': etiquetas do restaurante atual (painel do restaurante);
 *  - scope 'platform':  todas as etiquetas (equipa TapMenu) — inclui registo de
 *    novas etiquetas, registo da configuração física e exportação da fila de preparação.
 */
const props = defineProps<{
  scope: 'restaurant' | 'platform'
  restaurants: Restaurant[]
}>()

const store = useNfcTagStore()

type Filter = 'all' | 'to_prepare' | NfcTagStatus
const statusFilter = ref<Filter>('all')
const restaurantFilter = ref('all')
const search = ref('')
const selectedTagId = ref<string | null>(null)
const qrTag = ref<NfcTag | null>(null)
const isRegisterOpen = ref(false)
const isRegistering = ref(false)

const restaurantsById = computed(() => new Map(props.restaurants.map(r => [r.id, r])))

watch(
  () => props.restaurants.map(r => r.id).join(','),
  ids => {
    if (ids) store.load(props.restaurants.map(r => r.id))
  },
  { immediate: true }
)

/** Etiquetas com mesa que a equipa tem de gravar (ou regravar). */
const needsPreparation = (t: NfcTag) => !!t.tableId && (t.status === 'pending' || t.status === 'reassignment_pending')

const filters = computed(() => {
  const scoped = store.tags.filter(t => restaurantFilter.value === 'all' || t.restaurantId === restaurantFilter.value)
  const count = (fn: (t: NfcTag) => boolean) => scoped.filter(fn).length
  const list: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: scoped.length },
    { key: 'to_prepare', label: 'A preparar', count: count(needsPreparation) },
    ...(['pending', 'configured', 'active', 'reassignment_pending', 'disabled'] as NfcTagStatus[]).map(s => ({
      key: s as Filter,
      label: NFC_TAG_STATUS_LABELS[s],
      count: count(t => t.status === s)
    }))
  ]
  return list
})

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return store.tags
    .filter(t => restaurantFilter.value === 'all' || t.restaurantId === restaurantFilter.value)
    .filter(t => {
      if (statusFilter.value === 'all') return true
      if (statusFilter.value === 'to_prepare') return needsPreparation(t)
      return t.status === statusFilter.value
    })
    .filter(t => {
      if (!term) return true
      const table = t.tableId ? store.tablesById.get(t.tableId) : undefined
      const hay = `${t.code} ${table ? `mesa ${table.number} ${table.name ?? ''}` : ''} ${restaurantsById.value.get(t.restaurantId)?.name ?? ''}`
      return hay.toLowerCase().includes(term)
    })
})

const tableText = (t: NfcTag) => {
  const table = t.tableId ? store.tablesById.get(t.tableId) : undefined
  return table ? `Mesa ${table.number}` : '—'
}
const urlOf = (t: NfcTag) => (t.targetPath ? toAbsoluteUrl(t.targetPath) : '')
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

const register = async (input: RegisterNfcTagsInput) => {
  isRegistering.value = true
  const created = await store.register(input)
  isRegistering.value = false
  if (created) {
    isRegisterOpen.value = false
    statusFilter.value = 'all'
    restaurantFilter.value = input.restaurantId
  }
}

/** Lista para a equipa usar na aplicação externa de gravação (CSV). */
const exportCsv = () => {
  const header = ['Tag', 'Restaurante', 'Mesa', 'URL', 'Estado']
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = rows.value.map(t =>
    [t.code, restaurantsById.value.get(t.restaurantId)?.name ?? '', tableText(t), urlOf(t), NFC_TAG_STATUS_LABELS[t.status]].map(escape).join(',')
  )
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `etiquetas-nfc-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="tag-manager">
    <ExternalConfigNotice />

    <div class="toolbar">
      <div class="chips" role="tablist" aria-label="Filtrar por estado">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="chip"
          :class="{ 'is-active': statusFilter === f.key, 'is-highlight': f.key === 'to_prepare' && f.count > 0 }"
          @click="statusFilter = f.key"
        >
          {{ f.label }} <span class="chip-count">{{ f.count }}</span>
        </button>
      </div>

      <div class="toolbar-row">
        <label class="search">
          <Search :size="15" />
          <input v-model="search" type="search" placeholder="Procurar código, mesa ou restaurante" aria-label="Procurar etiqueta" />
        </label>
        <select v-if="scope === 'platform'" v-model="restaurantFilter" aria-label="Filtrar por restaurante">
          <option value="all">Todos os restaurantes</option>
          <option v-for="r in restaurants" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <template v-if="scope === 'platform'">
          <AppButton variant="secondary" :disabled="rows.length === 0" @click="exportCsv">
            <template #icon-left><Download :size="15" /></template>
            Exportar lista
          </AppButton>
          <AppButton variant="primary" @click="isRegisterOpen = true">
            <template #icon-left><PackagePlus :size="16" /></template>
            Registar etiquetas
          </AppButton>
        </template>
      </div>
    </div>

    <div v-if="store.isLoading && store.tags.length === 0" class="loading"><Loader2 :size="20" class="spin" /> A carregar etiquetas…</div>

    <EmptyState
      v-else-if="store.tags.length === 0"
      :icon="Nfc"
      title="Ainda não há etiquetas"
      :description="scope === 'platform' ? 'Registe as etiquetas físicas e associe-as às mesas dos restaurantes.' : 'As etiquetas são fornecidas e registadas pela equipa TapMenu.'"
    >
      <AppButton v-if="scope === 'platform'" variant="primary" @click="isRegisterOpen = true">Registar etiquetas</AppButton>
    </EmptyState>

    <EmptyState v-else-if="rows.length === 0" :icon="Search" title="Nenhuma etiqueta corresponde aos filtros" />

    <div v-else class="list-card">
      <!-- Mobile: lista compacta (detalhe e ações no painel lateral) -->
      <ul class="mobile-list">
        <li v-for="t in rows" :key="t.id">
          <button type="button" class="mobile-row" @click="selectedTagId = t.id">
            <span class="mobile-main">
              <code class="code">{{ t.code }}</code>
              <span class="mobile-sub">
                {{ tableText(t) }}<template v-if="scope === 'platform'"> · {{ restaurantsById.get(t.restaurantId)?.name ?? '—' }}</template>
              </span>
            </span>
            <NfcTagStatusBadge :status="t.status" />
            <ChevronRight :size="16" class="chevron-icon" />
          </button>
        </li>
      </ul>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th v-if="scope === 'platform'">Restaurante</th>
              <th>Mesa</th>
              <th>URL</th>
              <th>Estado</th>
              <th>Configurada</th>
              <th>Última alteração</th>
              <th class="sr-only">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in rows" :key="t.id" class="clickable" @click="selectedTagId = t.id">
              <td><code class="code">{{ t.code }}</code></td>
              <td v-if="scope === 'platform'">{{ restaurantsById.get(t.restaurantId)?.name ?? '—' }}</td>
              <td>{{ tableText(t) }}</td>
              <td class="url-cell" @click.stop>
                <PublicUrlField v-if="urlOf(t)" :url="urlOf(t)" compact @show-qr="qrTag = t" />
                <span v-else class="muted">Sem mesa</span>
              </td>
              <td><NfcTagStatusBadge :status="t.status" /></td>
              <td>{{ fmt(t.configuredAt) }}</td>
              <td>{{ fmt(t.updatedAt) }}</td>
              <td class="chevron"><ChevronRight :size="16" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <NfcTagDrawer :tag-id="selectedTagId" :scope="scope" :restaurants-by-id="restaurantsById" @close="selectedTagId = null" />

    <NfcTagRegisterModal
      v-if="scope === 'platform'"
      :is-open="isRegisterOpen"
      :restaurants="restaurants"
      :default-restaurant-id="restaurantFilter !== 'all' ? restaurantFilter : undefined"
      :is-saving="isRegistering"
      @close="isRegisterOpen = false"
      @submit="register"
    />

    <QrCodeModal
      v-if="qrTag && urlOf(qrTag)"
      :is-open="!!qrTag"
      :url="urlOf(qrTag)"
      :title="`QR Code — ${tableText(qrTag)}`"
      :subtitle="restaurantsById.get(qrTag.restaurantId)?.name"
      :filename="`qr-${qrTag.code}`"
      @close="qrTag = null"
    />
  </div>
</template>

<style scoped>
.tag-manager {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chips {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
}

.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
}

.chip.is-active {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
  color: var(--color-primary-800);
}

.chip.is-highlight:not(.is-active) {
  border-color: var(--color-amber-300);
  color: var(--color-amber-800);
}

.chip-count {
  min-width: 1.25rem;
  padding: 0 0.35rem;
  border-radius: var(--radius-full);
  background: var(--color-neutral-100);
  font-size: 0.7rem;
  text-align: center;
}

.toolbar-row {
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

.toolbar-row select {
  flex: 0 1 220px;
  padding: 0.55rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #fff;
  font-size: 0.8125rem;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
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
  min-width: 900px;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th,
.data-table td {
  padding: 0.65rem 0.875rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
  white-space: nowrap;
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

.code {
  font-weight: 700;
  font-size: 0.8rem;
}

.url-cell {
  min-width: 260px;
  max-width: 320px;
  white-space: normal;
}

.muted {
  color: var(--text-muted);
}

.chevron {
  color: var(--text-muted);
  width: 1%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.mobile-list {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
}

.mobile-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 0.875rem;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.mobile-list li:last-child .mobile-row {
  border-bottom: none;
}

.mobile-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.mobile-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .toolbar-row > * {
    flex: 1 1 100%;
  }

  .mobile-list {
    display: block;
  }

  .table-scroll {
    display: none;
  }
}
</style>
