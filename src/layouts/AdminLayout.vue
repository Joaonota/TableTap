<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { useOrderStore } from '@/stores/order'
import { useServiceRequestStore } from '@/stores/serviceRequest'
import { useCatalogStore } from '@/stores/catalog'
import { useTableStore } from '@/stores/table'
import DemoBanner from '@/components/ui/DemoBanner.vue'
import AppToast from '@/components/ui/AppToast.vue'
import {
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  BellRing,
  Grid,
  ShoppingBag,
  FolderTree,
  QrCode,
  CreditCard,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
  Building2,
  Store,
  Menu,
  X,
  ExternalLink,
  LogOut
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const orderStore = useOrderStore()
const serviceRequestStore = useServiceRequestStore()
const catalogStore = useCatalogStore()
const tableStore = useTableStore()

const isMobileSidebarOpen = ref(false)

const activePendingOrdersCount = computed(() => {
  return orderStore.orders.filter(o => o.status === 'received').length
})

const activeServiceRequestsCount = computed(() => {
  return serviceRequestStore.requests.filter(r => r.status === 'new').length
})

const handleCompanyChange = async (e: Event) => {
  const target = e.target as HTMLSelectElement
  tenantStore.setCompany(target.value)
  await reloadContextData()
}

const handleRestaurantChange = async (e: Event) => {
  const target = e.target as HTMLSelectElement
  tenantStore.setRestaurant(target.value)
  await reloadContextData()
}

const reloadContextData = async () => {
  await Promise.all([
    orderStore.loadOrders(),
    catalogStore.loadCatalog(),
    tableStore.loadTables(),
    serviceRequestStore.loadRequests()
  ])
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

// Watch restaurant change to refresh data
watch(() => tenantStore.currentRestaurant?.id, async (newId) => {
  if (newId) {
    await reloadContextData()
  }
})

onMounted(async () => {
  if (tenantStore.currentRestaurant?.id) {
    await reloadContextData()
  }
})
</script>

<template>
  <div class="admin-wrapper">
    <DemoBanner />

    <!-- Topbar -->
    <header class="admin-topbar">
      <div class="topbar-left">
        <button
          class="mobile-menu-toggle"
          aria-label="Abrir menu"
          @click="isMobileSidebarOpen = !isMobileSidebarOpen"
        >
          <Menu v-if="!isMobileSidebarOpen" :size="20" />
          <X v-else :size="20" />
        </button>

        <router-link to="/app/dashboard" class="brand-logo">
          <div class="brand-badge">
            <UtensilsCrossed :size="18" />
          </div>
          <span class="brand-name">TapMenu</span>
        </router-link>

        <!-- Multi-tenant selectors -->
        <div class="tenant-context-selectors">
          <!-- Company Selector -->
          <div class="selector-item">
            <Building2 :size="16" class="selector-icon" />
            <select
              :value="tenantStore.currentCompany?.id"
              class="context-select"
              aria-label="Selecionar Empresa"
              @change="handleCompanyChange"
            >
              <option
                v-for="company in tenantStore.availableCompanies"
                :key="company.id"
                :value="company.id"
              >
                {{ company.name }}
              </option>
            </select>
          </div>

          <span class="selector-divider">/</span>

          <!-- Restaurant Selector -->
          <div class="selector-item">
            <Store :size="16" class="selector-icon" />
            <select
              :value="tenantStore.currentRestaurant?.id"
              class="context-select"
              aria-label="Selecionar Restaurante"
              @change="handleRestaurantChange"
            >
              <option
                v-for="rest in tenantStore.availableRestaurants"
                :key="rest.id"
                :value="rest.id"
              >
                {{ rest.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="topbar-right">
        <!-- Live Public Menu Shortcut -->
        <a
          v-if="tenantStore.currentRestaurant"
          :href="`/menu/${tenantStore.currentRestaurant.slug}/01`"
          target="_blank"
          class="public-menu-link"
          title="Abrir Menu Público da Mesa 01"
        >
          <span>Ver Menu Público</span>
          <ExternalLink :size="14" />
        </a>

        <!-- Service Requests Alert Bell -->
        <router-link to="/app/atendimento" class="topbar-icon-btn" title="Solicitações de Atendimento">
          <BellRing :size="18" />
          <span v-if="activeServiceRequestsCount > 0" class="badge-counter">
            {{ activeServiceRequestsCount }}
          </span>
        </router-link>

        <!-- Current User Display -->
        <div class="user-profile-widget">
          <img
            :src="authStore.currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'"
            alt="Avatar"
            class="user-avatar"
          />
          <div class="user-meta">
            <span class="user-name">{{ authStore.currentUser?.name }}</span>
            <span class="user-role">{{ authStore.currentUser?.role }}</span>
          </div>
          <button class="logout-btn" title="Terminar sessão" @click="handleLogout">
            <LogOut :size="16" />
          </button>
        </div>
      </div>
    </header>

    <!-- Main Body with Sidebar -->
    <div class="admin-container">
      <aside
        class="admin-sidebar"
        :class="{ 'is-mobile-open': isMobileSidebarOpen }"
        @click.self="isMobileSidebarOpen = false"
      >
        <div class="sidebar-inner">
          <div class="sidebar-nav-group">
            <div class="nav-label">OPERACIONAL</div>

            <router-link
              to="/app/dashboard"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/dashboard' }"
              @click="isMobileSidebarOpen = false"
            >
              <LayoutDashboard :size="18" />
              <span>Dashboard</span>
            </router-link>

            <router-link
              to="/app/pedidos"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/pedidos' }"
              @click="isMobileSidebarOpen = false"
            >
              <UtensilsCrossed :size="18" />
              <span>Pedidos</span>
              <span v-if="activePendingOrdersCount > 0" class="nav-counter">
                {{ activePendingOrdersCount }}
              </span>
            </router-link>

            <router-link
              to="/app/cozinha"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/cozinha' }"
              @click="isMobileSidebarOpen = false"
            >
              <ChefHat :size="18" />
              <span>Cozinha (KDS)</span>
            </router-link>

            <router-link
              to="/app/atendimento"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/atendimento' }"
              @click="isMobileSidebarOpen = false"
            >
              <BellRing :size="18" />
              <span>Atendimento</span>
              <span v-if="activeServiceRequestsCount > 0" class="nav-counter warning">
                {{ activeServiceRequestsCount }}
              </span>
            </router-link>

            <router-link
              to="/app/mesas"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/mesas' }"
              @click="isMobileSidebarOpen = false"
            >
              <Grid :size="18" />
              <span>Gestão de Mesas</span>
            </router-link>
          </div>

          <div class="sidebar-nav-group">
            <div class="nav-label">CATÁLOGO & ACESSO</div>

            <router-link
              to="/app/menu/produtos"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/menu/produtos' }"
              @click="isMobileSidebarOpen = false"
            >
              <ShoppingBag :size="18" />
              <span>Produtos</span>
            </router-link>

            <router-link
              to="/app/menu/categorias"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/menu/categorias' }"
              @click="isMobileSidebarOpen = false"
            >
              <FolderTree :size="18" />
              <span>Categorias</span>
            </router-link>

            <router-link
              to="/app/acesso-digital"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/acesso-digital' }"
              @click="isMobileSidebarOpen = false"
            >
              <QrCode :size="18" />
              <span>Acesso NFC & QR</span>
            </router-link>

            <router-link
              to="/app/pagamentos"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/pagamentos' }"
              @click="isMobileSidebarOpen = false"
            >
              <CreditCard :size="18" />
              <span>Pagamentos</span>
            </router-link>
          </div>

          <div class="sidebar-nav-group">
            <div class="nav-label">GESTÃO & RELATÓRIOS</div>

            <router-link
              to="/app/funcionarios"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/funcionarios' }"
              @click="isMobileSidebarOpen = false"
            >
              <Users :size="18" />
              <span>Funcionários</span>
            </router-link>

            <router-link
              to="/app/relatorios"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/relatorios' }"
              @click="isMobileSidebarOpen = false"
            >
              <BarChart3 :size="18" />
              <span>Relatórios</span>
            </router-link>

            <router-link
              to="/app/configuracoes"
              class="nav-link"
              :class="{ 'is-active': route.path === '/app/configuracoes' }"
              @click="isMobileSidebarOpen = false"
            >
              <Settings :size="18" />
              <span>Configurações</span>
            </router-link>
          </div>

          <!-- Super Admin Group (Only for Super Admin) -->
          <div v-if="authStore.isSuperAdmin" class="sidebar-nav-group super-admin-group">
            <div class="nav-label super-label">PLATAFORMA SAAS</div>
            <router-link
              to="/super-admin/dashboard"
              class="nav-link super-link"
              :class="{ 'is-active': route.path.startsWith('/super-admin') }"
              @click="isMobileSidebarOpen = false"
            >
              <ShieldCheck :size="18" />
              <span>Super Admin</span>
            </router-link>
          </div>
        </div>
      </aside>

      <!-- Main Content View -->
      <main class="admin-main">
        <router-view />
      </main>
    </div>

    <!-- Global Toasts -->
    <AppToast />
  </div>
</template>

<style scoped>
.admin-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-page);
}

.admin-topbar {
  height: var(--topbar-height);
  background: #ffffff;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: var(--shadow-xs);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.mobile-menu-toggle {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  padding: 0.25rem;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  text-decoration: none;
}

.brand-badge {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-family: var(--font-heading);
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  letter-spacing: -0.02em;
}

.tenant-context-selectors {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--color-neutral-50);
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.selector-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.selector-icon {
  color: var(--color-primary-800);
}

.context-select {
  background: transparent;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-800);
  outline: none;
  cursor: pointer;
}

.selector-divider {
  color: var(--color-neutral-300);
  font-weight: 300;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.public-menu-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--color-primary-200);
  transition: all var(--transition-fast);
}

