<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NfcTimelineEvent } from '@/types'
import NfcTimelineView from './NfcTimelineView.vue'
import { History, Clock } from 'lucide-vue-next'

interface HistoryItem extends NfcTimelineEvent {
  recordId?: string
  serial?: string | null
  tableNumber?: string
  restaurantName?: string
  url?: string
}

interface Props {
  events: HistoryItem[]
  /** mostrar contexto (restaurante/mesa) — usado no histórico global */
  showTagContext?: boolean
  /** oferecer filtro por tipo de operação */
  withFilter?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTagContext: false,
  withFilter: false
})

const operationFilter = ref<string>('all')

const OPERATIONS = [
  { value: 'all', label: 'Todas as operações' },
  { value: 'write_completed', label: 'Gravações' },
  { value: 'verified', label: 'Verificações' },
  { value: 'read', label: 'Leituras' },
  { value: 'write_started', label: 'Sessões de gravação' },
  { value: 'write_failed', label: 'Falhas de gravação' },
  { value: 'verify_failed', label: 'Verificações inconclusivas' },
  { value: 'protected', label: 'Proteções' },
  { value: 'unprotected', label: 'Remoções de proteção' },
  { value: 'write_rejected', label: 'Tentativas bloqueadas' },
  { value: 'cancelled', label: 'Cancelamentos' },
  { value: 'error', label: 'Erros' }
]

const filtered = computed(() => {
  if (!props.withFilter || operationFilter.value === 'all') return props.events
  return props.events.filter(e => e.type === operationFilter.value)
})
</script>

<template>
  <div class="nfc-history">
    <div class="history-head">
      <div class="history-head-left">
        <span class="history-title"><History :size="14" /> Histórico de operações</span>
        <span class="history-count"><Clock :size="12" /> {{ filtered.length }} registos</span>
      </div>
      <select v-if="withFilter" v-model="operationFilter" class="history-filter">
        <option v-for="op in OPERATIONS" :key="op.value" :value="op.value">{{ op.label }}</option>
      </select>
    </div>
    <NfcTimelineView :events="filtered" :show-tag-context="showTagContext" />
  </div>
</template>

<style scoped>
.nfc-history {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.history-head-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.history-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.history-count {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.history-filter {
  font-size: 0.78rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: #ffffff;
  color: var(--color-neutral-700);
  outline: none;
  max-width: 230px;
}
</style>
