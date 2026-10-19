<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { ShieldAlert, ArrowLeft } from 'lucide-vue-next'
</script>

<template>
  <div class="unauthorized-page container">
    <div class="unauthorized-card">
      <div class="icon-circle">
        <ShieldAlert :size="48" />
      </div>

      <h1 class="error-code">403</h1>
      <h2 class="error-title">Acesso Não Autorizado</h2>
      <p class="error-desc">
        O seu perfil demonstrativo atual não possui permissões para aceder a este restaurante ou módulo administrativo.
      </p>

      <div class="hint-box">
        <p class="text-xs">
          <strong>Dica de Demonstração:</strong> Utilize o seletor de utilizadores no banner azul superior para alternar para uma conta com permissões elevadas, como <strong>Carlos Silva (Super Admin)</strong> ou <strong>Amélia Cossa (Proprietária)</strong>.
        </p>
      </div>

      <router-link to="/app/dashboard">
        <AppButton variant="primary">
          <template #icon-left>
            <ArrowLeft :size="16" />
          </template>
          Voltar ao Dashboard Autorizado
        </AppButton>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.unauthorized-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
}

.unauthorized-card {
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

.icon-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-danger-50);
  color: var(--color-danger-600);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.error-code {
  font-size: 3.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-danger-600);
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
  margin-bottom: 1.5rem;
}

.hint-box {
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.85rem;
  margin-bottom: 2rem;
  text-align: left;
}
</style>
