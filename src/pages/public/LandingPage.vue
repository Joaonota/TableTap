<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import {
  Smartphone,
  QrCode,
  Wifi,
  ChefHat,
  CreditCard,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  ShieldCheck,
  ChevronRight
} from 'lucide-vue-next'

const router = useRouter()

const faqs = ref([
  {
    q: 'Os clientes precisam instalar algum aplicativo para aceder ao menu?',
    a: 'Não. Os clientes simplesmente aproximam o telemóvel da tag NFC na mesa ou apontam a câmara para o QR Code. O menu abre instantaneamente no navegador em menos de 1 segundo.',
    open: false
  },
  {
    q: 'Como funciona a integração com M-Pesa e e-Mola?',
    a: 'O TapMenu foi desenhado nativamente para Moçambique. Nesta fase demonstrativa, o fluxo é totalmente simulado com confirmações instantâneas. No ambiente de produção, integra-se via API direta com os serviços das operadoras Vodacom e Movitel.',
    open: false
  },
  {
    q: 'Posso utilizar o TapMenu em múltiplos restaurantes ou filiais?',
    a: 'Sim! O TapMenu é uma plataforma SaaS multi-tenant. Uma mesma empresa pode gerir dezenas de filiais com menus, mesas, funcionários e relatórios completamente individualizados.',
    open: false
  },
  {
    q: 'A cozinha recebe os pedidos instantaneamente?',
    a: 'Sim. O módulo KDS (Kitchen Display System) organiza automaticamente os pedidos por estação (cozinha e bar) com tempos decorridos e alertas de urgência.',
    open: false
  }
])

const toggleFaq = (index: number) => {
  faqs.value[index].open = !faqs.value[index].open
}
</script>

