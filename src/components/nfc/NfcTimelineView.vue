<script setup lang="ts">
import type { NfcTimelineEvent } from '@/types'
import {
  Radio,
  Cpu,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Unlock,
  ShieldAlert,
  Clock,
  Search,
  XCircle,
  Ban,
  X,
  User
} from 'lucide-vue-next'

interface TimelineItem extends NfcTimelineEvent {
  recordId?: string
  serial?: string | null
  tableNumber?: string
  restaurantName?: string
  url?: string
}

interface Props {
  events: TimelineItem[]
  showTagContext?: boolean
}

withDefaults(defineProps<Props>(), {
  showTagContext: false
})

const getEventConfig = (type: NfcTimelineEvent['type']) => {
  switch (type) {
    case 'created':
      return {
        icon: Radio,
        colorClass: 'evt-created',
        badgeText: 'Registo',
        badgeVariant: 'neutral'
      }
    case 'write_started':
      return {
        icon: Cpu,
        colorClass: 'evt-started',
        badgeText: 'Gravação iniciada',
        badgeVariant: 'primary'
      }
    case 'write_completed':
      return {
        icon: CheckCircle2,
        colorClass: 'evt-completed',
        badgeText: 'Gravada',
        badgeVariant: 'success'
      }
    case 'write_failed':
      return {
        icon: XCircle,
        colorClass: 'evt-failed',
        badgeText: 'Gravação falhou',
        badgeVariant: 'danger'
      }
    case 'verified':
      return {
        icon: ShieldCheck,
        colorClass: 'evt-verified',
        badgeText: 'Verificada',
        badgeVariant: 'info'
      }
    case 'verify_failed':
      return {
        icon: Search,
        colorClass: 'evt-unverified',
        badgeText: 'Verificação inconclusiva',
        badgeVariant: 'warning'
      }
    case 'read':
      return {
        icon: Search,
        colorClass: 'evt-read',
        badgeText: 'Leitura',
        badgeVariant: 'teal'
      }
    case 'protected':
      return {
        icon: Lock,
        colorClass: 'evt-locked',
        badgeText: 'Protegida',
        badgeVariant: 'warning'
      }
    case 'unprotected':
      return {
        icon: Unlock,
        colorClass: 'evt-unlocked',
        badgeText: 'Desprotegida',
        badgeVariant: 'teal'
      }
    case 'write_rejected':
      return {
        icon: ShieldAlert,
        colorClass: 'evt-rejected',
        badgeText: 'Recusada',
        badgeVariant: 'danger'
      }
    case 'cancelled':
      return {
        icon: Ban,
        colorClass: 'evt-cancelled',
        badgeText: 'Cancelada',
        badgeVariant: 'neutral'
      }
    case 'error':
      return {
        icon: X,
        colorClass: 'evt-failed',
        badgeText: 'Erro',
        badgeVariant: 'danger'
      }
    default:
      return {
        icon: Clock,
        colorClass: 'evt-default',
        badgeText: 'Operação',
        badgeVariant: 'neutral'
      }
  }
}

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="nfc-timeline-container">
    <div v-if="events.length === 0" class="timeline-empty">
      <Clock :size="28" class="text-muted" />
      <p>Sem eventos registados nesta linha temporal.</p>
    </div>

    <div v-else class="timeline-wrapper">
      <div
        v-for="evt in events"
        :key="evt.id"
        class="timeline-item"
        :class="getEventConfig(evt.type).colorClass"
      >
        <!-- Vertical connector line -->
        <div class="timeline-line"></div>

        <!-- Node icon -->
        <div class="timeline-node">
          <component :is="getEventConfig(evt.type).icon" :size="16" />
        </div>

        <!-- Content Card -->
        <div class="timeline-card">
          <div class="timeline-header">
            <div class="header-left">
              <span class="event-title">{{ evt.title }}</span>
              <span class="event-type-badge" :class="`badge-${getEventConfig(evt.type).badgeVariant}`">
                {{ getEventConfig(evt.type).badgeText }}
              </span>
            </div>

            <div class="header-meta">
              <span class="event-time">
                <Clock :size="12" />
                {{ formatDate(evt.timestamp) }}
              </span>
            </div>
          </div>

          <!-- Context if in global view -->
          <div v-if="showTagContext && (evt.tableNumber || evt.serial)" class="context-pill-row">
            <span v-if="evt.restaurantName" class="context-pill">
              {{ evt.restaurantName }}
            </span>
            <span v-if="evt.tableNumber" class="context-pill table-pill">
              Mesa {{ evt.tableNumber }}
            </span>
            <span v-if="evt.url" class="context-pill url-pill">
              {{ evt.url }}
            </span>
            <span v-if="evt.serial" class="context-pill uid-pill">
              Serial: {{ evt.serial }}
            </span>
          </div>

          <p class="event-desc">{{ evt.description }}</p>

          <div v-if="evt.actor" class="event-footer">
            <span class="actor-info">
              <User :size="12" />
              Executado por: <strong>{{ evt.actor }}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nfc-timeline-container {
  width: 100%;
}

