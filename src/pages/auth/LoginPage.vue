<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import type { User } from '@/types'
import { UtensilsCrossed, ShieldCheck, UserCheck, KeyRound, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const email = ref('')
const password = ref('demo1234')
const selectedUserId = ref('user-admin-1')
const isLoading = ref(false)
const isForgotModalOpen = ref(false)
const forgotEmail = ref('')

onMounted(async () => {
  if (authStore.availableDemoUsers.length === 0) {
    await authStore.init()
  }
  const defaultUser = authStore.availableDemoUsers.find(u => u.id === selectedUserId.value)
  if (defaultUser) {
    email.value = defaultUser.email
  }
})

const handleSelectDemoUser = (user: User) => {
  selectedUserId.value = user.id
  email.value = user.email
  password.value = 'demo1234'
}

const handleLogin = async () => {
  isLoading.value = true
  try {
    await authStore.switchUser(selectedUserId.value)
    await tenantStore.loadContext()
    toastStore.success('Sessão Iniciada com Sucesso', `Bem-vindo, ${authStore.currentUser?.name}!`)

    if (authStore.isSuperAdmin) {
      router.push('/super-admin/dashboard')
    } else if (authStore.isKitchenStaff) {
      router.push('/app/cozinha')
    } else {
      router.push('/app/dashboard')
    }
  } catch (e) {
    toastStore.error('Erro ao iniciar sessão', (e as Error).message)
  } finally {
    isLoading.value = false
  }
}

const handleForgotPassword = () => {
  if (!forgotEmail.value) {
    toastStore.warning('Insira o email para recuperação')
    return
  }
  isForgotModalOpen.value = false
  toastStore.info(
    'Simulação de Recuperação',
    `Em ambiente de produção, um link de reposição de senha foi enviado para ${forgotEmail.value}. Nesta demonstração utilize a senha demo1234.`
  )
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <router-link to="/" class="login-brand">
          <div class="brand-badge">
            <UtensilsCrossed :size="20" />
          </div>
          <span>TapMenu</span>
        </router-link>
        <h1 class="login-title">Aceder à Plataforma</h1>
        <p class="login-subtitle">Selecione uma conta demonstrativa para simular permissões.</p>
      </div>

      <!-- Quick Profile Selector -->
      <div class="demo-profiles-box">
        <div class="profiles-label">CONTAS DE DEMONSTRAÇÃO PRÉ-CONFIGURADAS:</div>
        <div class="profiles-grid">
          <button
            v-for="u in authStore.availableDemoUsers"
            :key="u.id"
            type="button"
            class="profile-chip"
            :class="{ 'is-selected': selectedUserId === u.id }"
            @click="handleSelectDemoUser(u)"
          >
            <div class="chip-avatar">
              <img :src="u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'" alt="Avatar" />
            </div>
            <div class="chip-info">
              <span class="chip-name">{{ u.name.split(' ')[0] }}</span>
              <span class="chip-role">{{ u.role }}</span>
            </div>
          </button>
        </div>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <AppInput
          v-model="email"
          label="Email Profissional"
          type="email"
          required
        />

        <div class="password-wrap">
          <AppInput
            v-model="password"
            label="Palavra-passe (Demonstrativa)"
            type="password"
            required
          />
          <button
            type="button"
            class="forgot-link"
            @click="isForgotModalOpen = true; forgotEmail = email;"
          >
            Esqueceu-se da palavra-passe?
          </button>
        </div>

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          class="submit-btn"
          :loading="isLoading"
        >
          <template #icon-right>
            <ArrowRight :size="18" />
          </template>
          Entrar no Sistema
        </AppButton>
      </form>

      <div class="login-footer">
        <span class="text-xs text-muted">
          Ambiente 100% frontend. Nenhuma credencial pessoal ou sensível é enviada ou guardada na internet.
        </span>
      </div>
    </div>

    <!-- Forgot Password Modal -->
    <AppModal
      :is-open="isForgotModalOpen"
      title="Recuperação de Palavra-passe"
      subtitle="Simulação do fluxo de envio de email"
      @close="isForgotModalOpen = false"
    >
      <div class="forgot-modal-content">
        <p class="text-sm text-muted">
          Insira o email associado à sua conta de demonstração. Iremos simular o envio das instruções de redefinição.
        </p>
        <AppInput
          v-model="forgotEmail"
          label="Email de Registo"
          type="email"
          placeholder="exemplo@tapmenu.co.mz"
        />
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isForgotModalOpen = false">Cancelar</AppButton>
        <AppButton variant="primary" @click="handleForgotPassword">Simular Envio</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  background-color: var(--color-neutral-50);
}

.login-card {
  width: 100%;
  max-width: 520px;
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 2.5rem 2.25rem;
  box-shadow: var(--shadow-lg);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  margin-bottom: 1rem;
}

.brand-badge {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  background: var(--color-primary-800);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-title {
  font-size: 1.625rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  margin-bottom: 0.25rem;
}

.login-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.demo-profiles-box {
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1rem;
  margin-bottom: 1.75rem;
}

.profiles-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-neutral-500);
  letter-spacing: 0.04em;
  margin-bottom: 0.75rem;
}

.profiles-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.profile-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.625rem;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.profile-chip:hover {
  border-color: var(--color-primary-300);
  background: var(--color-primary-50);
}

.profile-chip.is-selected {
  border-color: var(--color-primary-800);
  background: var(--color-primary-50);
  box-shadow: 0 0 0 1px var(--color-primary-800);
}

.chip-avatar img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
}

.chip-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chip-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-role {
  font-size: 0.625rem;
  color: var(--text-muted);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.password-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.forgot-link {
  align-self: flex-end;
  background: transparent;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-700);
  cursor: pointer;
}

.forgot-link:hover {
  text-decoration: underline;
}

.submit-btn {
  width: 100%;
  margin-top: 0.5rem;
}

.login-footer {
  margin-top: 2rem;
  text-align: center;
  border-top: 1px solid var(--border-subtle);
  padding-top: 1rem;
}

.forgot-modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
