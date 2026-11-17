<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Restaurant } from '@/types'
import { restaurantService } from '@/services'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { checkGoogleReviewInput } from '@/domain/reviews'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { Star, ExternalLink, Save, CheckCircle2, AlertTriangle } from 'lucide-vue-next'

/**
 * Link de avaliação Google de UM estabelecimento.
 *
 * O link pertence ao estabelecimento (restaurants.google_review_url), nunca
 * à empresa: cada estabelecimento configura, testa e guarda o seu. Guardar
 * altera apenas este campo deste estabelecimento. No fim de uma sessão, o
 * cliente é encaminhado para o link do estabelecimento dessa sessão
 * (get_session_closure lê-o a partir de table_sessions.restaurant_id).
 */
const props = defineProps<{ restaurant: Restaurant }>()
const emit = defineEmits<{ (e: 'saved', url: string): void }>()

const tenantStore = useTenantStore()
const toastStore = useToastStore()

const input = ref('')
const isSaving = ref(false)

watch(
  () => [props.restaurant.id, props.restaurant.googleReviewUrl],
  () => {
    input.value = props.restaurant.googleReviewUrl || ''
  },
  { immediate: true }
)

const check = computed(() => checkGoogleReviewInput(input.value))
const error = computed(() => (check.value.ok ? undefined : check.value.error))
const normalizedUrl = computed(() => (check.value.ok ? check.value.url : ''))
const savedUrl = computed(() => props.restaurant.googleReviewUrl || '')
const isDirty = computed(() => check.value.ok && normalizedUrl.value !== savedUrl.value)

const hint = computed(() => {
  const c = check.value
  if (!c.ok) return undefined
  if (!c.url) return 'Sem link: no fim da sessão o cliente vê apenas o agradecimento.'
  if (c.url !== input.value.trim()) return 'Place ID reconhecido: será guardado como link direto para o formulário de avaliação.'
  if ('kind' in c && c.kind === 'maps') {
    return 'Link do Google Maps: abre a página do estabelecimento. O link "Pedir avaliações" (g.page/r/…/review) abre diretamente o formulário.'
  }
  return 'Link válido.'
})

/** Abre o link num novo separador para confirmar que é a página certa deste estabelecimento. */
const testLink = () => {
  if (!normalizedUrl.value) return
  window.open(normalizedUrl.value, '_blank', 'noopener,noreferrer')
}

const save = async () => {
  if (!check.value.ok) {
    toastStore.error('Link de avaliação Google inválido', check.value.error)
    return
  }
  isSaving.value = true
  try {
    // Só o link deste estabelecimento — nenhum outro campo nem outro estabelecimento.
    await restaurantService.updateRestaurant(props.restaurant.id, { googleReviewUrl: normalizedUrl.value })
    await tenantStore.loadContext()
    input.value = normalizedUrl.value
    toastStore.success(
      normalizedUrl.value ? 'Link do Google guardado' : 'Link do Google removido',
      props.restaurant.name
    )
    emit('saved', normalizedUrl.value)
  } catch (e) {
    toastStore.error('Não foi possível guardar o link', (e as Error).message)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="grl">
    <div class="grl-status" :class="savedUrl ? 'is-ok' : 'is-missing'">
      <CheckCircle2 v-if="savedUrl" :size="15" />
      <AlertTriangle v-else :size="15" />
      <span v-if="savedUrl">
        Link configurado para <strong>{{ restaurant.name }}</strong>.
      </span>
      <span v-else>
        <strong>{{ restaurant.name }}</strong> ainda não tem link: os clientes não recebem o pedido de avaliação.
      </span>
    </div>

    <AppInput
      :id="`google-review-${restaurant.id}`"
      v-model="input"
      label="Link do Google"
      placeholder="https://maps.app.goo.gl/… ou https://g.page/r/…/review"
      :error="error"
      :hint="hint"
    />

    <div class="grl-actions">
      <AppButton type="button" variant="outline" size="sm" :disabled="!normalizedUrl" @click="testLink">
        <template #icon-left><ExternalLink :size="14" /></template>
        Testar link
      </AppButton>
      <AppButton type="button" variant="primary" size="sm" :loading="isSaving" :disabled="!isDirty" @click="save">
        <template #icon-left><Save :size="14" /></template>
        Guardar
      </AppButton>
      <span v-if="isDirty" class="grl-dirty">Alterações por guardar</span>
    </div>

    <details class="grl-help">
      <summary>Onde encontro o link?</summary>
      <ol>
        <li>
          <strong>Google Maps:</strong> abra o estabelecimento → <strong>Partilhar</strong> → copiar link
          (<code>https://maps.app.goo.gl/…</code> ou <code>https://share.google/…</code>).
        </li>
        <li>
          <strong>Perfil da Empresa no Google</strong> (proprietário): <strong>Pedir avaliações</strong> → copiar link
          (<code>https://g.page/r/…/review</code>), que abre diretamente o formulário.
        </li>
      </ol>
      <p>Use o link deste estabelecimento: cada localização tem a sua própria página no Google.</p>
    </details>

    <div class="grl-preview" :class="{ 'is-empty': !normalizedUrl }">
      <span class="grl-preview-label">Pré-visualização para o cliente</span>
      <div class="grl-preview-card">
        <div class="grl-stars" aria-hidden="true">
          <Star v-for="i in 5" :key="i" :size="14" class="grl-star" />
        </div>
        <strong>Google Reviews</strong>
        <p>"Conte-nos como foi a sua experiência."</p>
        <span class="grl-preview-btn" :class="{ 'is-disabled': !normalizedUrl }">Avaliar no Google</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grl {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.grl-status {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.grl-status svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.grl-status.is-ok {
  background: var(--color-success-50, #ecfdf5);
  color: var(--color-success-700, #047857);
}

.grl-status.is-missing {
  background: var(--color-warning-50, #fffbeb);
  color: var(--color-warning-800, #92400e);
}

.grl-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.grl-dirty {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-warning-700, #b45309);
}

.grl-help {
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.85rem;
}

.grl-help summary {
  cursor: pointer;
  font-weight: 600;
}

.grl-help ol {
  margin: 0.5rem 0 0.35rem;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.grl-help p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.grl-help code {
  font-size: 0.72rem;
  background: #fff;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 0 0.25rem;
  word-break: break-all;
}

.grl-preview {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.grl-preview-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.grl-preview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.3rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: #fff;
  font-size: 0.875rem;
}

.grl-preview-card p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.grl-preview.is-empty .grl-preview-card {
  opacity: 0.55;
}

.grl-stars {
  display: flex;
  gap: 0.15rem;
  color: #f59e0b;
}

.grl-star {
  fill: currentColor;
}

.grl-preview-btn {
  margin-top: 0.35rem;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-md);
  background: #1a73e8;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
}

.grl-preview-btn.is-disabled {
  background: var(--color-neutral-300, #cbd5e1);
}
</style>
