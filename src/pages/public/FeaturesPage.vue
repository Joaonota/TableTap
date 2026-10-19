<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import {
  Smartphone,
  ChefHat,
  BellRing,
  QrCode,
  CreditCard,
  BarChart3,
  Building2,
  Lock,
  CheckCircle2
} from 'lucide-vue-next'
</script>

<template>
  <div class="features-page container">
    <div class="page-header">
      <div class="badge badge-primary">MÓDULOS & FUNCIONALIDADES</div>
      <h1 class="page-title">Tecnologia Completa para o Seu Restaurante</h1>
      <p class="page-subtitle">
        Uma suite unificada que substitui impressoras lentas, menus degradados e anotações manuais por uma experiência digital instantânea.
      </p>
    </div>

    <!-- Feature 1: Menu Digital -->
    <div class="feature-row">
      <div class="feature-text">
        <div class="feature-icon"><Smartphone :size="24" /></div>
        <h2>Menu Digital Mobile-First Sem App</h2>
        <p>
          Carrega em menos de 1 segundo em qualquer iPhone ou Android. Apresenta fotos de alta qualidade, variantes de pratos, seleção de complementos e indicação clara de alergénios.
        </p>
        <ul class="feature-bullets">
          <li><CheckCircle2 :size="16" /> Atualização de preços e pratos em tempo real</li>
          <li><CheckCircle2 :size="16" /> Alternância rápida de produtos indisponíveis</li>
          <li><CheckCircle2 :size="16" /> Cálculo automático de taxas (IVA 16%) e gorjeta</li>
        </ul>
        <router-link to="/menu/sabores-maputo/01">
          <AppButton variant="primary">Ver Menu em Ação</AppButton>
        </router-link>
      </div>
      <div class="feature-image">
        <img
          src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
          alt="Menu Digital"
          class="rounded-img"
        />
      </div>
    </div>

    <!-- Feature 2: KDS Cozinha & Bar -->
    <div class="feature-row reverse">
      <div class="feature-text">
        <div class="feature-icon"><ChefHat :size="24" /></div>
        <h2>Kitchen Display System (KDS)</h2>
        <p>
          Monitores dedicados para cozinheiros e barmen. Cada pedido entra em fila visual com cronômetro de urgência por cores (verde, amarelo e vermelho conforme o tempo decorrido).
        </p>
        <ul class="feature-bullets">
          <li><CheckCircle2 :size="16" /> Roteamento inteligente de itens para Cozinha ou Bar</li>
          <li><CheckCircle2 :size="16" /> Transições com toque no ecrã: "Em Preparo" e "Pronto"</li>
          <li><CheckCircle2 :size="16" /> Elimina papel térmico e erros de anotação</li>
        </ul>
        <router-link to="/app/cozinha">
          <AppButton variant="secondary">Abrir Ecrã de Cozinha</AppButton>
        </router-link>
      </div>
      <div class="feature-image">
        <img
          src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
          alt="KDS Cozinha"
          class="rounded-img"
        />
      </div>
    </div>

    <!-- Feature 3: Atendimento Digital & Chamadas de Garçom -->
    <div class="feature-row">
      <div class="feature-text">
        <div class="feature-icon"><BellRing :size="24" /></div>
        <h2>Chamada de Garçom & Pedido de Conta</h2>
        <p>
          O cliente não precisa de levantar o braço ou acenar para a sala. Pelo próprio telemóvel na mesa, pode pedir água, talheres adicionais ou a conta com o método de pagamento preferido.
        </p>
        <ul class="feature-bullets">
          <li><CheckCircle2 :size="16" /> Notificações sonoras e visuais na receção e telemóveis do staff</li>
          <li><CheckCircle2 :size="16" /> Funcionários podem assumir a mesa para evitar duplicidade</li>
          <li><CheckCircle2 :size="16" /> Histórico completo de tempos de resposta da equipa</li>
        </ul>
        <router-link to="/app/atendimento">
          <AppButton variant="outline">Consultar Painel de Chamadas</AppButton>
        </router-link>
      </div>
      <div class="feature-image">
        <img
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
          alt="Atendimento Mesa"
          class="rounded-img"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.features-page {
  padding: 4rem 1.5rem 6rem;
}

.page-header {
  text-align: center;
  max-width: 750px;
  margin: 0 auto 5rem;
}

.page-title {
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  margin: 1rem 0 0.75rem;
}

.page-subtitle {
  font-size: 1.125rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.feature-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  margin-bottom: 6rem;
}

.feature-row.reverse {
  direction: rtl;
}
.feature-row.reverse .feature-text {
  direction: ltr;
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.feature-text h2 {
  font-size: 1.875rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.feature-text p {
  font-size: 1rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.feature-bullets {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.feature-bullets li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-neutral-800);
}

.feature-bullets li svg {
  color: var(--color-success-600);
  flex-shrink: 0;
}

.rounded-img {
  width: 100%;
  height: 380px;
  object-fit: cover;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-subtle);
}

@media (max-width: 900px) {
  .feature-row, .feature-row.reverse {
    grid-template-columns: 1fr;
    direction: ltr;
    gap: 2rem;
  }
  .page-title {
    font-size: 2rem;
  }
}
</style>
