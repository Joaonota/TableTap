<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { DUTY_LABELS, ROLE_TEXT, tableLabel, type OpsStaff, type TableOperation } from '@/domain/tableOperations'

/**
 * Transferir uma mesa (ou todas as mesas de um funcionário, no fim do
 * turno) para outra pessoa. Só muda o responsável: pedidos, sessão e
 * pagamentos ficam como estão.
 */
const props = defineProps<{
  isOpen: boolean
  /** Uma mesa — ou null para "todas as mesas de fromStaff". */
  table: TableOperation | null
  /** Para "Transferir minhas mesas": de quem são. */
  fromStaff?: OpsStaff | null
  /** O garçom só pode transferir as suas atribuições. */
  onlyStaffId?: string
  staff: OpsStaff[]
  busy?: boolean
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { toStaffId: string; reason: string; fromStaffId?: string }): void
}>()

const fromStaffId = ref('')
const toStaffId = ref('')
const reason = ref('')

const sources = computed(() =>
  props.table ? props.table.assignments.filter(a => !props.onlyStaffId || a.staffId === props.onlyStaffId) : []
)
const excluded = computed(() => (props.table ? fromStaffId.value : props.fromStaff?.id ?? ''))
const targets = computed(() => props.staff.filter(s => s.id !== excluded.value))

watch(
  () => props.isOpen,
  open => {
    if (!open) return
    fromStaffId.value = sources.value.find(a => a.role === 'primary')?.staffId ?? sources.value[0]?.staffId ?? ''
    toStaffId.value = ''
    reason.value = ''
  }
)

const title = computed(() => (props.table ? `Transferir ${tableLabel(props.table)}` : 'Transferir mesas'))
const subtitle = computed(() =>
  props.table
    ? 'Os pedidos, a sessão e os pagamentos não mudam — só o responsável.'
    : `Todas as mesas de ${props.fromStaff?.name ?? ''} passam para outra pessoa. As sessões continuam abertas.`
)
const canSubmit = computed(() => !!toStaffId.value && (!props.table || !!fromStaffId.value))

const submit = () => {
  if (!canSubmit.value) return
  emit('submit', {
    toStaffId: toStaffId.value,
    reason: reason.value.trim(),
    fromStaffId: props.table ? fromStaffId.value : props.fromStaff?.id
  })
}
</script>

<template>
  <AppModal :is-open="isOpen" :title="title" :subtitle="subtitle" max-width="460px" @close="emit('close')">
    <form class="form" @submit.prevent="submit">
      <label v-if="table && sources.length > 1" class="field">
        <span>Quem sai</span>
        <select v-model="fromStaffId">
          <option v-for="a in sources" :key="a.id" :value="a.staffId">{{ a.staffName }} — {{ ROLE_TEXT[a.role] }}</option>
        </select>
      </label>
      <p v-else-if="table && sources[0]" class="from">
        Agora: <strong>{{ sources[0].staffName }}</strong> ({{ ROLE_TEXT[sources[0].role].toLowerCase() }})
      </p>

      <label class="field">
        <span>Transferir para</span>
        <select v-model="toStaffId" required>
          <option value="" disabled>Escolha um funcionário</option>
          <option v-for="s in targets" :key="s.id" :value="s.id">
            {{ s.name }} · {{ DUTY_LABELS[s.dutyStatus] }} · {{ s.tables }} {{ s.tables === 1 ? 'mesa' : 'mesas' }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Motivo <small>(opcional)</small></span>
        <input v-model="reason" maxlength="300" :placeholder="table ? 'Ex.: João terminou o turno' : 'Ex.: Fim de turno'" />
      </label>
    </form>
    <template #footer>
      <AppButton variant="ghost" @click="emit('close')">Cancelar</AppButton>
      <AppButton :disabled="!canSubmit" :loading="busy" @click="submit">Transferir</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
}
.field small {
  font-weight: 500;
  color: var(--text-muted);
}
.field select,
.field input {
  height: 42px;
  padding: 0 0.75rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  font-size: 0.9rem;
  font-weight: 500;
}
.from {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
