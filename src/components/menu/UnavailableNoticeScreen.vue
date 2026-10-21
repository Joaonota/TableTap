<script setup lang="ts">
import type { Restaurant, Table } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import { AlertTriangle, BellRing, Home } from 'lucide-vue-next'

defineProps<{
  restaurant: Restaurant
  table: Table | null
}>()

const emit = defineEmits<{
  (e: 'call-service'): void
  (e: 'go-home'): void
}>()
</script>

<template>
  <div class="unavailable-screen-wrapper">
    <div class="unavailable-card">
      <div class="warning-icon-wrap">
        <AlertTriangle :size="32" />
      </div>

      <div class="card-content">
        <span class="status-pill">Mesa Indisponível</span>
        <h2 class="card-title">Mesa {{ table?.number || 'Selecionada' }} Não Disponível</h2>
        <p class="card-text">
          Esta mesa encontra-se temporariamente desativada para manutenção ou reservada para um evento privado no {{ restaurant.name }}.
        </p>
        <p class="card-sub">
          Não é possível iniciar sessões de atendimento nem enviar pedidos a partir deste código de mesa.
        </p>
      </div>

      <div class="actions-stack">
        <AppButton variant="primary" size="lg" class="full-btn" @click="emit('call-service')">
          <template #icon-left>
            <BellRing :size="18" />
          </template>
          Chamar Garçom / Pedir Assistência
        </AppButton>

        <AppButton variant="secondary" size="md" class="full-btn" @click="emit('go-home')">
          <template #icon-left>
            <Home :size="18" />
          </template>
          Voltar à Página Principal
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unavailable-screen-wrapper {
  min-height: calc(100vh - 4rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.unavailable-card {
  width: 100%;
  max-width: 480px;
  background-color: #ffffff;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-color);
  padding: 2.25rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
}

.warning-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--color-danger-50);
  color: var(--color-danger-600);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.status-pill {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-danger-700);
  background-color: var(--color-danger-50);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
}

.card-title {
  margin: 0.25rem 0 0 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-main);
}

.card-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.card-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.actions-stack {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.full-btn {
  width: 100%;
}
</style>
