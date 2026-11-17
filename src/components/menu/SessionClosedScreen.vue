<script setup lang="ts">
import { CheckCircle2, Star, ExternalLink, ArrowLeft, Loader2 } from 'lucide-vue-next'

/**
 * Ecrã final, apresentado SÓ depois de a sessão da mesa ser encerrada.
 * Com `redirecting`, avisa que o Google vai abrir automaticamente e permite
 * ficar no TapMenu; o botão continua disponível caso o navegador não abra.
 *
 * O botão "Avaliar no Google" é um link real para a página oficial de
 * avaliação do estabelecimento (abre o Google / Google Maps diretamente no
 * telemóvel). O TapMenu não mostra nenhum formulário de avaliação próprio,
 * não pede dados de login e não oferece contrapartidas pela avaliação.
 */
defineProps<{
  restaurantName: string
  logoUrl?: string
  coverImage?: string
  /** null = o estabelecimento não configurou o link de avaliação. */
  reviewUrl: string | null
  /** O Google vai abrir automaticamente dentro de instantes. */
  redirecting?: boolean
}>()

const emit = defineEmits<{
  (e: 'review-click'): void
  (e: 'back'): void
  (e: 'cancel-redirect'): void
}>()
</script>

<template>
  <div class="closed-wrapper">
    <div class="closed-card">
      <div class="closed-cover" :class="{ 'has-image': !!coverImage }">
        <img v-if="coverImage" :src="coverImage" alt="" class="cover-img" />
        <div class="cover-shade"></div>
        <img v-if="logoUrl" :src="logoUrl" :alt="restaurantName" class="brand-logo" />
      </div>

      <div class="closed-body">
        <span class="state-pill">
          <CheckCircle2 :size="14" />
          Sessão encerrada
        </span>

        <h1 class="closed-title">
          Obrigado por visitar o <strong>{{ restaurantName }}</strong>.
        </h1>
        <p class="closed-text">Esperamos que tenha gostado da experiência.</p>

        <section v-if="reviewUrl" class="review-box" aria-labelledby="review-heading">
          <div class="review-stars" aria-hidden="true">
            <Star v-for="i in 5" :key="i" :size="18" class="star" />
          </div>
          <h2 id="review-heading" class="review-heading">Avalie-nos no Google</h2>
          <p class="review-text">A sua opinião ajuda outras pessoas a conhecerem-nos.</p>

          <a
            :href="reviewUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="review-btn"
            @click="emit('review-click')"
          >
            <span>Avaliar no Google</span>
            <ExternalLink :size="16" />
          </a>

          <div v-if="redirecting" class="redirect-notice" role="status" aria-live="polite">
            <Loader2 :size="16" class="spin" />
            <span>A abrir o Google para avaliar…</span>
            <button type="button" class="stay-btn" @click="emit('cancel-redirect')">Ficar no TapMenu</button>
          </div>

          <p class="review-note">
            A avaliação é voluntária e feita diretamente no Google. O TapMenu não tem acesso à sua conta Google.
          </p>
        </section>

        <button type="button" class="back-btn" @click="emit('back')">
          <ArrowLeft :size="15" />
          Voltar ao menu
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.closed-wrapper {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  background: var(--color-neutral-50, #f8fafc);
}

.closed-card {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.closed-cover {
  position: relative;
  height: 72px;
  background: linear-gradient(135deg, var(--color-primary-700, #0d7a5f), var(--color-primary-500, #14a37f));
}

.closed-cover.has-image {
  height: 130px;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.55) 100%);
}

.brand-logo {
  position: absolute;
  left: 1.25rem;
  bottom: -26px;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  object-fit: cover;
  background: #fff;
  border: 3px solid #fff;
  box-shadow: var(--shadow-md);
}

.closed-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 2.25rem 1.25rem 1.25rem;
}

.state-pill {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-success-50, #ecfdf5);
  color: var(--color-success-700, #047857);
}

.closed-title {
  margin: 0;
  font-size: 1.3rem;
  line-height: 1.35;
  font-weight: 600;
  color: var(--color-neutral-900, #0f172a);
}

.closed-title strong {
  font-weight: 800;
}

.closed-text {
  margin: 0;
  font-size: 0.925rem;
  color: var(--text-muted, #64748b);
}

.review-box {
  margin-top: 0.5rem;
  padding: 1.1rem 1rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg);
  background: var(--color-neutral-50, #f8fafc);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.4rem;
}

.review-stars {
  display: flex;
  gap: 0.2rem;
  color: #f59e0b;
}

.star {
  fill: currentColor;
}

.review-heading {
  margin: 0.15rem 0 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--color-neutral-900, #0f172a);
}

.review-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted, #64748b);
}

/* Alvo de toque grande (≥ 48px) para telemóvel. */
.review-btn {
  margin-top: 0.5rem;
  width: 100%;
  min-height: 50px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: #1a73e8;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, transform 0.1s ease;
}

.review-btn:hover {
  background: #1765cc;
}

.review-btn:active {
  transform: scale(0.98);
}

.review-btn:focus-visible {
  outline: 3px solid rgba(26, 115, 232, 0.4);
  outline-offset: 2px;
}

.redirect-notice {
  width: 100%;
  margin-top: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #1a73e8;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.stay-btn {
  min-height: 36px;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--color-neutral-700, #334155);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.review-note {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--text-muted, #64748b);
}

.back-btn {
  align-self: center;
  margin-top: 0.25rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0.5rem 0.9rem;
  border: none;
  background: none;
  color: var(--text-muted, #64748b);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.back-btn:hover {
  color: var(--color-neutral-900, #0f172a);
}
</style>
