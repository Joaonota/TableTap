<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { NfcTag, Restaurant, Table } from '@/types'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { buildTablePath, toAbsoluteUrl } from '@/domain/publicUrl'
import { statusAfterAssociation, NFC_TAG_STATUS_LABELS } from '@/domain/nfcTagRules'
import { AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  tag: NfcTag | null
  restaurant: Restaurant | null
  tables: Table[]
  /** Mesas que já têm outra etiqueta em uso (tableId → código). */
  takenBy: Map<string, NfcTag>
  isSaving?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', tableId: string): void
}>()

const selectedTableId = ref('')
const error = ref('')

watch(
  () => props.isOpen,
  open => {
    if (!open) return
    selectedTableId.value = ''
    error.value = ''
  }
)

const isReassign = computed(() => !!props.tag?.tableId)
const title = computed(() => {
  if (!props.tag) return ''
  if (!props.tag.tableId) return `Associar ${props.tag.code} a uma mesa`
  return props.tag.status === 'pending' ? `Alterar associação — ${props.tag.code}` : `Reatribuir ${props.tag.code}`
})

const sortedTables = computed(() => [...props.tables].sort((a, b) => a.number.localeCompare(b.number, 'pt', { numeric: true })))

const preview = computed(() => {
  const table = props.tables.find(t => t.id === selectedTableId.value)
  if (!table || !props.restaurant || !props.tag) return null
  const path = buildTablePath(props.restaurant.slug, table.slug)
  return {
    url: toAbsoluteUrl(path),
    nextStatus: statusAfterAssociation(props.tag.configuredPath, path)
  }
})

const submit = () => {
  if (!selectedTableId.value) {
    error.value = 'Escolha uma mesa.'
    return
  }
  emit('confirm', selectedTableId.value)
}
</script>

<template>
  <AppModal :is-open="isOpen && !!tag" :title="title" max-width="480px" @close="emit('close')">
    <div v-if="tag" class="assign">
      <label class="field">
        <span class="label">Mesa</span>
        <select v-model="selectedTableId" :class="{ 'has-error': error }" @change="error = ''">
          <option value="" disabled>Escolher mesa…</option>
          <option
            v-for="t in sortedTables"
            :key="t.id"
            :value="t.id"
            :disabled="t.id === tag.tableId || (takenBy.has(t.id) && takenBy.get(t.id)!.id !== tag.id)"
          >
            Mesa {{ t.number }}{{ t.name ? ` — ${t.name}` : '' }}{{ t.id === tag.tableId ? ' (atual)' : takenBy.has(t.id) ? ` (já tem ${takenBy.get(t.id)!.code})` : '' }}
          </option>
        </select>
        <span v-if="error" class="error">{{ error }}</span>
        <span v-if="sortedTables.length === 0" class="hint">Este restaurante ainda não tem mesas.</span>
      </label>

      <div v-if="preview" class="preview">
        <span class="label">URL que a etiqueta deve conter</span>
        <code>{{ preview.url }}</code>
        <span class="hint">Estado após guardar: <strong>{{ NFC_TAG_STATUS_LABELS[preview.nextStatus] }}</strong></span>
      </div>

      <div v-if="preview?.nextStatus === 'reassignment_pending'" class="warning">
        <AlertTriangle :size="16" />
        <span>
          Esta etiqueta já foi gravada com outra URL. Depois de guardar, fica em <strong>Reatribuição pendente</strong> até a equipa TapMenu a regravar com a aplicação externa.
          Até lá, quem a aproximar abre a mesa antiga.
        </span>
      </div>
      <p v-else-if="isReassign" class="hint">A etiqueta ainda não foi gravada, por isso mudar de mesa não tem impacto físico.</p>
    </div>

    <template #footer>
      <AppButton variant="secondary" :disabled="isSaving" @click="emit('close')">Cancelar</AppButton>
      <AppButton variant="primary" :loading="isSaving" @click="submit">Guardar associação</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.assign {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field,
.preview {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.label {
  font-size: 0.8125rem;
  font-weight: 700;
}

select {
  padding: 0.6rem 0.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: #fff;
}

select.has-error {
  border-color: var(--color-danger-500);
}

.error {
  font-size: 0.75rem;
  color: var(--color-danger-600);
}

.preview {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--color-neutral-50);
}

.preview code {
  font-size: 0.8rem;
  word-break: break-all;
}

.hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.warning {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  background: var(--color-amber-50);
  border: 1px solid var(--color-amber-200);
  color: var(--color-amber-900);
  font-size: 0.78rem;
  line-height: 1.45;
}

.warning svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}
</style>
