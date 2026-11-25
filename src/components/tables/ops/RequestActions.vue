<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ServiceRequest } from '@/types'
import type { OpsMe, OpsStaff, ServiceAction } from '@/domain/tableOperations'
import { REQUEST_REASON, REQUEST_WAIT_MINUTES, requestStep } from '@/domain/tableOperations'
import AppButton from '@/components/ui/AppButton.vue'
import { BellRing, CheckCircle2, Eye, Hand, UserCheck } from 'lucide-vue-next'

/**
 * Uma chamada de atendimento com os passos recebido → em atendimento →
 * concluído. O gerente/caixa pode registar por outro funcionário (quem não
 * tem smartphone): por omissão, o responsável da mesa.
 */
const props = defineProps<{
  request: ServiceRequest
  me: OpsMe | null
  staff: OpsStaff[]
  tableLabel?: string
  now: Date
  busy?: boolean
}>()
const emit = defineEmits<{ (e: 'action', action: ServiceAction, onBehalfOf?: string): void }>()

const step = computed(() => requestStep(props.request))
const waitingMin = computed(() => Math.max(0, Math.floor((props.now.getTime() - new Date(props.request.createdAt).getTime()) / 60000)))

const isMine = computed(
  () =>
    !!props.me?.staffId &&
    (props.request.responsibleStaffId === props.me.staffId || props.request.handledByStaffId === props.me.staffId)
)
/** Garçom (não gerente/caixa) e a chamada é de outro: só pode "assumir". */
const othersRequest = computed(
  () => !props.me?.canActForOthers && !!props.request.responsibleStaffId && !isMine.value
)
const canTakeOver = computed(
  () => othersRequest.value && !props.request.acknowledgedAt && waitingMin.value >= REQUEST_WAIT_MINUTES
)

const actingFor = ref('')
watch(
  () => props.request.id,
  () => {
    actingFor.value = props.request.handledByStaffId || props.request.responsibleStaffId || props.me?.staffId || ''
  },
  { immediate: true }
)
const onBehalfOf = () =>
  props.me?.canActForOthers && actingFor.value && actingFor.value !== props.me.staffId ? actingFor.value : undefined

const fire = (a: ServiceAction) => emit('action', a, a === 'cancel' ? undefined : onBehalfOf())
</script>

<template>
  <div class="req" :class="`is-${step}`">
    <div class="req-main">
      <span class="req-icon"><BellRing :size="16" /></span>
      <div class="req-text">
        <strong>
          <template v-if="tableLabel">{{ tableLabel }} · </template>{{ REQUEST_REASON[request.type] }}
        </strong>
        <span class="req-meta">
          há {{ waitingMin }} min · Responsável: <b>{{ request.responsibleName || 'sem responsável' }}</b>
          <template v-if="request.assignedToName && request.assignedToName !== request.responsibleName">
            · a tratar: <b>{{ request.assignedToName }}</b>
          </template>
        </span>
        <span v-if="request.notes" class="req-notes">“{{ request.notes }}”</span>
      </div>
      <span class="req-step">
        {{ step === 'new' ? 'Nova' : step === 'acknowledged' ? 'Recebido' : 'Em atendimento' }}
      </span>
    </div>

    <div class="req-actions">
      <select
        v-if="me?.canActForOthers && staff.length"
        v-model="actingFor"
        class="who"
        aria-label="Quem atende"
        title="Registar em nome de"
      >
        <option v-for="s in staff" :key="s.id" :value="s.id">{{ s.name }}{{ s.id === me?.staffId ? ' (eu)' : '' }}</option>
      </select>

      <template v-if="othersRequest">
        <AppButton v-if="canTakeOver" size="sm" variant="warning" :loading="busy" @click="fire('take_over')">
          <Hand :size="14" /> Assumir
        </AppButton>
        <span v-else class="hint">Pode assumir se não for recebida em {{ REQUEST_WAIT_MINUTES }} min</span>
      </template>
      <template v-else>
        <AppButton v-if="step === 'new'" size="sm" variant="outline" :loading="busy" @click="fire('acknowledge')">
          <Eye :size="14" /> Recebido
        </AppButton>
        <AppButton v-if="step !== 'in_progress'" size="sm" variant="primary" :loading="busy" @click="fire('start')">
          <UserCheck :size="14" /> Em atendimento
        </AppButton>
        <AppButton size="sm" variant="success" :loading="busy" @click="fire('complete')">
          <CheckCircle2 :size="14" /> Concluído
        </AppButton>
      </template>
    </div>
  </div>
</template>

<style scoped>
.req {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--color-danger-500);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}
.req.is-acknowledged {
  border-left-color: var(--color-amber-600);
}
.req.is-in_progress {
  border-left-color: var(--color-primary-600);
}
.req-main {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}
.req-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}
.req-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}
.req-text strong {
  font-size: 0.9rem;
  color: var(--text-main);
}
.req-meta,
.req-notes {
  font-size: 0.78rem;
  color: var(--text-muted);
}
.req-notes {
  font-style: italic;
}
.req-step {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}
.req-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
.who {
  height: 32px;
  max-width: 160px;
  padding: 0 0.5rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  font-size: 0.8rem;
}
.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
