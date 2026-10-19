<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { authService, tenantService } from '@/services'
import type { User, Company } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Users, Shield, Building2 } from 'lucide-vue-next'

const users = ref<User[]>([])
const companies = ref<Company[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [u, c] = await Promise.all([
      authService.getDemoUsers(),
      tenantService.getAllCompanies()
    ])
    users.value = u
    companies.value = c
  } finally {
    isLoading.value = false
  }
})

const getCompanyName = (tenantId?: string) => {
  if (!tenantId) return 'Global (Plataforma)'
  return companies.value.find(c => c.id === tenantId)?.name || 'Empresa'
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Utilizadores do Sistema</h1>
        <p class="page-subtitle">Contas com permissões hierárquicas por tenant e restaurante</p>
      </div>
    </div>

    <div class="super-card table-card">
      <table class="super-table">
        <thead>
          <tr>
            <th>Utilizador</th>
            <th>Email</th>
            <th>Empresa (Tenant)</th>
            <th>Papel / Função</th>
            <th>Restaurantes Autorizados</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              <div class="user-row">
                <img
                  :src="u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'"
                  :alt="u.name"
                  class="user-avatar"
                />
                <strong class="text-white">{{ u.name }}</strong>
              </div>
            </td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge badge-neutral">{{ getCompanyName(u.tenantId) }}</span>
            </td>
            <td>
              <span class="role-badge">{{ u.role }}</span>
            </td>
            <td>
              <span class="text-xs text-muted">
                {{ u.role === 'super_admin' ? 'Acesso Global a Todos' : `${u.assignedRestaurantIds.length} restaurantes` }}
              </span>
            </td>
            <td>
              <AppBadge :variant="u.isActive ? 'success' : 'danger'">
                {{ u.isActive ? 'Ativo' : 'Inativo' }}
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

.user-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.text-white { color: #ffffff; }

.role-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #c4b5fd;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid rgba(124, 58, 237, 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
}
</style>
