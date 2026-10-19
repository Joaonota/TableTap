<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { useOrderStore } from '@/stores/order'
import { useCatalogStore } from '@/stores/catalog'
import { useTableStore } from '@/stores/table'
import { useToastStore } from '@/stores/toast'
import { resetDatabase } from '@/services'
import { RotateCcw, UserCheck, ShieldAlert, Sparkles } from 'lucide-vue-next'
import AppButton from './AppButton.vue'

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const orderStore = useOrderStore()
const catalogStore = useCatalogStore()
const tableStore = useTableStore()
const toastStore = useToastStore()

const isResetting = ref(false)

const handleSwitchUser = async (e: Event) => {
  const target = e.target as HTMLSelectElement
  const userId = target.value
  if (!userId) return

  await authStore.switchUser(userId)
  await tenantStore.loadContext()
  await Promise.all([
    orderStore.loadOrders(),
    catalogStore.loadCatalog(),
    tableStore.loadTables()
  ])
  toastStore.success('Perfil Alternado', `Agora a navegar como ${authStore.currentUser?.name} (${authStore.currentUser?.role})`)
}

const handleResetData = async () => {
  if (confirm('Deseja restaurar todos os dados mockados para o estado original? Todas as alterações de teste serão reiniciadas.')) {
    isResetting.value = true
    try {
      resetDatabase()
      await authStore.init()
      await tenantStore.loadContext()
      await Promise.all([
        orderStore.loadOrders(),
        catalogStore.loadCatalog(),
        tableStore.loadTables()
      ])
      toastStore.success('Dados Reiniciados', 'A base de dados mockada foi restaurada com sucesso.')
    } finally {
      isResetting.value = false
    }
  }
}
</script>

<template>
  <div class="demo-banner">
    <div class="demo-banner-content">
      <div class="demo-badge">
        <Sparkles :size="14" />
        <span>MODO DEMO</span>
      </div>

      <div class="demo-text">
        <span class="demo-highlight">Ambiente de Demonstração Multi-Tenant:</span>
        <span class="demo-info">Dados mockados locais. Backend Laravel e PostgreSQL serão acoplados na próxima fase.</span>
      </div>

      <div class="demo-actions">
        <div class="user-switcher">
          <UserCheck :size="15" class="switcher-icon" />
          <select
            :value="authStore.currentUser?.id"
            class="switcher-select"
            aria-label="Alternar perfil de demonstração"
            @change="handleSwitchUser"
          >
            <option
              v-for="u in authStore.availableDemoUsers"
              :key="u.id"
              :value="u.id"
            >
              {{ u.name }} — [{{ u.role }}]
            </option>
          </select>
        </div>

        <AppButton
          variant="secondary"
          size="sm"
          :loading="isResetting"
          @click="handleResetData"
        >
          <template #icon-left>
            <RotateCcw :size="13" />
          </template>
          Reset Dados
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-banner {
  background: linear-gradient(90deg, #1e3a8a 0%, #1e40af 100%);
  color: #ffffff;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  position: relative;
  z-index: 100;
}

.demo-banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  max-width: 1440px;
  margin: 0 auto;
}

.demo-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.35);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 0.6875rem;
  letter-spacing: 0.05em;
}

.demo-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
}

.demo-highlight {
  font-weight: 600;
  color: #ffffff;
}

.demo-info {
  color: #bfdbfe;
}

.demo-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-switcher {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-sm);
  padding: 0.25rem 0.5rem;
}

.switcher-icon {
  color: #93c5fd;
}

.switcher-select {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}

.switcher-select option {
  background-color: #0f172a;
  color: #ffffff;
}

@media (max-width: 900px) {
  .demo-info {
    display: none;
  }
}
</style>
