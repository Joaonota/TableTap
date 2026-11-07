<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { mockStorage } from '@/repositories/mock/mockStorage'
import { restaurantService } from '@/services'
import type { Payment, Restaurant } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { CreditCard, Smartphone, Banknote, DollarSign, ArrowUpRight, Search } from 'lucide-vue-next'

const payments = ref<Payment[]>([])
const restaurants = ref<Restaurant[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedMethodFilter = ref('all')

onMounted(async () => {
  try {
    payments.value = mockStorage.getDb().payments || []
    restaurants.value = await restaurantService.getAllRestaurants()
  } finally {
    isLoading.value = false
  }
})

const getRestaurantName = (restaurantId: string) => {
  return restaurants.value.find(r => r.id === restaurantId)?.name || 'Restaurante'
}

const totalProcessed = computed(() => {
  return payments.value
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0)
})

const methodStats = computed(() => {
  const counts: Record<string, { count: number; volume: number }> = {
    mpesa: { count: 0, volume: 0 },
    emola: { count: 0, volume: 0 },
    card: { count: 0, volume: 0 },
    cash: { count: 0, volume: 0 }
  }

  payments.value.forEach(p => {
    const m = p.method as string
    if (counts[m]) {
      counts[m].count++
      if (p.status === 'confirmed') counts[m].volume += p.amount
    }
  })

  return counts
})

const filteredPayments = computed(() => {
  return payments.value.filter(p => {
    const matchesSearch = !searchQuery.value ||
      (p.transactionReference && p.transactionReference.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (p.customerPhone && p.customerPhone.includes(searchQuery.value)) ||
      getRestaurantName(p.restaurantId).toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesMethod = selectedMethodFilter.value === 'all' || p.method === selectedMethodFilter.value

    return matchesSearch && matchesMethod
  })
})

const getMethodLabel = (method: string): string => {
  switch (method) {
    case 'mpesa': return 'M-Pesa (Vodacom)'
    case 'emola': return 'e-Mola (Movitel)'
    case 'card': return 'Cartão Bancário / POS'
    case 'cash': return 'Numerário (Dinheiro)'
    default: return method
  }
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Liquidações & Pagamentos Digitais</h1>
        <p class="page-subtitle">Monitorização das transações financeiras via gateways M-Pesa, e-Mola, Cartão e Numerário</p>
      </div>
    </div>

    <!-- Method Breakdown Cards -->
    <div class="methods-grid">
      <div class="method-card">
        <div class="method-head">
          <span class="method-tag mpesa">M-Pesa</span>
          <Smartphone :size="18" class="text-mpesa" />
        </div>
        <div class="method-vol font-mono">{{ methodStats.mpesa.volume.toLocaleString('pt-MZ') }} MT</div>
        <div class="method-sub">{{ methodStats.mpesa.count }} transações processadas</div>
      </div>

      <div class="method-card">
        <div class="method-head">
          <span class="method-tag emola">e-Mola</span>
          <Smartphone :size="18" class="text-emola" />
        </div>
        <div class="method-vol font-mono">{{ methodStats.emola.volume.toLocaleString('pt-MZ') }} MT</div>
        <div class="method-sub">{{ methodStats.emola.count }} transações processadas</div>
      </div>

      <div class="method-card">
        <div class="method-head">
          <span class="method-tag card">Cartão POS</span>
          <CreditCard :size="18" class="text-card" />
        </div>
        <div class="method-vol font-mono">{{ methodStats.card.volume.toLocaleString('pt-MZ') }} MT</div>
        <div class="method-sub">{{ methodStats.card.count }} transações processadas</div>
      </div>

      <div class="method-card">
        <div class="method-head">
          <span class="method-tag cash">Numerário</span>
          <Banknote :size="18" class="text-cash" />
        </div>
        <div class="method-vol font-mono">{{ methodStats.cash.volume.toLocaleString('pt-MZ') }} MT</div>
        <div class="method-sub">{{ methodStats.cash.count }} pagamentos em balcão</div>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="filters-bar">
      <div class="search-wrap">
        <Search :size="16" class="search-icon" />
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Pesquisar por referência, telefone ou restaurante..."
          class="search-input"
        />
      </div>

      <select v-model="selectedMethodFilter" class="filter-select">
        <option value="all">Todos os Métodos</option>
        <option value="mpesa">M-Pesa</option>
        <option value="emola">e-Mola</option>
        <option value="card">Cartão</option>
        <option value="cash">Numerário</option>
      </select>
    </div>

    <!-- Payments Table -->
    <div class="super-card table-card">
      <div class="table-scroll">
        <table class="super-table">
          <thead>
            <tr>
              <th>Referência / ID</th>
              <th>Restaurante</th>
              <th>Método</th>
              <th>Contacto / Operador</th>
              <th>Valor Bruto</th>
              <th>Estado</th>
              <th>Data & Hora</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pay in filteredPayments" :key="pay.id">
              <td>
                <strong class="font-mono text-white">{{ pay.transactionReference || pay.id }}</strong>
              </td>
              <td>{{ getRestaurantName(pay.restaurantId) }}</td>
              <td>
                <span class="method-pill" :class="pay.method">
                  {{ getMethodLabel(pay.method) }}
                </span>
              </td>
              <td>
                <span v-if="pay.customerPhone" class="font-mono">{{ pay.customerPhone }}</span>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <strong class="font-mono text-price">{{ pay.amount.toLocaleString('pt-MZ') }} MT</strong>
              </td>
              <td>
                <AppBadge :variant="pay.status === 'confirmed' ? 'success' : pay.status === 'pending' ? 'warning' : 'danger'">
                  {{ pay.status === 'confirmed' ? 'CONFIRMADO' : pay.status.toUpperCase() }}
                </AppBadge>
              </td>
              <td>
                <span class="text-xs text-muted">
                  {{ new Date(pay.createdAt).toLocaleDateString('pt-MZ') }} {{ new Date(pay.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </td>
            </tr>

            <tr v-if="filteredPayments.length === 0">
              <td colspan="7" class="text-center py-6 text-muted">
                Nenhum registo de pagamento encontrado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  margin-top: 0.2rem;
}

.methods-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

@media (max-width: 1024px) {
  .methods-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .methods-grid {
    grid-template-columns: 1fr;
  }
}

.method-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.method-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.method-tag {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.method-tag.mpesa { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.method-tag.emola { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.method-tag.card { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
.method-tag.cash { background: rgba(16, 185, 129, 0.15); color: #34d399; }

.text-mpesa { color: #f87171; }
.text-emola { color: #fbbf24; }
.text-card { color: #38bdf8; }
.text-cash { color: #34d399; }

.method-vol {
  font-size: 1.35rem;
  font-weight: 800;
  color: #ffffff;
  margin-top: 0.25rem;
}

.method-sub {
  font-size: 0.7188rem;
  color: #64748b;
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.search-wrap {
  display: flex;
  align-items: center;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0 0.85rem;
  flex: 1;
  max-width: 450px;
}

.search-icon {
  color: #64748b;
  margin-right: 0.5rem;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.65rem 0;
  color: #ffffff;
  font-size: 0.875rem;
  outline: none;
}

.filter-select {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  color: #ffffff;
  font-size: 0.875rem;
  outline: none;
}

.super-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.super-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.super-table th {
  background: #0f172a;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #334155;
}

.super-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #334155;
  color: #cbd5e1;
}

.super-table tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.method-pill {
  font-size: 0.75rem;
  font-weight: 600;
  color: #cbd5e1;
}

.text-price {
  color: #34d399;
}
</style>

