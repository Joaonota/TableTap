<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { userService, tenantService } from '@/services'
import { ROLE_LABELS, initialsOf } from '@/domain/roles'
import type { User, Company } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { Users, Shield, Building2 } from 'lucide-vue-next'

const users = ref<User[]>([])
const companies = ref<Company[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [u, c] = await Promise.all([
      userService.getAllUsers(),
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
      <div class="table-scroll">
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
          <tr v-if="!isLoading && !users.length">
            <td colspan="6" class="empty-row">Ainda não existem utilizadores com acesso à plataforma.</td>
          </tr>
          <tr v-for="u in users" :key="u.id">
            <td>
              <div class="user-row">
                <img v-if="u.avatarUrl" :src="u.avatarUrl" alt="" class="user-avatar" />
                <span v-else class="user-avatar user-initials" aria-hidden="true">{{ initialsOf(u.name) }}</span>
                <strong class="text-white">{{ u.name }}</strong>
              </div>
            </td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge badge-neutral">{{ getCompanyName(u.tenantId) }}</span>
            </td>
            <td>
              <span class="role-badge">{{ ROLE_LABELS[u.role] }}</span>
            </td>
            <td>
              <span class="text-xs text-muted">
                {{ u.role === 'super_admin' ? 'Acesso a toda a plataforma' : u.role === 'company_owner' ? 'Todos os restaurantes da empresa' : `${u.assignedRestaurantIds.length} ${u.assignedRestaurantIds.length === 1 ? 'restaurante' : 'restaurantes'}` }}
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
  </div>
</template>

<style scoped>
.user-initials {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  font-size: 0.75rem;
  font-weight: 700;
}

.empty-row {
  text-align: center;
  padding: 2rem 1rem !important;
  color: var(--text-muted);
}

.super-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #64748b;
}

.super-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
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
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.super-table td {
  padding: 1rem;
  border-bottom: 1px solid #eef2f6;
  color: #334155;
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

.text-white { color: #0f172a; }

.role-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #6d28d9;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid rgba(124, 58, 237, 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table-scroll .super-table {
  min-width: 860px;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 1.375rem;
  }

  .page-subtitle {
    font-size: 0.8125rem;
  }

  .super-card {
    padding: 0.75rem;
  }
}
</style>
