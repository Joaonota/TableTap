<script setup lang="ts">
import { Info } from 'lucide-vue-next'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <div class="external-notice" :class="{ 'is-compact': compact }" role="note">
    <Info :size="compact ? 15 : 18" class="notice-icon" />
    <div>
      <p class="notice-title">Esta etiqueta é configurada fisicamente pela equipa TapMenu através de uma aplicação externa.</p>
      <p v-if="!compact" class="notice-text">
        O TapMenu não grava etiquetas pelo navegador. Aqui gere-se apenas o registo: que etiqueta está em que mesa,
        que URL deve conter e em que estado se encontra. A etiqueta contém só a URL permanente da mesa — não muda quando a mesa fica livre ou ocupada.
      </p>
    </div>
  </div>
</template>

<style scoped>
.external-notice {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-primary-200);
  background: var(--color-primary-50);
  border-radius: var(--radius-lg);
  color: var(--color-primary-900);
}

.notice-icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: var(--color-primary-700);
}

.notice-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
}

.notice-text {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--color-primary-800);
}

.is-compact {
  padding: 0.6rem 0.75rem;
}

.is-compact .notice-title {
  font-weight: 600;
  font-size: 0.75rem;
}
</style>
