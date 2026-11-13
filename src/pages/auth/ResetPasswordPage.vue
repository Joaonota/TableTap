<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/domain/errors'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { AlertCircle } from 'lucide-vue-next'

/**
 * Destino do link de recuperação enviado por email. O Supabase abre aqui
 * com uma sessão temporária de recuperação; o utilizador define a nova
 * palavra-passe.
 */
const router = useRouter()
const authStore = useAuthStore()
const password = ref('')
const passwordConfirm = ref('')
const error = ref('')
const isLoading = ref(false)
const linkInvalid = ref(false)

onMounted(async () => {
  await authStore.init()
  // Dá tempo ao cliente Supabase para trocar o código do link pela sessão.
  if (!authStore.hasSession) {
    await new Promise(resolve => setTimeout(resolve, 800))
    await authStore.refresh()
  }
  linkInvalid.value = !authStore.hasSession
})

const handleSubmit = async () => {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'Use pelo menos 8 caracteres.'
    return
  }
  if (password.value !== passwordConfirm.value) {
    error.value = 'As palavras-passe não coincidem.'
    return
  }
  isLoading.value = true
  try {
    await authStore.updatePassword(password.value)
    await authStore.logout()
    router.replace({ path: '/login', query: { redefinida: '1' } })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <AuthCard title="Definir nova palavra-passe">
    <div v-if="linkInvalid" class="auth-alert auth-alert--error" role="alert">
      <AlertCircle :size="16" />
      <span>O link de recuperação é inválido ou expirou. Peça um novo link.</span>
    </div>
    <template v-else>
      <div v-if="error" class="auth-alert auth-alert--error" role="alert">
        <AlertCircle :size="16" />
        <span>{{ error }}</span>
      </div>
      <form class="auth-form" novalidate @submit.prevent="handleSubmit">
        <AppInput id="reset-pass" v-model="password" label="Nova palavra-passe" type="password" hint="Mínimo de 8 caracteres." required />
        <AppInput id="reset-pass2" v-model="passwordConfirm" label="Confirmar nova palavra-passe" type="password" required />
        <AppButton type="submit" variant="primary" size="lg" class="auth-submit" :loading="isLoading">
          Guardar palavra-passe
        </AppButton>
      </form>
    </template>
    <template #footer>
      <router-link :to="linkInvalid ? '/recuperar-palavra-passe' : '/login'">
        {{ linkInvalid ? 'Pedir novo link' : 'Voltar ao início de sessão' }}
      </router-link>
    </template>
  </AuthCard>
</template>
