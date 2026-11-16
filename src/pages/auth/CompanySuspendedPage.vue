<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { homePathFor, pendingStepPath, COMPANY_SUSPENDED_PATH } from '@/router/homePath'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { Ban, RefreshCw } from 'lucide-vue-next'

/**
 * A empresa da conta foi suspensa pelo Super Admin do Sistema. O bloqueio
 * real é feito na base de dados (RLS): com a empresa suspensa, a equipa
 * não lê nem altera nenhum dado. Os dados mantêm-se até a empresa ser reativada.
 */
const router = useRouter()
const authStore = useAuthStore()

const leaveIfResolved = () => {
  const pending = pendingStepPath(authStore)
  if (!authStore.hasSession) router.replace('/login')
  else if (pending !== COMPANY_SUSPENDED_PATH) router.replace(pending ?? homePathFor(authStore))
}

onMounted(async () => {
  await authStore.init()
  leaveIfResolved()
})

const checkAgain = async () => {
  await authStore.refresh()
  leaveIfResolved()
}

const handleLogout = async () => {
  await authStore.logout()
  router.replace('/login')
}
</script>

<template>
  <AuthCard title="Empresa suspensa" subtitle="O acesso da sua empresa ao TapMenu está temporariamente suspenso.">
    <div class="auth-alert auth-alert--error">
      <Ban :size="16" />
      <span>
        Sessão iniciada como <strong>{{ authStore.accountEmail }}</strong>. Os dados da empresa estão guardados, mas o
        painel, os menus públicos e os pedidos ficam indisponíveis até a equipa TapMenu reativar a conta. Contacte o
        suporte TapMenu para mais informações.
      </span>
    </div>

    <AppButton variant="outline" size="lg" class="auth-submit" :loading="authStore.isLoading" @click="checkAgain">
      <template #icon-left>
        <RefreshCw :size="16" />
      </template>
      Verificar novamente
    </AppButton>

    <template #footer>
      <button type="button" class="auth-link-btn" @click="handleLogout">Terminar sessão</button>
    </template>
  </AuthCard>
</template>
