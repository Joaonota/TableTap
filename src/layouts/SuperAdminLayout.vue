<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppToast from '@/components/ui/AppToast.vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import {
  Building2,
  Store,
  Users,
  Sparkles,
  CreditCard,
  Activity,
  ArrowLeft,
  LayoutDashboard,
  Menu,
  X,
  Zap,
  UtensilsCrossed,
  ShoppingBag,
  DollarSign,
  BarChart3,
  Settings,
  Nfc
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const isMobileSidebarOpen = ref(false)
</script>

<template>
  <div class="super-wrapper">

    <!-- Super Admin Header -->
    <header class="super-header">
      <div class="header-left">
        <button class="mobile-toggle" @click="isMobileSidebarOpen = !isMobileSidebarOpen">
          <Menu v-if="!isMobileSidebarOpen" :size="20" />
          <X v-else :size="20" />
        </button>
        <div class="super-badge-brand">
          <AppLogo :size="26" chip />
          <div>
            <div class="brand-title">TapMenu <span class="role-pill">Super Admin</span></div>
            <div class="brand-sub">Consola de Gestão Global</div>
          </div>
        </div>
      </div>

      <div class="header-right">
        <router-link to="/app/dashboard" class="back-to-app-btn">
          <ArrowLeft :size="16" />
          <span>Voltar ao Restaurante</span>
        </router-link>
      </div>
    </header>

    <div class="super-body">
      <!-- Super Admin Sidebar -->
      <aside class="super-sidebar" :class="{ 'is-open': isMobileSidebarOpen }">
        <div class="sidebar-nav">
          <div class="nav-category">PLATAFORMA</div>

          <router-link
            to="/super-admin/dashboard"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/dashboard' }"
            @click="isMobileSidebarOpen = false"
          >
            <LayoutDashboard :size="18" />
            <span>Métricas Globais</span>
          </router-link>

          <router-link
            to="/super-admin/empresas"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/empresas' }"
            @click="isMobileSidebarOpen = false"
          >
            <Building2 :size="18" />
            <span>Empresas (Tenants)</span>
          </router-link>

          <router-link
            to="/super-admin/restaurantes"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/restaurantes' }"
            @click="isMobileSidebarOpen = false"
          >
            <Store :size="18" />
            <span>Todos os Restaurantes</span>
          </router-link>

          <router-link
            to="/super-admin/utilizadores"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/utilizadores' }"
            @click="isMobileSidebarOpen = false"
          >
            <Users :size="18" />
            <span>Utilizadores do Sistema</span>
          </router-link>

          <div class="nav-category">OPERAÇÃO & VISUAL</div>

          <router-link
            to="/super-admin/menus"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/menus' }"
            @click="isMobileSidebarOpen = false"
          >
            <UtensilsCrossed :size="18" />
            <span>Menus Digitais</span>
          </router-link>

          <router-link
            to="/super-admin/pedidos"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/pedidos' }"
            @click="isMobileSidebarOpen = false"
          >
            <ShoppingBag :size="18" />
            <span>Pedidos Globais</span>
          </router-link>

          <router-link
            to="/super-admin/pagamentos"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/pagamentos' }"
            @click="isMobileSidebarOpen = false"
          >
            <DollarSign :size="18" />
            <span>Pagamentos & Gateways</span>
          </router-link>

          <div class="nav-category">MONETIZAÇÃO & SAAS</div>

          <router-link
            to="/super-admin/planos"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/planos' }"
            @click="isMobileSidebarOpen = false"
          >
            <Sparkles :size="18" />
            <span>Planos Comerciais</span>
          </router-link>

          <router-link
            to="/super-admin/funcionalidades"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/funcionalidades' }"
            @click="isMobileSidebarOpen = false"
          >
            <Zap :size="18" />
            <span>Matriz Funcionalidades</span>
          </router-link>

          <router-link
            to="/super-admin/subscricoes"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/subscricoes' }"
            @click="isMobileSidebarOpen = false"
          >
            <CreditCard :size="18" />
            <span>Subscrições Ativas</span>
          </router-link>

          <router-link
            to="/super-admin/relatorios"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/relatorios' }"
            @click="isMobileSidebarOpen = false"
          >
            <BarChart3 :size="18" />
            <span>Relatórios Executivos</span>
          </router-link>

          <router-link
            to="/super-admin/atividade"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/atividade' }"
            @click="isMobileSidebarOpen = false"
          >
            <Activity :size="18" />
            <span>Auditoria & Atividade</span>
          </router-link>

          <router-link
            to="/super-admin/etiquetas-nfc"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/etiquetas-nfc' }"
            @click="isMobileSidebarOpen = false"
          >
            <Nfc :size="18" />
            <span>Etiquetas NFC</span>
          </router-link>

          <router-link
            to="/super-admin/configuracoes"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/configuracoes' }"
            @click="isMobileSidebarOpen = false"
          >
            <Settings :size="18" />
            <span>Configurações SaaS</span>
          </router-link>
        </div>
      </aside>

      <div v-if="isMobileSidebarOpen" class="sidebar-backdrop" @click="isMobileSidebarOpen = false"></div>

      <!-- Main Super Admin View -->
      <main class="super-main">
        <router-view />
      </main>
    </div>

    <AppToast />
  </div>
