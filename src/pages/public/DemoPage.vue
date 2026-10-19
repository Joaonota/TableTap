<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import {
  Smartphone,
  ChefHat,
  ShieldCheck,
  QrCode,
  Building2,
  ArrowRight,
  ExternalLink,
  CheckCircle2
} from 'lucide-vue-next'
</script>

<template>
  <div class="demo-guide-page container">
    <div class="demo-header">
      <div class="badge badge-primary">ROTEIRO DE DEMONSTRAÇÃO</div>
      <h1 class="demo-title">Guia Interativo de Avaliação do TapMenu</h1>
      <p class="demo-subtitle">
        Siga os passos abaixo para testar o ecossistema completo do cliente à cozinha e administração global.
      </p>
    </div>

    <div class="demo-steps-container">
      <!-- Card 1 -->
      <div class="demo-step-row">
        <div class="step-badge-col">
          <div class="step-num">01</div>
        </div>
        <div class="step-content-card">
          <div class="step-header">
            <Smartphone :size="22" class="step-icon" />
            <h3>Experiência do Cliente na Mesa</h3>
          </div>
          <p>
            Abra a rota do menu simulando um cliente que encostou o telemóvel na tag NFC ou leu o QR Code da <strong>Mesa 01 do restaurante Sabores Maputo</strong>.
          </p>
          <div class="step-actions">
            <router-link to="/menu/sabores-maputo/01" target="_blank">
              <AppButton variant="primary">
                <span>Abrir Menu da Mesa 01</span>
                <ExternalLink :size="15" />
              </AppButton>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Card 2 -->
      <div class="demo-step-row">
        <div class="step-badge-col">
          <div class="step-num">02</div>
        </div>
        <div class="step-content-card">
          <div class="step-header">
            <ChefHat :size="22" class="step-icon" />
            <h3>Monitor de Cozinha em Tempo Real (KDS)</h3>
          </div>
          <p>
            Ao criar um pedido no menu, abra o ecrã KDS. Verifique os cartões de pedidos com cronômetro decorrido e avance o estado para <em>"Preparando"</em> e <em>"Pronto"</em>.
          </p>
          <div class="step-actions">
            <router-link to="/app/cozinha">
              <AppButton variant="secondary">
                <span>Aceder ao KDS da Cozinha</span>
                <ArrowRight :size="15" />
              </AppButton>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Card 3 -->
      <div class="demo-step-row">
        <div class="step-badge-col">
          <div class="step-num">03</div>
        </div>
        <div class="step-content-card">
          <div class="step-header">
            <Building2 :size="22" class="step-icon" />
            <h3>Isolamento Multi-Tenant Entre Empresas</h3>
          </div>
          <p>
            No topo do painel administrativo, mude a empresa ativa de <strong>Sabores de Moçambique</strong> para <strong>Ocean Food Group</strong>. Note que o catálogo, mesas, pedidos e faturamento mudam 100% de forma isolada!
          </p>
          <div class="step-actions">
            <router-link to="/app/dashboard">
              <AppButton variant="outline">
                <span>Ir ao Dashboard e Alternar Tenant</span>
                <ArrowRight :size="15" />
              </AppButton>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Card 4 -->
      <div class="demo-step-row">
        <div class="step-badge-col">
          <div class="step-num">04</div>
        </div>
        <div class="step-content-card">
          <div class="step-header">
            <QrCode :size="22" class="step-icon" />
            <h3>Acesso Digital (QR Code & NFC)</h3>
          </div>
          <p>
            Gere o código QR localmente na hora para qualquer mesa, copie a URL direta e teste a simulação da gravação de tags NFC com registo no histórico de auditoria.
          </p>
          <div class="step-actions">
            <router-link to="/app/acesso-digital">
              <AppButton variant="primary">
                <span>Ver Módulo Acesso Digital</span>
                <ArrowRight :size="15" />
              </AppButton>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Card 5 -->
      <div class="demo-step-row">
        <div class="step-badge-col">
          <div class="step-num">05</div>
        </div>
        <div class="step-content-card">
          <div class="step-header">
            <ShieldCheck :size="22" class="step-icon" />
            <h3>Super Admin da Plataforma SaaS</h3>
          </div>
          <p>
            Entre com a conta <strong>Carlos Silva (Super Admin)</strong> através do banner superior e explore a visão master de todas as empresas clientes, planos, subscrições ativas e receita recorrente.
          </p>
          <div class="step-actions">
            <router-link to="/super-admin/dashboard">
              <AppButton variant="secondary">
                <span>Painel Super Admin</span>
                <ArrowRight :size="15" />
              </AppButton>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-guide-page {
  padding: 4rem 1.5rem 6rem;
}

.demo-header {
  text-align: center;
  max-width: 750px;
  margin: 0 auto 4rem;
}

.demo-title {
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  margin: 1rem 0 0.75rem;
}

.demo-subtitle {
  font-size: 1.125rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.demo-steps-container {
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.demo-step-row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.step-badge-col {
  display: flex;
  justify-content: center;
}

.step-num {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  border: 2px solid var(--color-primary-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  font-weight: 800;
  font-family: var(--font-heading);
}

.step-content-card {
  flex: 1;
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 1.75rem 2rem;
  box-shadow: var(--shadow-sm);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.step-icon {
  color: var(--color-primary-800);
}

.step-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.step-content-card p {
  font-size: 0.9375rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

.step-actions {
  display: flex;
  gap: 0.75rem;
}

@media (max-width: 650px) {
  .demo-step-row {
    flex-direction: column;
  }
}
</style>