<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-badge">
          <Sparkles :size="14" />
          <span>O Futuro dos Menus em Moçambique</span>
        </div>

        <h1 class="hero-title">
          Menus Digitais, Pedidos Rápidos & <span class="text-gradient">Atendimento Inteligente</span> por NFC e QR Code
        </h1>

        <p class="hero-subtitle">
          Elimine menus em papel desatualizados. Aumente o ticket médio do seu restaurante em até 30% com pedidos na mesa, display de cozinha (KDS) em tempo real e pagamentos via M-Pesa e Cartão.
        </p>

        <div class="hero-cta-group">
          <router-link to="/menu/sabores-maputo/01">
            <AppButton size="lg" variant="primary">
              <template #icon-left>
                <Smartphone :size="18" />
              </template>
              Testar Menu Digital (Mesa 01)
            </AppButton>
          </router-link>

          <router-link to="/app/dashboard">
            <AppButton size="lg" variant="secondary">
              <template #icon-right>
                <ArrowRight :size="18" />
              </template>
              Ver Painel Administrativo
            </AppButton>
          </router-link>
        </div>

        <!-- Hero Feature Highlights -->
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-number">0s</span>
            <span class="stat-label">Sem necessidade de download</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">100%</span>
            <span class="stat-label">Multi-tenant e filiais isoladas</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">M-Pesa</span>
            <span class="stat-label">& e-Mola integrados</span>
          </div>
        </div>

        <!-- Hero Preview Mockup -->
        <div class="hero-mockup">
          <div class="mockup-header">
            <div class="mockup-dots">
              <span></span><span></span><span></span>
            </div>
            <div class="mockup-url">tapmenu.co.mz/menu/sabores-maputo/01</div>
          </div>
          <div class="mockup-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"
              alt="TapMenu Demonstração Restaurante"
              class="mockup-img"
            />
            <div class="mockup-overlay-badge">
              <div class="badge-icon"><CheckCircle2 :size="20" /></div>
              <div>
                <div class="badge-title">Pedido #ORD-101 Recebido</div>
                <div class="badge-desc">Mesa 01 • Frango à Zambeziana</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works (NFC / QR / Orders) -->
    <section class="steps-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Como Funciona a Experiência</h2>
          <p class="section-desc">Três passos simples entre a chegada do cliente à mesa e a preparação do prato.</p>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <div class="step-icon-box">
              <Wifi :size="28" />
            </div>
            <h3 class="step-title">Toque NFC ou QR Code</h3>
            <p class="step-desc">
              O cliente aproxima o smartphone do suporte de mesa com NFC ou aponta a câmara para o código QR. O menu abre automaticamente.
            </p>
          </div>

          <div class="step-card">
            <div class="step-number">2</div>
            <div class="step-icon-box">
              <Smartphone :size="28" />
            </div>
            <h3 class="step-title">Personalização & Pedido</h3>
            <p class="step-desc">
              Visualização de fotos de alta resolução, preços em MT, seleção de pontos da carne, complementos e remoção de ingredientes.
            </p>
          </div>

          <div class="step-card">
            <div class="step-number">3</div>
            <div class="step-icon-box">
              <ChefHat :size="28" />
            </div>
            <h3 class="step-title">Cozinha & Pagamento</h3>
            <p class="step-desc">
              O pedido surge imediatamente no monitor da cozinha (KDS). O cliente pode pagar via M-Pesa, Cartão ou solicitar a conta ao garçom.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Key Benefits Grid -->
    <section class="benefits-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Construído para a Realidade dos Restaurantes</h2>
          <p class="section-desc">Reduza custos operacionais e aumente a rotatividade de mesas com tecnologia moderna.</p>
        </div>

        <div class="benefits-grid">
          <div class="benefit-card">
            <div class="benefit-icon"><Zap :size="24" /></div>
            <h3 class="benefit-title">Atendimento Sem Espera</h3>
            <p class="benefit-desc">
              Os clientes pedem no seu próprio ritmo sem esperar minutos pelo garçom em dias de casa cheia.
            </p>
          </div>

          <div class="benefit-card">
            <div class="benefit-icon"><ChefHat :size="24" /></div>
            <h3 class="benefit-title">KDS para Cozinha e Bar</h3>
            <p class="benefit-desc">
              Elimine bilhetes de papel perdidos. Separação automática entre pratos de cozinha e bebidas de bar.
            </p>
          </div>

          <div class="benefit-card">
            <div class="benefit-icon"><CreditCard :size="24" /></div>
            <h3 class="benefit-title">Pagamentos Móveis</h3>
            <p class="benefit-desc">
              Suporte simulado completo a M-Pesa, e-Mola, Cartão POS e Dinheiro com referência da transação.
            </p>
          </div>

          <div class="benefit-card">
            <div class="benefit-icon"><BarChart3 :size="24" /></div>
            <h3 class="benefit-title">Relatórios & Vendas</h3>
            <p class="benefit-desc">
              Descubra os pratos mais rentáveis, horários de pico, ticket médio e tempos médios de preparo.
            </p>
          </div>

          <div class="benefit-card">
            <div class="benefit-icon"><ShieldCheck :size="24" /></div>
            <h3 class="benefit-title">Isolamento Multi-Tenant</h3>
            <p class="benefit-desc">
              Cada empresa e restaurante possui os seus dados blindados com permissões rigorosas por função.
            </p>
          </div>

          <div class="benefit-card">
            <div class="benefit-icon"><QrCode :size="24" /></div>
            <h3 class="benefit-title">Gerador de QR Code Local</h3>
            <p class="benefit-desc">
              Gere e imprima QR codes elegantes diretamente no navegador sem depender de serviços externos.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="faq-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Perguntas Frequentes</h2>
          <p class="section-desc">Respostas às dúvidas mais comuns sobre a adesão ao TapMenu.</p>
        </div>

        <div class="faq-list">
          <div
            v-for="(faq, i) in faqs"
            :key="i"
            class="faq-item"
            :class="{ 'is-open': faq.open }"
            @click="toggleFaq(i)"
          >
            <div class="faq-question">
              <span>{{ faq.q }}</span>
              <ChevronRight :size="18" class="faq-arrow" />
            </div>
            <div v-if="faq.open" class="faq-answer">
              <p>{{ faq.a }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Final Banner -->
    <section class="final-cta-section">
      <div class="container">
        <div class="final-cta-card">
          <h2 class="cta-heading">Pronto para Modernizar o Seu Estabelecimento?</h2>
          <p class="cta-text">
            Explore agora a demonstração interativa completa com produtos, mesas, KDS e dashboard já configurados.
          </p>
          <div class="cta-buttons">
            <router-link to="/demonstracao">
              <AppButton size="lg" variant="success">
                Explorar Demonstração Completa
              </AppButton>
            </router-link>
            <router-link to="/precos">
              <AppButton size="lg" variant="outline" style="color: #ffffff; border-color: rgba(255,255,255,0.4);">
                Consultar Planos & Preços
              </AppButton>
            </router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-page {
  display: flex;
  flex-direction: column;
}

/* Hero */
.hero-section {
  padding: 5rem 1.5rem 3rem;
  background: radial-gradient(circle at 50% 0%, var(--color-primary-50) 0%, #ffffff 70%);
  text-align: center;
}

.hero-container {
  max-width: 900px;
  margin: 0 auto;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  border: 1px solid var(--color-primary-200);
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--color-neutral-900);
  line-height: 1.15;
  margin-bottom: 1.25rem;
}

.text-gradient {
  background: linear-gradient(135deg, var(--color-primary-800) 0%, #2563eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 1.125rem;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 720px;
  margin: 0 auto 2.5rem;
}

.hero-cta-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 3.5rem;
}

.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 4rem;
  padding: 1.25rem 2rem;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  display: inline-flex;
}

