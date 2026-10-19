<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { subscriptionService } from '@/services'
import { useToastStore } from '@/stores/toast'
import type { Subscription, SubscriptionStatus } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { CreditCard, Calendar, CheckCircle2, AlertTriangle } from 'lucide-vue-next'

const toastStore = useToastStore()
const subscriptions = ref<Subscription[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    subscriptions.value = await subscriptionService.getAllSubscriptions()
  } finally {
    isLoading.value = false
  }
})

const handleStatusChange = async (sub: Subscription, newStatus: SubscriptionStatus) => {
  try {
    const updated = await subscriptionService.updateSubscription(sub.id, { status: newStatus })
    const idx = subscriptions.value.findIndex(s => s.id === sub.id)
    if (idx !== -1) subscriptions.value[idx] = updated
    toastStore.success('Subscrição Atualizada', `${sub.companyName} agora está com status ${newStatus.toUpperCase()}`)
  } catch (e) {
    toastStore.error('Erro ao atualizar subscrição', (e as Error).message)
  }
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Subscrições & Faturamento SaaS</h1>
        <p class="page-subtitle">Acompanhamento de contratos, renovações e status das empresas</p>
      </div>
    </div>

    <div class="super-card table-card">
      <table class="super-table">
        <thead>
          <tr>
            <th>Empresa Cliente</th>
            <th>Plano Contratado</th>
            <th>Valor Mensal</th>
            <th>Data de Início</th>
            <th>Próxima Renovação</th>
            <th>Estado</th>
            <th class="text-right">Ação Super Admin</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sub in subscriptions" :key="sub.id">
            <td>
              <strong class="text-white">{{ sub.companyName }}</strong>
            </td>
            <td>
              <span class="badge badge-primary">{{ sub.planName }}</span>
            </td>
            <td>
              <strong class="text-purple">{{ sub.monthlyPrice.toLocaleString('pt-MZ') }} MT</strong>
            </td>
            <td>{{ sub.startDate }}</td>
            <td>{{ sub.renewalDate }}</td>
            <td>
              <AppBadge
                :variant="
                  sub.status === 'active' ? 'success' :
                  sub.status === 'trial' ? 'warning' : 'danger'
                "
              >
                {{ sub.status }}
              </AppBadge>
            </td>
            <td class="text-right">
              <select
                :value="sub.status"
                class="status-dropdown"
                @change="handleStatusChange(sub, ($event.target as HTMLSelectElement).value as SubscriptionStatus)"
              >
                <option value="active">Definir como Ativa</option>
                <option value="trial">Período de Teste (Trial)</option>
                <option value="suspended">Suspender Subscrição</option>
                <option value="expired">Marcar como Expirada</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.super-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
}

.super-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.super-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.super-table th {
  padding: 0.875rem 1rem;
  font-size: 0.75rem;
  color: #64748b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: #111827;
}

.super-table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
}

.text-white { color: #ffffff; }
.text-purple { color: #c4b5fd; }

.status-dropdown {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  outline: none;
  cursor: pointer;
}

.text-right {
  text-align: right;
}
</style>
