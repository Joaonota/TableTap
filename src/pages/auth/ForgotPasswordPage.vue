<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/domain/errors'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { AlertCircle, MailCheck } from 'lucide-vue-next'

const authStore = useAuthStore()
const email = ref('')
const error = ref('')
const sentTo = ref('')
const isLoading = ref(false)

const handleSubmit = async () => {
  error.value = ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
    error.value = 'Indique um email válido.'
    return
  }
  isLoading.value = true
  try {
    await authStore.sendPasswordReset(email.value)
    sentTo.value = email.value.trim()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <AuthCard title="Recuperar palavra-passe" subtitle="Enviamos um link para definir uma nova palavra-passe.">
    <div v-if="sentTo" class="auth-alert auth-alert--success" role="status">
      <MailCheck :size="16" />
      <span>
        Se existir uma conta com <strong>{{ sentTo }}</strong>, vai receber um email com o link de recuperação.
        Verifique também a pasta de spam.
      </span>
    </div>
    <template v-else>
      <div v-if="error" class="auth-alert auth-alert--error" role="alert">
        <AlertCircle :size="16" />
        <span>{{ error }}</span>
      </div>
      <form class="auth-form" novalidate @submit.prevent="handleSubmit">
        <AppInput id="forgot-email" v-model="email" label="Email da conta" type="email" required />
        <AppButton type="submit" variant="primary" size="lg" class="auth-submit" :loading="isLoading">
          Enviar link de recuperação
        </AppButton>
      </form>
    </template>

    <template #footer>
      <router-link to="/login">Voltar ao início de sessão</router-link>
    </template>
  </AuthCard>
</template>
