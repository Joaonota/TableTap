<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { authService } from '@/services'
import { errorMessage } from '@/domain/errors'
import { homePathFor, pendingStepPath } from '@/router/homePath'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { AlertCircle, Info, KeyRound, Loader2 } from 'lucide-vue-next'

/**
 * Primeiro acesso do responsável de um estabelecimento.
 *
 * Abre a partir do link de convite emitido pelo Super Admin:
 *  - ?token_hash=…&type=invite  (link gerado pelo TapMenu ou modelo de email ajustado);
 *  - #access_token=…&refresh_token=…  (modelo de email padrão do Supabase).
 * Valida o link, inicia a sessão e obriga a definir uma palavra-passe.
 * Também é o destino de qualquer conta marcada para mudar a palavra-passe.
 */
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

type State = 'loading' | 'form' | 'invalid'
const state = ref<State>('loading')
const invalidReason = ref('')
const password = ref('')
const passwordConfirm = ref('')
const errors = ref<{ password?: string; confirm?: string }>({})
const error = ref('')
const isSaving = ref(false)

const VERIFY_TYPES = ['invite', 'recovery', 'magiclink', 'email'] as const
type VerifyType = (typeof VERIFY_TYPES)[number]

const passwordChecks = computed(() => [
  { label: 'Pelo menos 8 caracteres', ok: password.value.length >= 8 },
  { label: 'Pelo menos uma letra', ok: /[A-Za-zÀ-ÿ]/.test(password.value) },
  { label: 'Pelo menos um número', ok: /\d/.test(password.value) }
])

const goNext = () => router.replace(pendingStepPath(authStore) ?? homePathFor(authStore))

onMounted(async () => {
  await authStore.init()

  const tokenHash = typeof route.query.token_hash === 'string' ? route.query.token_hash : ''
  const typeParam = typeof route.query.type === 'string' ? route.query.type : 'invite'
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  try {
    if (tokenHash) {
      const type: VerifyType = (VERIFY_TYPES as readonly string[]).includes(typeParam) ? (typeParam as VerifyType) : 'invite'
      await authService.verifyEmailToken(tokenHash, type)
      await router.replace({ path: route.path })
      await authStore.refresh()
    } else if (hash.get('access_token') && hash.get('refresh_token')) {
      await authService.setSessionFromTokens(hash.get('access_token')!, hash.get('refresh_token')!)
      history.replaceState(null, '', route.path)
      await authStore.refresh()
    } else if (hash.get('error')) {
      invalidReason.value = hash.get('error_description')?.replace(/\+/g, ' ') ?? ''
      history.replaceState(null, '', route.path)
    }
  } catch (e) {
    invalidReason.value = errorMessage(e)
  }

  if (!authStore.hasSession) {
    state.value = 'invalid'
    return
  }
  // Conta que já definiu a palavra-passe: seguir para a aplicação.
  if (!authStore.mustSetPassword && !tokenHash && !hash.get('access_token')) {
    goNext()
    return
  }
  state.value = 'form'
})

const handleSubmit = async () => {
  error.value = ''
  const e: typeof errors.value = {}
  if (passwordChecks.value.some(c => !c.ok)) e.password = 'A palavra-passe não cumpre os requisitos.'
  if (password.value !== passwordConfirm.value) e.confirm = 'As palavras-passe não coincidem.'
  errors.value = e
  if (Object.keys(e).length) return

  isSaving.value = true
  try {
    await authStore.completeFirstAccess(password.value)
    toastStore.success('Palavra-passe definida', 'A partir de agora entra com o seu email e esta palavra-passe.')
    goNext()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    isSaving.value = false
  }
}

const handleLogout = async () => {
  await authStore.logout()
  router.replace('/login')
}
</script>

<template>
  <AuthCard
    title="Bem-vindo(a) ao TapMenu"
    :subtitle="state === 'form' ? 'Defina a sua palavra-passe para ativar o acesso ao seu estabelecimento.' : undefined"
  >
    <div v-if="state === 'loading'" class="accept-loading">
      <Loader2 :size="22" class="spin" />
      <span>A validar o convite…</span>
    </div>

    <template v-else-if="state === 'invalid'">
      <div class="auth-alert auth-alert--error" role="alert">
        <AlertCircle :size="16" />
        <span>
          O link de convite é inválido, já foi usado ou expirou.
          <template v-if="invalidReason"><br /><small>{{ invalidReason }}</small></template>
        </span>
      </div>
      <p class="accept-help">
        Peça à equipa TapMenu um novo convite. Se já definiu a palavra-passe, entre normalmente — e, se a esqueceu,
        use a recuperação de palavra-passe.
      </p>
    </template>

    <template v-else>
      <div class="auth-alert auth-alert--info">
        <Info :size="16" />
        <span>Conta: <strong>{{ authStore.accountEmail }}</strong></span>
      </div>
      <div v-if="error" class="auth-alert auth-alert--error" role="alert">
        <AlertCircle :size="16" />
        <span>{{ error }}</span>
      </div>

      <form class="auth-form" novalidate @submit.prevent="handleSubmit">
        <AppInput
          id="invite-pass"
          v-model="password"
          label="Nova palavra-passe"
          type="password"
          :error="errors.password"
          required
        />
        <ul class="pass-checks" aria-label="Requisitos da palavra-passe">
          <li v-for="c in passwordChecks" :key="c.label" :class="{ ok: c.ok }">{{ c.ok ? '✓' : '•' }} {{ c.label }}</li>
        </ul>
        <AppInput
          id="invite-pass2"
          v-model="passwordConfirm"
          label="Confirmar palavra-passe"
          type="password"
          :error="errors.confirm"
          required
        />
        <AppButton type="submit" variant="primary" size="lg" class="auth-submit" :loading="isSaving">
          <template #icon-left>
            <KeyRound :size="18" />
          </template>
          Ativar acesso
        </AppButton>
      </form>
    </template>

    <template #footer>
      <router-link v-if="state === 'invalid'" to="/login">Ir para o início de sessão</router-link>
      <button v-else-if="state === 'form'" type="button" class="auth-link-btn" @click="handleLogout">Sair</button>
    </template>
  </AuthCard>
</template>

<style scoped>
.accept-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 1.5rem 0;
  color: var(--text-muted);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.accept-help {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0.75rem 0 0;
}

.pass-checks {
  list-style: none;
  margin: -0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.pass-checks li.ok {
  color: var(--color-success-600, #15803d);
}
</style>
