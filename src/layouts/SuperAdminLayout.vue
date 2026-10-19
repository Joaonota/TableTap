<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DemoBanner from '@/components/ui/DemoBanner.vue'
import AppToast from '@/components/ui/AppToast.vue'
import {
  ShieldAlert,
  Building2,
  Store,
  Users,
  Sparkles,
  CreditCard,
  Activity,
  ArrowLeft,
  LayoutDashboard,
  Menu,
  X
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const isMobileSidebarOpen = ref(false)
</script>

<template>
  <div class="super-wrapper">
    <DemoBanner />

    <!-- Super Admin Header -->
    <header class="super-header">
      <div class="header-left">
        <button class="mobile-toggle" @click="isMobileSidebarOpen = !isMobileSidebarOpen">
          <Menu v-if="!isMobileSidebarOpen" :size="20" />
          <X v-else :size="20" />
        </button>
        <div class="super-badge-brand">
          <div class="icon-wrap">
            <ShieldAlert :size="20" />
          </div>
          <div>
            <div class="brand-title">TapMenu Master SaaS</div>
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
            to="/super-admin/subscricoes"
            class="super-nav-link"
            :class="{ 'is-active': route.path === '/super-admin/subscricoes' }"
            @click="isMobileSidebarOpen = false"
          >
            <CreditCard :size="18" />
            <span>Subscrições Ativas</span>
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
        </div>
      </aside>

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
  background-color: #090d16;
  color: #f1f5f9;
  display: flex;
  flex-direction: column;
}

.super-header {
  height: 64px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mobile-toggle {
  display: none;
  background: transparent;
  border: none;
  color: #ffffff;
  cursor: pointer;
}

.super-badge-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-wrap {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.brand-title {
  font-family: var(--font-heading);
  font-size: 1.0625rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.1;
}

.brand-sub {
  font-size: 0.6875rem;
  color: #94a3b8;
}

.back-to-app-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  padding: 0.45rem 0.875rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all var(--transition-fast);
}

.back-to-app-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.super-body {
  display: flex;
  flex: 1;
}

.super-sidebar {
  width: 250px;
  background: #0b1120;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.sidebar-nav {
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.nav-category {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #64748b;
  padding: 0.75rem 0.75rem 0.375rem;
  letter-spacing: 0.05em;
}

.super-nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.super-nav-link:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.super-nav-link.is-active {
  background: linear-gradient(90deg, rgba(124, 58, 237, 0.25) 0%, rgba(79, 70, 229, 0.15) 100%);
  color: #c4b5fd;
  border-left: 3px solid #8b5cf6;
  font-weight: 600;
}

.super-main {
  flex: 1;
  padding: 2rem;
  background-color: #090d16;
  max-width: 1440px;
  width: 100%;
}

@media (max-width: 768px) {
  .mobile-toggle {
    display: block;
  }
  .super-sidebar {
    position: fixed;
    top: 64px;
    bottom: 0;
    left: 0;
    z-index: 99;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .super-sidebar.is-open {
    transform: translateX(0);
  }
  .super-main {
    padding: 1rem;
  }
}
</style>
