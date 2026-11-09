<script setup lang="ts">
import type { NfcTag, Table, TableSession } from '@/types'
import TableStatusBadge from './TableStatusBadge.vue'
import { effectiveTableStatus, formatDuration, formatStartTime } from '@/domain/tableRules'
import { Users, Clock, Receipt, BellRing, Nfc } from 'lucide-vue-next'

/**
 * Grelha visual das mesas. Cada mesa mostra o estado de forma clara;
 * clicar abre o detalhe (emit `select`).
 */
withDefaults(
  defineProps<{
    tables: Table[]
    sessionsByTable: Map<string, TableSession>
    tagsByTable?: Map<string, NfcTag>
    pendingRequestsByTable?: Map<string, number>
    compact?: boolean
  }>(),
  { compact: false }
)

const emit = defineEmits<{ (e: 'select', table: Table): void }>()

</script>

<template>
  <div class="table-grid" :class="{ 'is-compact': compact }">
    <button
      v-for="table in tables"
      :key="table.id"
      type="button"
      class="table-tile"
      :class="`is-${effectiveTableStatus(table)}`"
      :aria-label="`Mesa ${table.number}`"
      @click="emit('select', table)"
    >
      <div class="tile-top">
        <span class="tile-number">{{ table.number }}</span>
        <TableStatusBadge :table="table" />
      </div>

      <div v-if="!compact" class="tile-meta">
        <span class="tile-name">{{ table.name || `Mesa ${table.number}` }}</span>
        <span class="tile-sub">{{ table.area }} · <Users :size="12" class="inline" /> {{ table.capacity }}</span>
      </div>

      <template v-if="sessionsByTable.get(table.id)">
        <div class="tile-session">
          <span class="session-time">
            <Clock :size="12" class="inline" />
            {{ formatStartTime(sessionsByTable.get(table.id)!.startedAt) }} · {{ formatDuration(sessionsByTable.get(table.id)!.startedAt) }}
          </span>
          <span v-if="!compact" class="session-total">{{ sessionsByTable.get(table.id)!.total.toLocaleString('pt-MZ') }} MT</span>
        </div>
        <div v-if="!compact" class="tile-flags">
          <span v-if="sessionsByTable.get(table.id)!.billRequestedAt" class="flag is-bill"><Receipt :size="12" /> Conta pedida</span>
          <span v-if="(pendingRequestsByTable?.get(table.id) ?? 0) > 0" class="flag is-service">
            <BellRing :size="12" /> {{ pendingRequestsByTable?.get(table.id) }} atendimento
          </span>
        </div>
      </template>

      <div v-if="!compact && tagsByTable" class="tile-tag" :class="{ 'is-missing': !tagsByTable.get(table.id) }">
        <Nfc :size="12" />
        <span>{{ tagsByTable.get(table.id)?.code ?? 'Sem etiqueta' }}</span>
      </div>
    </button>
  </div>
</template>

<style scoped>
.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
  gap: 0.75rem;
}

.table-grid.is-compact {
  grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
  gap: 0.5rem;
}

.table-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.875rem;
  text-align: left;
  font: inherit;
  color: inherit;
  background: #fff;
  border: 1px solid var(--border-color);
  border-left-width: 4px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: box-shadow var(--transition-fast), transform var(--transition-fast), border-color var(--transition-fast);
}

.table-tile:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.table-tile:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.table-tile.is-free {
  border-left-color: var(--color-success-500);
}

.table-tile.is-occupied {
  border-left-color: var(--color-primary-600);
  background: linear-gradient(180deg, #fff 0%, var(--color-primary-50) 100%);
}

.table-tile.is-unavailable {
  border-left-color: var(--color-neutral-400);
  background: var(--color-neutral-50);
}

.tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
}

.tile-number {
  font-family: var(--font-heading);
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1;
  color: var(--text-main);
}

.is-compact .tile-number {
  font-size: 1.125rem;
}

.is-unavailable .tile-number {
  color: var(--text-muted);
}

.tile-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.tile-name {
  font-size: 0.8125rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-sub {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.inline {
  display: inline;
  vertical-align: -2px;
}

.tile-session {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--color-primary-800);
}

.session-total {
  font-weight: 800;
  white-space: nowrap;
}

.tile-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.flag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 0.68rem;
  font-weight: 700;
}

.flag.is-bill {
  background: var(--color-amber-50);
  color: var(--color-amber-800);
  border: 1px solid var(--color-amber-200);
}

.flag.is-service {
  background: var(--color-danger-50);
  color: var(--color-danger-700);
  border: 1px solid var(--color-danger-200);
}

.tile-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  padding-top: 0.5rem;
}

.tile-tag.is-missing {
  color: var(--color-warning-600);
}
</style>
