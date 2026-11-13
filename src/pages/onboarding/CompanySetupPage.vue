<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { tenantService } from '@/services'
import type { Company } from '@/types'
import AppLogo from '@/components/ui/AppLogo.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import ImageUploadField from '@/components/ui/ImageUploadField.vue'
import { Check, LogOut, Lock } from 'lucide-vue-next'

/**
 * Primeiro acesso do responsável: completa o perfil da empresa
 * pré-registada pela equipa TapMenu. O plano é só de leitura (definido
 * pelo Super Admin). A seguir, cria os estabelecimentos.
 */
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const company = ref<Company | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const errors = ref<Record<string, string>>({})
const form = ref({
  name: '',
  legalName: '',
  taxId: '',
  logoUrl: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  country: 'Moçambique'
})

onMounted(async () => {
  await authStore.init()
  const id = authStore.setupCompanyId
  if (!id) {
    router.replace('/app/dashboard')
    return
  }
  try {
    const c = await tenantService.getCompanyById(id)
    if (!c) throw new Error('Empresa não encontrada.')
    company.value = c
    form.value = {
      name: c.name,
      legalName: c.legalName,
      taxId: c.taxId,
      logoUrl: c.logoUrl ?? '',
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      province: c.province,
      country: c.country || 'Moçambique'
    }
  } catch (e) {
    toastStore.error('Não foi possível carregar a empresa', (e as Error).message)
  } finally {
    isLoading.value = false
  }
})

const validate = () => {
  const e: Record<string, string> = {}
  const f = form.value
  if (!f.name.trim()) e.name = 'Indique o nome comercial.'
  if (!f.legalName.trim()) e.legalName = 'Indique o nome legal da empresa.'
  if (!f.phone.trim()) e.phone = 'Indique um telefone de contacto.'
  if (!f.city.trim()) e.city = 'Indique a cidade.'
  errors.value = e
  return Object.keys(e).length === 0
}

const finish = async () => {
  if (!validate() || !company.value) return
  const f = form.value
  isSaving.value = true
  try {
    await tenantService.updateCompany(company.value.id, {
      name: f.name.trim(),
      legalName: f.legalName.trim(),
      taxId: f.taxId.trim(),
      logoUrl: f.logoUrl,
      phone: f.phone.trim(),
      email: f.email.trim(),
      address: f.address.trim(),
      city: f.city.trim(),
      province: f.province.trim(),
      country: f.country.trim()
    })
    await tenantService.completeOnboarding(company.value.id)
    await authStore.refresh()
    toastStore.success('Perfil da empresa concluído', 'Agora crie o seu primeiro estabelecimento.')
    router.replace('/app/estabelecimentos')
  } catch (e) {
    toastStore.error('Não foi possível guardar', (e as Error).message)
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
  <div class="setup-page">
    <header class="setup-header">
      <AppLogo />
      <button type="button" class="logout-btn" @click="handleLogout">
        <LogOut :size="14" />
        <span>Terminar sessão</span>
      </button>
    </header>

    <main class="setup-card">
      <div class="setup-intro">
        <h1>Bem-vindo ao TapMenu{{ authStore.accountName ? `, ${authStore.accountName.split(' ')[0]}` : '' }}</h1>
        <p>Complete o perfil da sua empresa. A seguir, poderá criar os seus estabelecimentos.</p>
      </div>

      <div v-if="isLoading" class="loading">A carregar…</div>
      <div v-else-if="!company" class="loading">Não foi possível carregar a empresa.</div>

      <form v-else class="setup-form" @submit.prevent="finish">
        <div class="plan-note">
          <Lock :size="14" />
          <span>O plano e o estado da conta são geridos pela equipa TapMenu.</span>
        </div>

        <div class="form-row">
          <AppInput id="c-name" v-model="form.name" label="Nome comercial" :error="errors.name" required />
          <AppInput id="c-legal" v-model="form.legalName" label="Nome legal da empresa" :error="errors.legalName" required />
        </div>
        <AppInput id="c-tax" v-model="form.taxId" label="NUIT" placeholder="Opcional" />
        <ImageUploadField v-model="form.logoUrl" label="Logo da empresa" :tenant-id="company.id" kind="logo" aspect="1 / 1" />
        <div class="form-row">
          <AppInput id="c-phone" v-model="form.phone" label="Telefone" :error="errors.phone" required />
          <AppInput id="c-email" v-model="form.email" type="email" label="Email" />
        </div>
        <AppInput id="c-address" v-model="form.address" label="Endereço da sede" placeholder="Rua, número, bairro" />
        <div class="form-row form-row--3">
          <AppInput id="c-city" v-model="form.city" label="Cidade" :error="errors.city" required />
          <AppInput id="c-province" v-model="form.province" label="Província" />
          <AppInput id="c-country" v-model="form.country" label="País" />
        </div>

        <div class="setup-actions">
          <AppButton type="submit" variant="primary" size="lg" :loading="isSaving">
            <template #icon-left><Check :size="16" /></template>
            Concluir perfil
          </AppButton>
        </div>
      </form>
    </main>
  </div>
</template>

<style scoped>
.setup-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 1.5rem 1rem 3rem;
}

.setup-header {
  max-width: 680px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 0.8125rem;
  cursor: pointer;
}

.logout-btn:hover {
  color: #0f172a;
}

.setup-card {
  max-width: 680px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 2rem;
}

.setup-intro h1 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
}

.setup-intro p {
  margin-top: 0.35rem;
  font-size: 0.875rem;
  color: #64748b;
}

.loading {
  padding: 2rem 0;
  text-align: center;
  color: #64748b;
}

.setup-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
}

.plan-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: #f1f5f9;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #475569;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-row--3 {
  grid-template-columns: 1fr 1fr 1fr;
}

.setup-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .setup-card {
    padding: 1.25rem;
  }

  .form-row,
  .form-row--3 {
    grid-template-columns: 1fr;
  }
}
</style>
