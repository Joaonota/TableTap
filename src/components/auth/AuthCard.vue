<script setup lang="ts">
import AppLogo from '@/components/ui/AppLogo.vue'

/** Cartão comum às páginas de autenticação (login, registo, recuperação). */
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <router-link to="/" class="auth-brand" aria-label="TapMenu — página inicial">
          <AppLogo :size="38" />
        </router-link>
        <h1 class="auth-title">{{ title }}</h1>
        <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>
      </div>
      <slot />
      <div v-if="$slots.footer" class="auth-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  background-color: var(--color-neutral-50);
}

.auth-card {
  width: 100%;
  max-width: 460px;
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 2.25rem 2rem;
  box-shadow: var(--shadow-lg);
}

.auth-header {
  text-align: center;
  margin-bottom: 1.75rem;
}

.auth-brand {
  display: inline-flex;
  margin-bottom: 1rem;
}

.auth-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  margin: 0 0 0.25rem;
}

.auth-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0;
}

.auth-footer {
  margin-top: 1.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.auth-footer :deep(a) {
  color: var(--color-primary-700);
  font-weight: 600;
}

@media (max-width: 560px) {
  .auth-page {
    padding: 1.25rem 1rem;
  }
  .auth-card {
    padding: 1.75rem 1.25rem;
  }
  .auth-title {
    font-size: 1.3rem;
  }
}
</style>

<style>
/* Estilos partilhados pelos formulários de autenticação */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.auth-form .auth-submit {
  width: 100%;
  margin-top: 0.25rem;
}

.auth-alert {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  line-height: 1.5;
  margin-bottom: 1.1rem;
}

.auth-alert svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.auth-alert--error {
  background: var(--color-danger-50);
  border: 1px solid var(--color-danger-200);
  color: var(--color-danger-700);
}

.auth-alert--success {
  background: var(--color-success-50);
  border: 1px solid var(--color-success-200);
  color: var(--color-success-800);
}

.auth-alert--info {
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  color: var(--color-primary-900);
}

.auth-link-btn {
  align-self: flex-end;
  background: transparent;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary-700);
  cursor: pointer;
}

.auth-link-btn:hover {
  text-decoration: underline;
}

.auth-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

@media (max-width: 480px) {
  .auth-row {
    grid-template-columns: 1fr;
  }
}
</style>
