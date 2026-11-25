<script setup lang="ts">
import { computed, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import {
  DUTY_LABELS,
  primaryOf,
  supportsOf,
  tableLabel,
  type AssignmentRole,
  type DutyStatus,
  type OpsStaff,
  type TableOperation
} from '@/domain/tableOperations'
import { ROLE_LABELS } from '@/domain/roles'
import { ArrowLeftRight, CheckSquare, Square, UserPlus, X } from 'lucide-vue-next'

/**
 * Atribuição de garçons (gerente/supervisor): várias mesas de uma vez,
 * principal ou apoio, temporária ou até ser mudada; estado de serviço da
 * equipa (também de quem não tem conta).
 */
const props = defineProps<{ tables: TableOperation[]; staff: OpsStaff[]; busy?: boolean }>()
const emit = defineEmits<{
  (e: 'assign', p: { tableIds: string[]; staffId: string; role: AssignmentRole; expiresAt: Date | null; reason: string }): void
  (e: 'remove', assignmentId: string): void
  (e: 'duty', staffId: string, status: DutyStatus): void
  (e: 'transfer-staff', staff: OpsStaff): void
}>()

const selected = ref<string[]>([])
const staffId = ref('')
const role = ref<AssignmentRole>('primary')
const duration = ref('')
const reason = ref('')

const DURATIONS = [
  { value: '', label: 'Até ser mudada' },
  { value: '60', label: '1 hora' },
  { value: '120', label: '2 horas' },
  { value: '240', label: '4 horas' },
  { value: 'eod', label: 'Até ao fim do dia' }
]

const toggle = (id: string) => {
  selected.value = selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value, id]
}
const allSelected = computed(() => props.tables.length > 0 && selected.value.length === props.tables.length)
const toggleAll = () => {
  selected.value = allSelected.value ? [] : props.tables.map(t => t.id)
}
const selectUnassigned = () => {
  selected.value = props.tables.filter(t => !primaryOf(t)).map(t => t.id)
}

const expiresAt = (): Date | null => {
  if (!duration.value) return null
  if (duration.value === 'eod') {
    const d = new Date()
    d.setHours(23, 59, 0, 0)
    return d
  }
  return new Date(Date.now() + Number(duration.value) * 60000)
}

const replacing = computed(() =>
  role.value === 'primary'
    ? props.tables.filter(t => selected.value.includes(t.id) && primaryOf(t) && primaryOf(t)!.staffId !== staffId.value)
    : []
)

const submit = () => {
  if (!selected.value.length || !staffId.value) return
  emit('assign', {
    tableIds: [...selected.value],
    staffId: staffId.value,
    role: role.value,
    expiresAt: expiresAt(),
    reason: reason.value.trim()
  })
  selected.value = []
  reason.value = ''
}

const DUTIES: DutyStatus[] = ['on_duty', 'on_break', 'absent', 'off_duty']
</script>