</template>

<style scoped>
.super-wrapper {
  min-height: 100vh;
  background-color: var(--bg-page);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
}

.super-header {
  height: 64px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.mobile-toggle {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
}

.mobile-toggle:hover {
  background: var(--color-neutral-100);
}

.super-badge-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-heading);
  font-size: 1.0625rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  line-height: 1.1;
  white-space: nowrap;
}

.role-pill {
  font-family: var(--font-body);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  background: #f5f3ff;
  color: #6d28d9;
  border: 1px solid #ddd6fe;
}

.brand-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}

.back-to-app-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #ffffff;
  color: var(--color-neutral-700);
  padding: 0.45rem 0.875rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--border-medium);
  box-shadow: var(--shadow-xs);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.back-to-app-btn:hover {
  background: var(--color-neutral-50);
  color: var(--color-neutral-900);
  border-color: var(--color-neutral-400);
}

.super-body {
  display: flex;
  flex: 1;
  min-width: 0;
}

.super-sidebar {
  width: 256px;
  background: #ffffff;
  border-right: 1px solid var(--border-subtle);
  flex-shrink: 0;
  position: sticky;
  top: 64px;
  align-self: flex-start;
  height: calc(100vh - 64px);
  overflow-y: auto;
}

.sidebar-nav {
  padding: 1rem 0.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.nav-category {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-neutral-400);
  padding: 1rem 0.75rem 0.375rem;
  letter-spacing: 0.06em;
}

.nav-category:first-child {
  padding-top: 0.25rem;
}

.super-nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-neutral-600);
  text-decoration: none;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.super-nav-link :deep(svg) {
  color: var(--color-neutral-400);
  flex-shrink: 0;
}

.super-nav-link:hover {
  background: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.super-nav-link.is-active {
  background: #f5f3ff;
  color: #5b21b6;
  font-weight: 600;
}

.super-nav-link.is-active :deep(svg) {
  color: #7c3aed;
}

.super-main {
  flex: 1;
  min-width: 0;
  padding: 2rem;
  max-width: 1440px;
  width: 100%;
}

.sidebar-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .mobile-toggle {
    display: inline-flex;
  }
  .super-header {
    padding: 0 1rem;
  }
  .header-left {
    gap: 0.625rem;
  }
  .brand-sub {
    display: none;
  }
  .back-to-app-btn span {
    display: none;
  }
  .back-to-app-btn {
    padding: 0.5rem;
  }
  .super-sidebar {
    position: fixed;
    top: 64px;
    bottom: 0;
    left: 0;
    height: auto;
    z-index: 99;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-xl);
  }
  .super-sidebar.is-open {
    transform: translateX(0);
  }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 64px 0 0 0;
    background: rgba(15, 23, 42, 0.35);
    z-index: 98;
  }
  .super-main {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .super-header {
    padding: 0 0.75rem;
  }
  .brand-title {
    font-size: 0.9375rem;
  }
  .role-pill {
    display: none;
  }
  .super-main {
    padding: 0.875rem 0.75rem;
  }
}
</style>