.public-menu-link:hover {
  background-color: var(--color-primary-100);
}

.topbar-icon-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-neutral-600);
  transition: all var(--transition-fast);
}

.topbar-icon-btn:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.badge-counter {
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: var(--color-danger-600);
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: var(--radius-full);
}

.user-profile-widget {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding-left: 0.75rem;
  border-left: 1px solid var(--border-subtle);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 1px solid var(--border-subtle);
}

.user-meta {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-900);
  line-height: 1.2;
}

.user-role {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: capitalize;
}

.logout-btn {
  background: transparent;
  border: none;
  color: var(--color-neutral-400);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.logout-btn:hover {
  color: var(--color-danger-600);
}

/* Sidebar & Main Container */
.admin-container {
  display: flex;
  flex: 1;
}

.admin-sidebar {
  width: var(--sidebar-width);
  background: #ffffff;
  border-right: 1px solid var(--border-subtle);
  min-height: calc(100vh - var(--topbar-height) - 40px);
  position: sticky;
  top: var(--topbar-height);
  flex-shrink: 0;
}

.sidebar-inner {
  padding: 1.25rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sidebar-nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-neutral-400);
  padding: 0 0.75rem 0.375rem 0.75rem;
  letter-spacing: 0.05em;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-neutral-700);
  transition: all var(--transition-fast);
  text-decoration: none;
}

.nav-link:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.nav-link.is-active {
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  font-weight: 600;
}

.nav-counter {
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-600);
  color: #ffffff;
}

.nav-counter.warning {
  background-color: var(--color-warning-500);
}

.super-admin-group {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-subtle);
}

.super-label {
  color: #8b5cf6;
}

.super-link.is-active {
  background-color: #f5f3ff;
  color: #7c3aed;
}

.admin-main {
  flex: 1;
  padding: 1.5rem 2rem;
  max-width: 1440px;
  width: 100%;
}

@media (max-width: 1024px) {
  .tenant-context-selectors {
    display: none;
  }
}

@media (max-width: 768px) {
  .mobile-menu-toggle {
    display: block;
  }
  .admin-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 999;
    transform: translateX(-100%);
    transition: transform var(--transition-normal);
    box-shadow: var(--shadow-xl);
  }
  .admin-sidebar.is-mobile-open {
    transform: translateX(0);
  }
  .user-meta {
    display: none;
  }
  .admin-main {
    padding: 1rem;
  }
}
</style>
