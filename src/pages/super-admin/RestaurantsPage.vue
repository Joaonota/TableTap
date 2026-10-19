<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { restaurantService, tenantService } from '@/services'
import type { Restaurant, Company } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Store, ExternalLink } from 'lucide-vue-next'

const restaurants = ref<Restaurant[]>([])
const companies = ref<Company[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [r, c] = await Promise.all([
      restaurantService.getAllRestaurants(),
      tenantService.getAllCompanies()
    ])
    restaurants.value = r
    companies.value = c
  } finally {
    isLoading.value = false
  }
})

const getCompanyName = (tenantId: string) => {
  return companies.value.find(c => c.id === tenantId)?.name || 'Empresa'
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Restaurantes da Plataforma</h1>
        <p class="page-subtitle">Todas as filiais ativas agrupadas pelos respetivos tenants SaaS</p>
      </div>
    </div>

    <div class="super-card table-card">
      <table class="super-table">
        <thead>
          <tr>
            <th>Restaurante</th>
            <th>Empresa Proprietária</th>
            <th>Localização</th>
            <th>Contactos</th>
            <th>IVA</th>
            <th>Menu Público</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in restaurants" :key="r.id">
            <td>
              <div class="rest-row">
                <img :src="r.logoUrl" :alt="r.name" class="rest-logo" />
                <div>
                  <strong class="text-white">{{ r.name }}</strong>
                  <div class="text-xs text-muted">{{ r.slug }}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="badge badge-primary">{{ getCompanyName(r.tenantId) }}</span>
            </td>
            <td>
              <div>{{ r.address.city }}</div>
              <div class="text-xs text-muted">{{ r.address.street }}</div>
            </td>
            <td>
              <div>{{ r.phone }}</div>
              <div class="text-xs text-muted">{{ r.email }}</div>
            </td>
            <td>{{ r.taxRate }}%</td>
            <td>
              <a :href="`/menu/${r.slug}/01`" target="_blank" class="menu-link">
                <span>Abrir Mesa 01</span>
                <ExternalLink :size="13" />
              </a>
            </td>
            <td>
              <AppBadge :variant="r.isActive ? 'success' : 'danger'">
                {{ r.isActive ? 'Ativo' : 'Inativo' }}
              </AppBadge>
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

.rest-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rest-logo {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.text-white { color: #ffffff; }

.menu-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #a78bfa;
}

.menu-link:hover {
  text-decoration: underline;
}
</style>