.stat-item {
  display: flex;
  flex-direction: column;
  text-align: center;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-primary-800);
  font-family: var(--font-heading);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background-color: var(--border-subtle);
}

/* Mockup */
.hero-mockup {
  background: #0f172a;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-medium);
  margin-top: 1rem;
}

.mockup-header {
  background: #1e293b;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mockup-dots {
  display: flex;
  gap: 0.35rem;
}
.mockup-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #475569;
}
.mockup-dots span:nth-child(1) { background: #ef4444; }
.mockup-dots span:nth-child(2) { background: #f59e0b; }
.mockup-dots span:nth-child(3) { background: #10b981; }

.mockup-url {
  font-size: 0.75rem;
  font-family: monospace;
  color: #94a3b8;
  background: #0f172a;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  flex: 1;
  text-align: left;
}

.mockup-image-wrap {
  position: relative;
  max-height: 480px;
  overflow: hidden;
}

.mockup-img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

.mockup-overlay-badge {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(8px);
  color: #ffffff;
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: var(--shadow-lg);
  text-align: left;
}

.badge-icon {
  color: #10b981;
}
.badge-title {
  font-size: 0.875rem;
  font-weight: 700;
}
.badge-desc {
  font-size: 0.75rem;
  color: #cbd5e1;
}

/* Sections Common */
.section-header {
  text-align: center;
  max-width: 650px;
  margin: 0 auto 3.5rem;
}

.section-title {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  margin-bottom: 0.75rem;
}

.section-desc {
  font-size: 1rem;
  color: var(--text-muted);
}

/* Steps */
.steps-section {
  padding: 6rem 0;
  background-color: var(--color-neutral-50);
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.step-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 2.5rem 2rem;
  position: relative;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.step-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.step-number {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--color-neutral-200);
  line-height: 1;
}

.step-icon-box {
  width: 56px;
  height: 56px;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.step-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  margin-bottom: 0.75rem;
}

.step-desc {
  font-size: 0.9375rem;
  color: var(--text-muted);
  line-height: 1.6;
}

/* Benefits */
.benefits-section {
  padding: 6rem 0;
}

.benefits-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.benefit-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 2rem;
  transition: all var(--transition-fast);
}

.benefit-card:hover {
  border-color: var(--color-primary-300);
  box-shadow: var(--shadow-sm);
}

.benefit-icon {
  width: 46px;
  height: 46px;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.benefit-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.benefit-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
}

/* FAQ */
.faq-section {
  padding: 5rem 0;
  background-color: var(--color-neutral-50);
}

.faq-list {
  max-width: 750px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.faq-item {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.faq-item:hover {
  border-color: var(--color-primary-300);
}

.faq-question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: var(--color-neutral-900);
}

.faq-arrow {
  color: var(--color-neutral-400);
  transition: transform var(--transition-fast);
}

.faq-item.is-open .faq-arrow {
  transform: rotate(90deg);
  color: var(--color-primary-800);
}

.faq-answer {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.9375rem;
  color: var(--text-muted);
  line-height: 1.6;
}

/* Final CTA */
.final-cta-section {
  padding: 3rem 0;
}

.final-cta-card {
  background: linear-gradient(135deg, var(--color-primary-900) 0%, var(--color-primary-800) 100%);
  color: #ffffff;
  border-radius: var(--radius-xl);
  padding: 4rem 2rem;
  text-align: center;
  max-width: 1000px;
  margin: 0 auto;
  box-shadow: var(--shadow-xl);
}

.cta-heading {
  color: #ffffff;
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.cta-text {
  font-size: 1.125rem;
  color: #bfdbfe;
  max-width: 600px;
  margin: 0 auto 2.5rem;
}

.cta-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .hero-title {
    font-size: 2.25rem;
  }
  .steps-grid, .benefits-grid {
    grid-template-columns: 1fr;
  }
  .mockup-overlay-badge {
    bottom: 1rem;
    left: 1rem;
  }
}
</style>