.timeline-empty {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.timeline-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.timeline-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

/* Vertical line */
.timeline-item:not(:last-child) .timeline-line {
  position: absolute;
  left: 17px;
  top: 36px;
  bottom: -22px;
  width: 2px;
  background-color: var(--border-medium);
  z-index: 1;
}

.timeline-node {
  position: relative;
  z-index: 2;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 0 4px #ffffff, var(--shadow-sm);
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
  transition: transform var(--transition-fast);
}

.timeline-card {
  flex: 1;
  min-width: 0;
  background-color: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all var(--transition-fast);
}

.timeline-card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-sm);
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.event-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.event-type-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-neutral {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.badge-primary {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
}

.badge-success {
  background: var(--color-success-50);
  color: var(--color-success-700);
}

.badge-info {
  background: #eff6ff;
  color: #2563eb;
}

.badge-warning {
  background: var(--color-warning-50);
  color: #b45309;
}

.badge-danger {
  background: var(--color-danger-50);
  color: var(--color-danger-700);
}

.badge-teal {
  background: #ccfbf1;
  color: #0f766e;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.event-time {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.context-pill-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.context-pill {
  font-size: 0.6875rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
  font-weight: 500;
}

.table-pill {
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  font-weight: 600;
}

.uid-pill {
  font-family: monospace;
  background: #f1f5f9;
  color: #475569;
}

.url-pill {
  font-family: monospace;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
}

.event-desc {
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  line-height: 1.5;
  margin: 0;
}

.event-footer {
  margin-top: 0.625rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-subtle);
}

.actor-info {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.actor-info strong {
  color: var(--color-neutral-800);
}

/* Event color variations */
.evt-created .timeline-node {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.evt-started .timeline-node {
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  border: 1px solid var(--color-primary-200);
}

.evt-completed .timeline-node {
  background-color: var(--color-success-50);
  color: var(--color-success-700);
  border: 1px solid var(--color-success-200);
}

.evt-verified .timeline-node {
  background-color: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

.evt-locked .timeline-node {
  background-color: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.evt-locked .timeline-card {
  border-color: #fde68a;
  background: #fffdfa;
}

.evt-unlocked .timeline-node {
  background-color: #f0fdfa;
  color: #0d9488;
  border: 1px solid #99f6e4;
}

.evt-unlocked .timeline-card {
  border-color: #99f6e4;
  background: #fbfdfd;
}

.evt-rejected .timeline-node {
  background-color: var(--color-danger-50);
  color: var(--color-danger-600);
  border: 1px solid var(--color-danger-200);
  animation: shake 0.4s ease;
}

.evt-rejected .timeline-card {
  border-color: var(--color-danger-200);
  background: #fff8f8;
}

.evt-failed .timeline-node {
  background-color: var(--color-danger-50);
  color: var(--color-danger-600);
  border: 1px solid var(--color-danger-200);
}

.evt-failed .timeline-card {
  border-color: var(--color-danger-200);
  background: #fff8f8;
}

.evt-unverified .timeline-node {
  background-color: var(--color-warning-50);
  color: #b45309;
  border: 1px solid #fde68a;
}

.evt-unverified .timeline-card {
  border-color: #fde68a;
  background: #fffdf5;
}

.evt-read .timeline-node {
  background-color: #f0fdfa;
  color: #0d9488;
  border: 1px solid #99f6e4;
}

.evt-cancelled .timeline-node {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-600);
  border: 1px solid var(--border-medium);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

@media (max-width: 640px) {
  .timeline-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

