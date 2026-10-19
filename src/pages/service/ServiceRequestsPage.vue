<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useServiceRequestStore } from '@/stores/serviceRequest'
import { useAuthStore } from '@/stores/auth'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import type { ServiceRequest, ServiceRequestStatus } from '@/types'
import {
  BellRing,
  Clock,
  CheckCircle2,
  UserCheck,
  XCircle,
  Utensils,
  Receipt
} from 'lucide-vue-next'

const serviceStore = useServiceRequestStore()
const authStore = useAuthStore()

const statusFilter = ref<string>('all')

onMounted(async () => {
  await serviceStore.loadRequests()
})

const filteredRequests = computed(() => {
  return serviceStore.requests.filter(r => {
    if (statusFilter.value === 'all') return true
    return r.status === statusFilter.value
  })
})

const handleStatusChange = async (req: ServiceRequest, newStatus: ServiceRequestStatus) => {
  await serviceStore.updateRequestStatus(req.id, newStatus)
}
</script>

<template>
  <div class="service-page">
    <div class="service-header">
      <div>
        <h1 class="page-title">Atendimento Digital & Chamadas de Mesa</h1>
        <p class="page-subtitle">Pedidos de garçom, água, talheres e conta feitos diretamente pelo smartphone do cliente</p>
      </div>

      <div class="filter-pills">
        <button
          type="button"
          class="pill-btn"
          :class="{ 'is-active': statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          Todas ({{ serviceStore.requests.length }})
        </button>
        <button
          type="button"
          class="pill-btn"
          :class="{ 'is-active': statusFilter === 'new' }"
          @click="statusFilter = 'new'"
        >
          Novas
        </button>
        <button
          type="button"
          class="pill-btn"
          :class="{ 'is-active': statusFilter === 'in_progress' }"
          @click="statusFilter = 'in_progress'"
        >
          Em Atendimento
        </button>
        <button
          type="button"
          class="pill-btn"
          :class="{ 'is-active': statusFilter === 'completed' }"
          @click="statusFilter = 'completed'"
        >
          Concluídas
        </button>
      </div>
    </div>

    <div v-if="filteredRequests.length === 0" class="empty-requests">
      <BellRing :size="40" class="text-muted" />
      <h3>Nenhuma Solicitação Pendente</h3>
      <p>Todas as mesas estão servidas ou não há chamadas no momento.</p>
    </div>

    <div v-else class="requests-grid">
      <div
        v-for="req in filteredRequests"
        :key="req.id"
        class="request-card"
        :class="{
          'is-new': req.status === 'new',
          'is-progress': req.status === 'in_progress',
          'is-completed': req.status === 'completed'
        }"
      >
        <div class="card-header">
          <div class="table-badge">
            <span>MESA {{ req.tableNumber }}</span>
          </div>
          <AppBadge
            :variant="
              req.status === 'new' ? 'danger' :
              req.status === 'in_progress' ? 'warning' : 'success'
            "
          >
            {{ req.status.toUpperCase() }}
          </AppBadge>
        </div>

        <div class="card-body">
          <div class="request-type-row">
            <div class="type-icon-box">
              <Receipt v-if="req.type === 'bill'" :size="20" />
              <Utensils v-else-if="req.type === 'cutlery'" :size="20" />
              <BellRing v-else :size="20" />
            </div>
            <div>
              <div class="type-title">
                {{
                  req.type === 'waiter_call' ? 'Chamar Garçom' :
                  req.type === 'water' ? 'Pedir Água' :
                  req.type === 'cutlery' ? 'Pedir Talheres' :
                  req.type === 'bill' ? 'Pedir a Conta' : 'Assistência Geral'
                }}
              </div>
              <div class="time-meta">
                <Clock :size="12" />
                <span>{{ new Date(req.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>
            </div>
          </div>

          <p v-if="req.notes" class="request-notes">"{{ req.notes }}"</p>

          <div v-if="req.assignedToName" class="assigned-row">
            <UserCheck :size="14" />
            <span>Assumido por: <strong>{{ req.assignedToName }}</strong></span>
          </div>
        </div>

        <div class="card-actions">
          <AppButton
            v-if="req.status === 'new'"
            variant="primary"
            size="sm"
            @click="handleStatusChange(req, 'in_progress')"
          >
            Assumir Mesa
          </AppButton>

          <AppButton
            v-if="req.status === 'in_progress'"
            variant="success"
            size="sm"
            @click="handleStatusChange(req, 'completed')"
          >
            Concluir Atendimento
          </AppButton>

          <AppButton
            v-if="req.status !== 'completed' && req.status !== 'cancelled'"
            variant="ghost"
            size="sm"
            @click="handleStatusChange(req, 'cancelled')"
          >
            Cancelar
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.service-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.filter-pills {
  display: flex;
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.25rem;
  gap: 0.25rem;
}

.pill-btn {
  background: transparent;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--color-neutral-600);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pill-btn.is-active {
  background: #ffffff;
  color: var(--color-primary-800);
  box-shadow: var(--shadow-xs);
}

/* Grid */
.requests-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.request-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.request-card.is-new {
  border-left: 4px solid var(--color-danger-500);
  background: #fffdfd;
}

.request-card.is-progress {
  border-left: 4px solid var(--color-warning-500);
}

.request-card.is-completed {
  border-left: 4px solid var(--color-success-600);
  opacity: 0.75;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-badge {
  font-size: 1.125rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-neutral-900);
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.request-type-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.type-icon-box {
  width: 38px;
  height: 38px;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.time-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.request-notes {
  font-size: 0.8125rem;
  font-style: italic;
  color: var(--color-neutral-700);
  background: var(--color-neutral-50);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
}

.assigned-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--color-primary-800);
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.75rem;
}

.empty-requests {
  text-align: center;
  padding: 5rem 1rem;
  background: #ffffff;
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  max-width: 500px;
  margin: 2rem auto;
}

.empty-requests h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 1rem 0 0.5rem;
}

.empty-requests p {
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
