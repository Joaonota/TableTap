<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { ArrowLeft, UtensilsCrossed } from 'lucide-vue-next'
</script>

<template>
  <div class="error-page container">
    <div class="error-card">
      <div class="error-icon-box">
        <UtensilsCrossed :size="48" />
      </div>

      <h1 class="error-code">404</h1>
      <h2 class="error-title">Página Não Encontrada</h2>
      <p class="error-desc">
        O endereço que procurou não existe, foi movido ou a mesa/restaurante selecionado não se encontra disponível.
      </p>

      <div class="error-actions">
        <router-link to="/">
          <AppButton variant="primary">
            <template #icon-left>
              <ArrowLeft :size="16" />
            </template>
            Voltar ao Início
          </AppButton>
        </router-link>

        <router-link to="/app/dashboard">
          <AppButton variant="secondary">
            Ir ao Dashboard
          </AppButton>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
}

.error-card {
  max-width: 500px;
  width: 100%;
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.error-icon-box {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.error-code {
  font-size: 3.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-primary-800);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  margin-bottom: 0.75rem;
}

.error-desc {
  font-size: 0.9375rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.error-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
