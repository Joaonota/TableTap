<script setup lang="ts">
import type { Restaurant, Table, TableSession } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import {
  ShieldAlert,
  Users,
  Eye,
  BellRing,
  Clock,
  Lock,
  ArrowLeft
} from 'lucide-vue-next'

defineProps<{
  restaurant: Restaurant
  table: Table
  session: TableSession | null
}>()

const emit = defineEmits<{
  (e: 'browse-menu'): void
  (e: 'call-service'): void
}>()
</script>

<template>
  <div class="occupied-screen-wrapper">
    <div class="occupied-card">
      <div class="occupied-badge-header">
        <div class="lock-icon-wrap">
          <Lock :size="24" />
        </div>
        <div class="badge-text">
          <span class="status-tag">Mesa em Atendimento</span>
          <h2 class="card-title">Mesa {{ table.number }} Já Está Ocupada</h2>
        </div>
      </div>

      <div class="session-info-box">
        <div class="info-row">
          <span class="info-label">Restaurante:</span>
          <span class="info-value font-bold">{{ restaurant.name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Responsável da Sessão:</span>
          <span class="info-value customer-highlight">{{ session?.customerName || 'Cliente' }}</span>
        </div>
        <div v-if="session?.partySize" class="info-row">
          <span class="info-label">Lotação:</span>
          <span class="info-value"><Users :size="14" class="inline-icon" /> {{ session.partySize }} pessoas</span>
        </div>
        <div v-if="session?.startedAt" class="info-row">
          <span class="info-label">Início do Atendimento:</span>
          <span class="info-value"><Clock :size="14" class="inline-icon" /> {{ new Date(session.startedAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }) }}</span>
        </div>
      </div>

      <div class="explanation-box">
        <ShieldAlert :size="20" class="shield-icon" />
        <p>
          Por motivos de segurança e integridade do atendimento, uma mesa com sessão ativa não pode ser reiniciada por outro visitante. Se estiver sentado nesta mesa com o grupo, pode consultar os itens do menu.
        </p>
      </div>

      <div class="actions-stack">
        <AppButton variant="primary" size="lg" class="full-btn" @click="emit('browse-menu')">
          <template #icon-left>
            <Eye :size="18" />
          </template>
          Consultar Menu em Modo Leitura
        </AppButton>

        <AppButton variant="secondary" size="md" class="full-btn" @click="emit('call-service')">
          <template #icon-left>
            <BellRing :size="18" />
          </template>
          Chamar Garçom / Pedir Troca de Mesa
        </AppButton>
      </div>

      <div class="bottom-note">
        <span>Se é o responsável desta mesa e limpou o navegador, solicite o suporte da receção ou balcão.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.occupied-screen-wrapper {
  min-height: calc(100vh - 4rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.occupied-card {
  width: 100%;
  max-width: 480px;
  background-color: #ffffff;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-color);
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.occupied-badge-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.lock-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-lg);
  background-color: var(--color-amber-100);
  color: var(--color-amber-800);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.badge-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-tag {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-amber-800);
}

.card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-main);
}

.session-info-box {
  background-color: var(--color-slate-50);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
}

.info-label {
  color: var(--text-muted);
}

.info-value {
  color: var(--text-main);
  font-weight: 600;
}

.customer-highlight {
  color: var(--color-primary-800);
  font-weight: 700;
  background-color: #eff6ff;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.inline-icon {
  display: inline;
  vertical-align: middle;
}

.explanation-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background-color: #fefce8;
  border: 1px solid #fef08a;
  border-radius: var(--radius-md);
  padding: 0.875rem 1rem;
  color: #713f12;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.shield-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
  color: #ca8a04;
}

.actions-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.full-btn {
  width: 100%;
}

.bottom-note {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.35;
}
</style>
