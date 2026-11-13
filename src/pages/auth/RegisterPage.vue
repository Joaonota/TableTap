<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/domain/errors'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { AlertCircle, MailCheck, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const fullName = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const errors = ref<Record<string, string>>({})
const error = ref('')
const isLoading = ref(false)
const confirmationSentTo = ref('')

const validate = () => {
  const e: Record<string, string> = {}
  if (!fullName.value.trim()) e.fullName = 'Indique o seu nome.'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) e.email = 'Indique um email válido.'
  if (password.value.length < 8) e.password = 'Use pelo menos 8 caracteres.'
  if (password.value !== passwordConfirm.value) e.passwordConfirm = 'As palavras-passe não coincidem.'
  errors.value = e
  return Object.keys(e).length === 0
}

const handleRegister = async () => {
  error.value = ''
  if (!validate()) return
  isLoading.value = true
  try {
    const { needsEmailConfirmation } = await authStore.signUp(email.value, password.value, fullName.value)
    if (needsEmailConfirmation) {
      confirmationSentTo.value = email.value.trim()
      return
    }
    await authStore.refresh()
    router.replace('/registo/empresa')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <AuthCard
    title="Criar conta"
    :subtitle="confirmationSentTo ? undefined : 'Passo 1 de 2 — os seus dados de acesso.'"
  >
    <div v-if="confirmationSentTo" class="auth-alert auth-alert--success" role="status">
      <MailCheck :size="16" />
      <span>
        Enviámos um email de confirmação para <strong>{{ confirmationSentTo }}</strong>.
        Abra o link do email e depois inicie sessão para registar o seu restaurante.
      </span>
    </div>

    <template v-else>
      <div v-if="error" class="auth-alert auth-alert--error" role="alert">
        <AlertCircle :size="16" />
        <span>{{ error }}</span>
      </div>
      <form class="auth-form" novalidate @submit.prevent="handleRegister">
        <AppInput id="reg-name" v-model="fullName" label="Nome completo" :error="errors.fullName" required />
        <AppInput id="reg-email" v-model="email" label="Email" type="email" placeholder="nome@empresa.co.mz" :error="errors.email" required />
        <AppInput id="reg-password" v-model="password" label="Palavra-passe" type="password" hint="Mínimo de 8 caracteres." :error="errors.password" required />
        <AppInput id="reg-password2" v-model="passwordConfirm" label="Confirmar palavra-passe" type="password" :error="errors.passwordConfirm" required />
        <AppButton type="submit" variant="primary" size="lg" class="auth-submit" :loading="isLoading">
          Criar conta
          <template #icon-right>
            <ArrowRight :size="18" />
          </template>
        </AppButton>
      </form>
    </template>

    <template #footer>
      Já tem conta? <router-link to="/login">Iniciar sessão</router-link>
    </template>
  </AuthCard>
</template>
