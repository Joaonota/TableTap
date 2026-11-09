<script setup lang="ts">
import type { Restaurant, Table, TableSession } from '@/types'
import { formatStartTime } from '@/domain/tableRules'
import AppButton from '@/components/ui/AppButton.vue'
import { BookOpen, UtensilsCrossed, UserPlus, BellRing, Clock, Users } from 'lucide-vue-next'

/**
 * Primeiro ecrã ao abrir a URL da mesa (NFC ou QR Code).
 * Mesa livre: pode ver o menu e iniciar a sessão.
 * Mesa ocupada: NÃO bloqueia — pode ver o menu, juntar-se à sessão e chamar o garçom.
 */
defineProps<{
  restaurant: Restaurant
  table: Table
  state: 'free' | 'occupied'
  session: TableSession | null
}>()

const emit = defineEmits<{
  (e: 'view-menu'): void
  (e: 'start-session'): void
  (e: 'join-session'): void
  (e: 'call-service'): void
}>()

</script>

<template>
  <div class="access-wrapper">
    <div class="access-card">
      <div class="access-cover">
        <img :src="restaurant.coverImage" :alt="restaurant.name" class="cover-img" />
        <div class="cover-shade"></div>
        <div class="cover-brand">
          <img :src="restaurant.logoUrl" :alt="`Logótipo ${restaurant.name}`" class="brand-logo" />
          <div>
            <p class="brand-name">{{ restaurant.name }}</p>
            <p class="brand-table">Mesa {{ table.number }} · {{ table.area }}</p>
          </div>
        </div>
      </div>

      <div class="access-body">
        <span class="state-pill" :class="`is-${state}`">
          <span class="dot"></span>
          {{ state === 'free' ? 'Disponível' : 'Ocupada' }}
        </span>

        <template v-if="state === 'free'">
          <h1 class="access-title">Esta mesa está disponível.</h1>
          <p class="access-text">Veja o menu à vontade. Para fazer pedidos, inicie a sessão da mesa com o seu nome.</p>

          <div class="actions">
            <AppButton variant="primary" size="lg" class="full" @click="emit('view-menu')">
              <template #icon-left><BookOpen :size="18" /></template>
              Ver Menu
            </AppButton>
            <AppButton variant="secondary" size="lg" class="full" @click="emit('start-session')">
              <template #icon-left><UtensilsCrossed :size="18" /></template>
              Iniciar sessão na mesa
            </AppButton>
          </div>
        </template>

        <template v-else>
          <h1 class="access-title">Esta mesa está ocupada.</h1>
          <p class="access-text">
            Se está sentado nesta mesa, junte-se à sessão para pedir a partir do seu telemóvel. Os pedidos de todos ficam na mesma conta da mesa.
          </p>

          <div v-if="session" class="session-info">
            <span><Clock :size="14" /> Desde {{ formatStartTime(session.startedAt) }}</span>
            <span v-if="session.participants.length"><Users :size="14" /> {{ session.participants.length }} {{ session.participants.length === 1 ? 'pessoa ligada' : 'pessoas ligadas' }}</span>
          </div>

          <div class="actions">
            <AppButton variant="primary" size="lg" class="full" @click="emit('view-menu')">
              <template #icon-left><BookOpen :size="18" /></template>
              Ver Menu
            </AppButton>
            <AppButton variant="secondary" size="lg" class="full" @click="emit('join-session')">
              <template #icon-left><UserPlus :size="18" /></template>
              Juntar-me a esta mesa
            </AppButton>
            <AppButton variant="ghost" size="md" class="full" @click="emit('call-service')">
              <template #icon-left><BellRing :size="16" /></template>
              Chamar garçom
            </AppButton>
          </div>
        </template>

        <p class="footnote">Não precisa de instalar nenhuma aplicação nem criar conta.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.access-wrapper {
  min-height: calc(100vh - 4rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
}

.access-card {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.access-cover {
  position: relative;
  height: 150px;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.75) 100%);
}

.cover-brand {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #fff;
}

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.85);
}

.brand-name {
  margin: 0;
  font-weight: 800;
  font-size: 1rem;
}

.brand-table {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.9;
}

.access-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.5rem 1.25rem 1.25rem;
}

.state-pill {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
}

.state-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.state-pill.is-free {
  background: var(--color-success-50);
  color: var(--color-success-700);
  border: 1px solid var(--color-success-100);
}

.state-pill.is-occupied {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-200);
}

.access-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
  color: var(--text-main);
}

.access-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.session-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--text-main);
}

.session-info span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.full {
  width: 100%;
}

.footnote {
  margin: 0.25rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
