<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { errorMessage } from '@/domain/errors'
import { homePathFor } from '@/router/homePath'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

const justConfirmed = computed(() => route.query.confirmado === '1')
const passwordReset = computed(() => route.query.redefinida === '1')

onMounted(async () => {
  await authStore.init()
  // Já tem sessão: seguir para a área certa.
  if (authStore.hasSession) await goToApp()
})

const goToApp = async () => {
  if (authStore.needsOnboarding) return router.replace('/registo/empresa')
  if (!authStore.currentUser) return router.replace('/403')
  await tenantStore.loadContext()
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : ''
  return router.replace(redirect || homePathFor(authStore))
}

const handleLogin = async () => {
  error.value = ''
  if (!email.value.trim() || !password.value) {
    error.value = 'Indique o email e a palavra-passe.'
    return
  }
  isLoading.value = true
  try {
    await authStore.signIn(email.value, password.value)
    if (authStore.hasSession && !authStore.currentUser && !authStore.needsOnboarding) {
      error.value = 'A sua conta está desativada. Contacte o responsável da sua empresa.'
      await authStore.logout()
      return
    }
    if (authStore.currentUser) toastStore.success('Sessão iniciada', `Bem-vindo(a), ${authStore.currentUser.name}.`)
    await goToApp()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <AuthCard title="Entrar no TapMenu" subtitle="Aceda ao painel do seu restaurante.">
    <div v-if="justConfirmed" class="auth-alert auth-alert--success" role="status">
      <CheckCircle2 :size="16" />
      <span>Email confirmado. Já pode iniciar sessão.</span>
    </div>
    <div v-if="passwordReset" class="auth-alert auth-alert--success" role="status">
      <CheckCircle2 :size="16" />
      <span>Palavra-passe atualizada. Inicie sessão com a nova palavra-passe.</span>
    </div>
    <div v-if="error" class="auth-alert auth-alert--error" role="alert">
      <AlertCircle :size="16" />
      <span>{{ error }}</span>
    </div>

    <form class="auth-form" novalidate @submit.prevent="handleLogin">
      <AppInput id="login-email" v-model="email" label="Email" type="email" placeholder="nome@empresa.co.mz" required />
      <AppInput id="login-password" v-model="password" label="Palavra-passe" type="password" required />
      <router-link to="/recuperar-palavra-passe" class="auth-link-btn">Esqueceu-se da palavra-passe?</router-link>
      <AppButton type="submit" variant="primary" size="lg" class="auth-submit" :loading="isLoading">
        Entrar
        <template #icon-right>
          <ArrowRight :size="18" />
        </template>
      </AppButton>
    </form>

    <template #footer>
      Ainda não tem conta? <router-link to="/registo">Registe o seu restaurante</router-link>
    </template>
  </AuthCard>
</template>
