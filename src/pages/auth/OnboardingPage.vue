<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { errorMessage } from '@/domain/errors'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { AlertCircle, Info, Store } from 'lucide-vue-next'

/**
 * Passo 2 do registo: a conta autenticada cria a sua empresa e o primeiro
 * restaurante (fica como dono, com o plano por omissão em período de teste).
 */
const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const companyName = ref('')
const legalName = ref('')
const taxId = ref('')
const phone = ref('')
const restaurantName = ref('')
const city = ref('')
const errors = ref<Record<string, string>>({})
const error = ref('')
const isLoading = ref(false)

onMounted(async () => {
  await authStore.init()
  if (!authStore.hasSession) router.replace('/login')
  else if (!authStore.needsOnboarding) router.replace('/app/dashboard')
})

const handleSubmit = async () => {
  error.value = ''
  const e: Record<string, string> = {}
  if (!companyName.value.trim()) e.companyName = 'Indique o nome da empresa.'
  if (!restaurantName.value.trim()) e.restaurantName = 'Indique o nome do restaurante.'
  errors.value = e
  if (Object.keys(e).length) return

  isLoading.value = true
  try {
    await authStore.registerCompany({
      companyName: companyName.value,
      legalName: legalName.value,
      taxId: taxId.value,
      phone: phone.value,
      restaurantName: restaurantName.value,
      city: city.value
    })
    await tenantStore.loadContext()
    toastStore.success('Restaurante registado', 'Configure agora o menu, as mesas e a equipa.')
    router.replace('/app/dashboard')
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    isLoading.value = false
  }
}

const handleLogout = async () => {
  await authStore.logout()
  router.replace('/login')
}
</script>

<template>
  <AuthCard title="Registar o seu restaurante" subtitle="Passo 2 de 2 — dados da empresa e do primeiro restaurante.">
    <div class="auth-alert auth-alert--info">
      <Info :size="16" />
      <span>
        Sessão iniciada como <strong>{{ authStore.accountEmail }}</strong>. Se foi convidado por uma empresa,
        peça ao responsável para confirmar o seu email na equipa — não precisa de registar uma empresa nova.
      </span>
    </div>
    <div v-if="error" class="auth-alert auth-alert--error" role="alert">
      <AlertCircle :size="16" />
      <span>{{ error }}</span>
    </div>

    <form class="auth-form" novalidate @submit.prevent="handleSubmit">
      <AppInput id="ob-company" v-model="companyName" label="Nome comercial da empresa" :error="errors.companyName" required />
      <AppInput id="ob-legal" v-model="legalName" label="Denominação legal" placeholder="Opcional" />
      <div class="auth-row">
        <AppInput id="ob-tax" v-model="taxId" label="NUIT" placeholder="Opcional" />
        <AppInput id="ob-phone" v-model="phone" label="Telefone" placeholder="Opcional" />
      </div>
      <div class="auth-row">
        <AppInput id="ob-rest" v-model="restaurantName" label="Nome do restaurante" :error="errors.restaurantName" required />
        <AppInput id="ob-city" v-model="city" label="Cidade" placeholder="Opcional" />
      </div>
      <AppButton type="submit" variant="primary" size="lg" class="auth-submit" :loading="isLoading">
        <template #icon-left>
          <Store :size="18" />
        </template>
        Registar restaurante
      </AppButton>
    </form>

    <template #footer>
      <button type="button" class="auth-link-btn" @click="handleLogout">Terminar sessão</button>
    </template>
  </AuthCard>
</template>
