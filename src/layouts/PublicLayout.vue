<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DemoBanner from '@/components/ui/DemoBanner.vue'
import AppToast from '@/components/ui/AppToast.vue'
import { UtensilsCrossed, Menu, X, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const isMenuOpen = ref(false)
</script>

<template>
  <div class="public-wrapper">
    <DemoBanner />

    <!-- Public Header -->
    <header class="public-header">
      <div class="header-container">
        <router-link to="/" class="brand">
          <div class="brand-icon">
            <UtensilsCrossed :size="20" />
          </div>
          <span class="brand-title">TapMenu</span>
        </router-link>

        <nav class="desktop-nav">
          <router-link to="/" class="nav-item">Início</router-link>
          <router-link to="/funcionalidades" class="nav-item">Funcionalidades</router-link>
          <router-link to="/precos" class="nav-item">Preços & Planos</router-link>
          <router-link to="/demonstracao" class="nav-item">Demonstração Interativa</router-link>
        </nav>

        <div class="header-actions">
          <router-link to="/login" class="login-link">Iniciar Sessão</router-link>
          <router-link to="/app/dashboard" class="cta-btn">
            <span>Área Restrita</span>
            <ArrowRight :size="15" />
          </router-link>
          <button class="mobile-toggle" aria-label="Toggle Menu" @click="isMenuOpen = !isMenuOpen">
            <Menu v-if="!isMenuOpen" :size="22" />
            <X v-else :size="22" />
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown -->
      <div v-if="isMenuOpen" class="mobile-nav-drawer">
        <router-link to="/" class="mobile-nav-item" @click="isMenuOpen = false">Início</router-link>
        <router-link to="/funcionalidades" class="mobile-nav-item" @click="isMenuOpen = false">Funcionalidades</router-link>
        <router-link to="/precos" class="mobile-nav-item" @click="isMenuOpen = false">Preços & Planos</router-link>
        <router-link to="/demonstracao" class="mobile-nav-item" @click="isMenuOpen = false">Demonstração</router-link>
        <router-link to="/login" class="mobile-nav-item" @click="isMenuOpen = false">Iniciar Sessão</router-link>
        <router-link to="/app/dashboard" class="mobile-cta" @click="isMenuOpen = false">Aceder ao Dashboard</router-link>
      </div>
    </header>

    <!-- Page Content -->
    <main class="public-content">
      <router-view />
    </main>

    <!-- Public Footer -->
    <footer class="public-footer">
      <div class="footer-container">
        <div class="footer-grid">
          <div class="footer-brand-col">
            <div class="brand">
              <div class="brand-icon">
                <UtensilsCrossed :size="18" />
              </div>
              <span class="brand-title">TapMenu</span>
            </div>
            <p class="footer-desc">
              A plataforma SaaS de menus digitais, pedidos inteligentes e atendimento por NFC e QR Code concebida para revolucionar a restauração em Moçambique e além.
            </p>
            <div class="badge badge-success">Operacional em Moçambique (MT)</div>
          </div>

          <div class="footer-links-col">
            <div class="footer-title">PRODUTO</div>
            <router-link to="/funcionalidades">Menu Digital Mobile</router-link>
            <router-link to="/funcionalidades">Kitchen Display System (KDS)</router-link>
            <router-link to="/funcionalidades">Acesso NFC & QR Code</router-link>
            <router-link to="/funcionalidades">Atendimento Inteligente</router-link>
          </div>

          <div class="footer-links-col">
            <div class="footer-title">EMPRESA</div>
            <router-link to="/precos">Planos & Preços</router-link>
            <router-link to="/demonstracao">Guia de Demonstração</router-link>
            <router-link to="/login">Acesso para Clientes</router-link>
            <a href="mailto:contacto@tapmenu.co.mz">contacto@tapmenu.co.mz</a>
          </div>

          <div class="footer-links-col">
            <div class="footer-title">PAGAMENTOS NACIONAIS</div>
            <p class="text-sm text-muted">Compatível com simulações e integrações de:</p>
            <ul class="clean-list">
              <li>• M-Pesa Moçambique</li>
              <li>• e-Mola Movitel</li>
              <li>• Terminais POS / Cartão</li>
              <li>• Pagamentos ao Balcão / Numerário</li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <p>© 2026 TapMenu SaaS. Todos os direitos reservados. Ambiente de demonstração frontend com dados mockados.</p>
        </div>
      </div>
    </footer>

    <AppToast />
  </div>
</template>

<style scoped>
.public-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #ffffff;
}

.public-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
}

.header-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0.875rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  text-decoration: none;
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.desktop-nav {
  display: flex;
  align-items: center;
  gap: 1.75rem;
}

.nav-item {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-neutral-600);
  transition: color var(--transition-fast);
}

.nav-item:hover, .nav-item.router-link-exact-active {
  color: var(--color-primary-800);
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.login-link {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--color-primary-800);
  color: #ffffff;
  padding: 0.55rem 1.15rem;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 4px rgba(30, 64, 175, 0.2);
}

.cta-btn:hover {
  background-color: var(--color-primary-900);
  transform: translateY(-1px);
}

.mobile-toggle {
  display: none;
  background: transparent;
  border: none;
  color: var(--color-neutral-800);
  cursor: pointer;
}

.mobile-nav-drawer {
  display: flex;
  flex-direction: column;
  padding: 1rem 1.5rem 1.5rem;
  background: #ffffff;
  border-top: 1px solid var(--border-subtle);
  gap: 0.75rem;
}

.mobile-nav-item {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-neutral-800);
  padding: 0.5rem 0;
}

.mobile-cta {
  background: var(--color-primary-800);
  color: #ffffff;
  text-align: center;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  margin-top: 0.5rem;
}

.public-content {
  flex: 1;
}

.public-footer {
  background-color: var(--color-neutral-900);
  color: var(--color-neutral-300);
  padding: 4rem 1.5rem 2rem;
  margin-top: 5rem;
}

.footer-container {
  max-width: 1280px;
  margin: 0 auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

.footer-desc {
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 1rem 0;
  color: var(--color-neutral-400);
  max-width: 340px;
}

.footer-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.05em;
  margin-bottom: 1.25rem;
}

.footer-links-col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.footer-links-col a {
  font-size: 0.875rem;
  color: var(--color-neutral-400);
  transition: color var(--transition-fast);
}

.footer-links-col a:hover {
  color: #ffffff;
}

.clean-list {
  list-style: none;
  font-size: 0.8125rem;
  color: var(--color-neutral-400);
  line-height: 1.8;
  margin-top: 0.5rem;
}

.footer-bottom {
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

@media (max-width: 900px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  .desktop-nav {
    display: none;
  }
  .mobile-toggle {
    display: block;
  }
}

@media (max-width: 600px) {
  .footer-grid {
    grid-template-columns: 1fr;
  }
  .login-link {
    display: none;
  }
}
</style>
