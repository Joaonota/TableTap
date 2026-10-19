<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { tenantService, restaurantService } from '@/services'
import { useToastStore } from '@/stores/toast'
import type { Company, Restaurant } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import {
  Building2,
  Plus,
  Edit2,
  Power,
  Store,
  ExternalLink
} from 'lucide-vue-next'

const toastStore = useToastStore()
const companies = ref<Company[]>([])
const restaurants = ref<Restaurant[]>([])
const isLoading = ref(true)

const isModalOpen = ref(false)
const formId = ref<string | undefined>(undefined)
const formName = ref('')
const formLegalName = ref('')
const formTaxId = ref('')
const formPhone = ref('')
const formEmail = ref('')

const loadData = async () => {
  isLoading.value = true
  try {
    const [c, r] = await Promise.all([
      tenantService.getAllCompanies(),
      restaurantService.getAllRestaurants()
    ])
    companies.value = c
    restaurants.value = r
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})

const openAddModal = () => {
  formId.value = undefined
  formName.value = ''
  formLegalName.value = ''
  formTaxId.value = ''
  formPhone.value = '+258 84 '
  formEmail.value = ''
  isModalOpen.value = true
}

const openEditModal = (comp: Company) => {
  formId.value = comp.id
  formName.value = comp.name
  formLegalName.value = comp.legalName
  formTaxId.value = comp.taxId
  formPhone.value = comp.phone
  formEmail.value = comp.email
  isModalOpen.value = true
}

const handleSaveCompany = async () => {
  if (!formName.value.trim() || !formTaxId.value.trim()) {
    toastStore.warning('Validação', 'Preencha o nome comercial e o NUIT.')
    return
  }

  try {
    if (formId.value) {
      const updated = await tenantService.updateCompany(formId.value, {
        name: formName.value,
        legalName: formLegalName.value,
        taxId: formTaxId.value,
        phone: formPhone.value,
        email: formEmail.value
      })
      const idx = companies.value.findIndex(c => c.id === formId.value)
      if (idx !== -1) companies.value[idx] = updated
      toastStore.success('Empresa Atualizada')
    } else {
      const created = await tenantService.createCompany({
        name: formName.value,
        legalName: formLegalName.value || formName.value,
        slug: formName.value.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        taxId: formTaxId.value,
        phone: formPhone.value,
        email: formEmail.value,
        planId: 'plan-pro',
        subscriptionId: `sub-${Date.now()}`,
        isActive: true
      })
      companies.value.push(created)
      toastStore.success('Nova Empresa Registada!')
    }
    isModalOpen.value = false
  } catch (e) {
    toastStore.error('Erro ao guardar empresa', (e as Error).message)
  }
}

const toggleCompanyStatus = async (comp: Company) => {
  const newStatus = !comp.isActive
  try {
    const updated = await tenantService.updateCompany(comp.id, { isActive: newStatus })
    const idx = companies.value.findIndex(c => c.id === comp.id)
    if (idx !== -1) companies.value[idx] = updated
    toastStore.info('Estado Alterado', `${comp.name} agora está ${newStatus ? 'Ativa' : 'Suspensa'}`)
  } catch (e) {
    toastStore.error('Erro ao alterar estado', (e as Error).message)
  }
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Empresas Clientes (Tenants)</h1>
        <p class="page-subtitle">Organizações SaaS cadastradas com isolamento lógico de dados</p>
      </div>

      <AppButton variant="primary" @click="openAddModal">
        <template #icon-left>
          <Plus :size="16" />
        </template>
        Registar Empresa
      </AppButton>
    </div>

    <div class="super-card table-card">
      <table class="super-table">
        <thead>
          <tr>
            <th>Nome Comercial & Legal</th>
            <th>NUIT</th>
            <th>Contactos</th>
            <th>Filiais / Restaurantes</th>
            <th>Estado</th>
            <th class="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="comp in companies" :key="comp.id">
            <td>
              <strong class="text-white">{{ comp.name }}</strong>
              <div class="text-xs text-muted">{{ comp.legalName }}</div>
            </td>
            <td>{{ comp.taxId }}</td>
            <td>
              <div>{{ comp.email }}</div>
              <div class="text-xs text-muted">{{ comp.phone }}</div>
            </td>
            <td>
              <span class="badge badge-neutral">
                {{ restaurants.filter(r => r.tenantId === comp.id).length }} unidades
              </span>
            </td>
            <td>
              <AppBadge :variant="comp.isActive ? 'success' : 'danger'">
                {{ comp.isActive ? 'Ativa' : 'Suspensa' }}
              </AppBadge>
            </td>
            <td class="text-right">
              <div class="actions-row">
                <button
                  class="action-btn"
                  :title="comp.isActive ? 'Suspender Empresa' : 'Ativar Empresa'"
                  @click="toggleCompanyStatus(comp)"
                >
                  <Power :size="14" />
                </button>
                <button class="action-btn" title="Editar Dados" @click="openEditModal(comp)">
                  <Edit2 :size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Form -->
    <AppModal
      :is-open="isModalOpen"
      :title="formId ? 'Editar Empresa' : 'Registar Nova Empresa Cliente'"
      maxWidth="500px"
      @close="isModalOpen = false"
    >
      <form class="modal-form" @submit.prevent="handleSaveCompany">
        <AppInput
          v-model="formName"
          label="Nome Comercial da Empresa"
          placeholder="Ex: Sabores de Moçambique Lda"
          required
        />
        <AppInput
          v-model="formLegalName"
          label="Razão Social / Denominação Legal"
          placeholder="Ex: Sabores de Moçambique, Sociedade Unipessoal Lda"
        />
        <AppInput
          v-model="formTaxId"
          label="NUIT (Número de Identificação Tributária)"
          placeholder="Ex: 400192831"
          required
        />
        <div class="form-row">
          <AppInput
            v-model="formEmail"
            label="Email Financeiro"
            type="email"
            required
          />
          <AppInput
            v-model="formPhone"
            label="Telefone Corporativo"
            type="tel"
          />
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="isModalOpen = false">Cancelar</AppButton>
        <AppButton variant="primary" @click="handleSaveCompany">Guardar Empresa</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.super-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
}

.super-card {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.super-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.super-table th {
  padding: 0.875rem 1rem;
  font-size: 0.75rem;
  color: #64748b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: #111827;
}

.super-table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
}

.text-white { color: #ffffff; }

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.text-right {
  text-align: right;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
</style>