<template>
  <div class="assign">
    <section class="card">
      <header class="card-head">
        <h3>Atribuir mesas</h3>
        <div class="quick">
          <button type="button" class="link" @click="toggleAll">{{ allSelected ? 'Limpar' : 'Todas' }}</button>
          <button type="button" class="link" @click="selectUnassigned">Sem responsável</button>
        </div>
      </header>

      <div class="table-picker">
        <button
          v-for="t in tables"
          :key="t.id"
          type="button"
          class="pick"
          :class="{ on: selected.includes(t.id) }"
          @click="toggle(t.id)"
        >
          <component :is="selected.includes(t.id) ? CheckSquare : Square" :size="15" />
          <span class="pick-name">{{ tableLabel(t) }}</span>
          <span class="pick-who">{{ primaryOf(t)?.staffName || 'Sem responsável' }}</span>
        </button>
      </div>

      <div class="controls">
        <label>
          <span>Funcionário</span>
          <select v-model="staffId">
            <option value="" disabled>Escolha</option>
            <option v-for="s in staff" :key="s.id" :value="s.id">
              {{ s.name }} · {{ DUTY_LABELS[s.dutyStatus] }}{{ s.hasAccount ? '' : ' · sem conta' }}
            </option>
          </select>
        </label>
        <label>
          <span>Papel</span>
          <select v-model="role">
            <option value="primary">Garçom principal</option>
            <option value="support">Garçom de apoio</option>
          </select>
        </label>
        <label>
          <span>Duração</span>
          <select v-model="duration">
            <option v-for="d in DURATIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </label>
        <label class="grow">
          <span>Motivo <small>(opcional)</small></span>
          <input v-model="reason" maxlength="300" placeholder="Ex.: Início do turno da noite" />
        </label>
      </div>
      <p v-if="replacing.length" class="warn">
        {{ replacing.map(t => `Mesa ${t.number}`).join(', ') }} {{ replacing.length === 1 ? 'já tem' : 'já têm' }} principal —
        será substituído (fica no histórico).
      </p>
      <div class="submit">
        <AppButton :disabled="!selected.length || !staffId" :loading="busy" @click="submit">
          <UserPlus :size="16" />
          Atribuir {{ selected.length ? `${selected.length} ${selected.length === 1 ? 'mesa' : 'mesas'}` : '' }}
        </AppButton>
      </div>
    </section>

    <section class="card">
      <h3>Equipa e turnos</h3>
      <p class="muted">Pode mudar o estado de quem não tem smartphone. Terminar o turno não fecha mesas nem pedidos.</p>
      <ul class="team">
        <li v-for="s in staff" :key="s.id">
          <div class="who">
            <strong>{{ s.name }}</strong>
            <span class="muted">
              {{ ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] ?? s.role }} · {{ s.tables }} {{ s.tables === 1 ? 'mesa' : 'mesas' }}
              <template v-if="!s.hasAccount"> · sem conta</template>
            </span>
          </div>
          <div class="team-actions">
            <select :value="s.dutyStatus" :aria-label="`Estado de ${s.name}`" @change="emit('duty', s.id, ($event.target as HTMLSelectElement).value as DutyStatus)">
              <option v-for="d in DUTIES" :key="d" :value="d">{{ DUTY_LABELS[d] }}</option>
            </select>
            <AppButton v-if="s.tables" size="sm" variant="ghost" title="Transferir todas as mesas" @click="emit('transfer-staff', s)">
              <ArrowLeftRight :size="14" />
            </AppButton>
          </div>
        </li>
      </ul>
    </section>

    <section class="card wide">
      <h3>Mesas e responsáveis</h3>
      <div class="rows">
        <div v-for="t in tables" :key="t.id" class="row">
          <strong class="row-name">{{ tableLabel(t) }}</strong>
          <div class="tags">
            <span v-if="!t.assignments.length" class="muted">Sem responsável</span>
            <span v-for="a in [primaryOf(t), ...supportsOf(t)].filter(Boolean)" :key="a!.id" class="tag" :class="a!.role">
              {{ a!.role === 'primary' ? 'Principal' : 'Apoio' }}: {{ a!.staffName }}
              <template v-if="a!.expiresAt"> · até {{ new Date(a!.expiresAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}</template>
              <button type="button" :title="`Remover ${a!.staffName}`" @click="emit('remove', a!.id)"><X :size="12" /></button>
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.assign {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 1024px) {
  .assign {
    grid-template-columns: 1.4fr 1fr;
  }
  .wide {
    grid-column: 1 / -1;
  }
}
.card {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  min-width: 0;
}
h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.quick {
  display: flex;
  gap: 0.75rem;
}
.link {
  border: none;
  background: none;
  padding: 0;
  color: var(--color-primary-700);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
}
.table-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.4rem;
  max-height: 320px;
  overflow-y: auto;
}
.pick {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.4rem;
  align-items: center;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  text-align: left;
  cursor: pointer;
}
.pick.on {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
  color: var(--color-primary-800);
}
.pick-name {
  font-weight: 800;
  font-size: 0.85rem;
}
.pick-who {
  grid-column: 2;
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.6rem;
}
.controls label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-weight: 700;
}
.controls small {
  font-weight: 500;
  color: var(--text-muted);
}
.controls select,
.controls input,
.team-actions select {
  height: 40px;
  padding: 0 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  font-size: 0.85rem;
}
.warn {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-amber-800);
}
.submit {
  display: flex;
  justify-content: flex-end;
}
.muted {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}
.team {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.team li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-subtle);
}
.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.team-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.team-actions select {
  height: 34px;
  font-size: 0.8rem;
}
.rows {
  display: flex;
  flex-direction: column;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--border-subtle);
}
.row-name {
  min-width: 90px;
  font-size: 0.9rem;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.3rem 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--color-neutral-100);
  font-size: 0.78rem;
  font-weight: 600;
}
.tag.primary {
  background: var(--color-primary-100);
  color: var(--color-primary-800);
}
.tag button {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 999px;
  background: none;
  color: inherit;
  cursor: pointer;
}
.tag button:hover {
  background: rgba(0, 0, 0, 0.08);
}
</style>
