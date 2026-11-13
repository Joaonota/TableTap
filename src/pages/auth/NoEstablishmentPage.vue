<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { homePathFor, pendingStepPath, NO_ESTABLISHMENT_PATH } from '@/router/homePath'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { Info, RefreshCw } from 'lucide-vue-next'

/**
 * Conta autenticada sem estabelecimento associado. O TapMenu não tem
 * registo público: o acesso é criado pela equipa TapMenu (pré-registo) ou
 * por um responsável que adiciona a pessoa à equipa do estabelecimento.
 */
const router = useRouter()
const authStore = useAuthStore()

const leaveIfResolved = () => {
  const pending = pendingStepPath(authStore)
  if (!authStore.hasSession) router.replace('/login')
  else if (pending !== NO_ESTABLISHMENT_PATH) router.replace(pending ?? homePathFor(authStore))
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
  <AuthCard title="Conta sem estabelecimento" subtitle="A sua conta ainda não está associada a nenhum estabelecimento.">
    <div class="auth-alert auth-alert--info">
      <Info :size="16" />
      <span>
        Sessão iniciada como <strong>{{ authStore.accountEmail }}</strong>. O acesso ao TapMenu é autorizado pela equipa
        TapMenu. Se trabalha num estabelecimento, peça ao responsável para o adicionar à equipa com este email.
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
