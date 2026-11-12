<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { tenantService, restaurantService } from '@/services'
import { usePlatformStore } from '@/stores/platform'
import { usePlansStore } from '@/stores/plans'
import { useToastStore } from '@/stores/toast'
import type { Company, Restaurant, Subscription } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import SubscriptionManagerModal from '@/components/super-admin/SubscriptionManagerModal.vue'
import {
  Building2,
  Plus,
  Edit2,
  Power,
  Store,
  ExternalLink,
  CreditCard
} from 'lucide-vue-next'

const toastStore = useToastStore()
const platformStore = usePlatformStore()
const plansStore = usePlansStore()

const companies = ref<Company[]>([])
const restaurants = ref<Restaurant[]>([])
const isLoading = ref(true)

const isModalOpen = ref(false)
const isSubModalOpen = ref(false)
const selectedSub = ref<Subscription | null>(null)

const formId = ref<string | undefined>(undefined)
const formName = ref('')
const formLegalName = ref('')
const formTaxId = ref('')
const formPhone = ref('')
const formEmail = ref('')
const formPlanId = ref('plan-pro')

const loadData = async () => {
  isLoading.value = true
  try {
    const [c, r] = await Promise.all([
      tenantService.getAllCompanies(),
      restaurantService.getAllRestaurants(),
      platformStore.fetchPlatformData(),
      plansStore.fetchPlans()
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

const getCompanySubscription = (tenantId: string): Subscription | undefined => {
  return platformStore.subscriptions.find(s => s.tenantId === tenantId)
}

const openSubManager = (comp: Company) => {
  const sub = getCompanySubscription(comp.id)
  if (sub) {
    selectedSub.value = sub
    isSubModalOpen.value = true
  } else {
    toastStore.warning('Subscrição', 'Esta empresa ainda não possui subscrição registada.')
  }
}

const handleSaveSubscription = async (updates: Partial<Subscription>, note?: string) => {
  if (!selectedSub.value) return
  await platformStore.updateSubscription(selectedSub.value.id, updates)
  await loadData()
  isSubModalOpen.value = false
}

const openAddModal = () => {
  formId.value = undefined
  formName.value = ''
  formLegalName.value = ''
  formTaxId.value = ''
  formPhone.value = '+258 84 '
  formEmail.value = ''
  formPlanId.value = 'plan-pro'
  isModalOpen.value = true
}

const openEditModal = (comp: Company) => {
  formId.value = comp.id
  formName.value = comp.name
  formLegalName.value = comp.legalName
  formTaxId.value = comp.taxId
  formPhone.value = comp.phone
  formEmail.value = comp.email
  formPlanId.value = comp.planId || 'plan-pro'
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
        email: formEmail.value,
        planId: formPlanId.value
      })
      const idx = companies.value.findIndex(c => c.id === formId.value)
      if (idx !== -1) companies.value[idx] = updated
      toastStore.success('Empresa Atualizada')
    } else {
      const targetPlan = plansStore.plans.find(p => p.id === formPlanId.value) || plansStore.plans[0]
      const created = await tenantService.createCompany({
        name: formName.value,
        legalName: formLegalName.value || formName.value,
        slug: formName.value.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        taxId: formTaxId.value,
        phone: formPhone.value,
        email: formEmail.value,
        planId: targetPlan?.id || 'plan-pro',
        subscriptionId: `sub-${Date.now()}`,
        isActive: true
      })

      // Also create associated initial subscription in platform store
      if (targetPlan) {
        platformStore.subscriptions.push({
          id: `sub-${Date.now()}`,
          tenantId: created.id,
          companyName: created.name,
          planId: targetPlan.id,
          planName: targetPlan.name,
          status: 'trial',
          startDate: new Date().toISOString(),
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          monthlyPrice: targetPlan.price,
          isAutoRenew: false,
          history: [
            {
              id: `subh-${Date.now()}`,
              date: new Date().toISOString(),
              event: 'trial_started',
              toPlanName: targetPlan.name,
              performedBy: 'Super Admin'
            }
          ]
        })
      }

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
        <p class="page-subtitle">Organizações SaaS cadastradas com isolamento lógico de dados, planos e subscrições</p>
      </div>

      <AppButton variant="primary" @click="openAddModal">
        <template #icon-left>
          <Plus :size="16" />
        </template>
        Registar Empresa
      </AppButton>
    </div>

    <div class="super-card table-card">
      <div class="table-scroll">
        <table class="super-table">
        <thead>
          <tr>
            <th>Nome Comercial & Legal</th>
            <th>NUIT</th>
            <th>Plano & Subscrição</th>
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
              <span class="tenant-id font-mono">ID: {{ comp.id }}</span>
            </td>
            <td>{{ comp.taxId }}</td>
            <td>
              <div class="plan-sub-cell">
                <span class="plan-pill">{{ getCompanySubscription(comp.id)?.planName || 'Básico' }}</span>
                <span class="sub-price font-mono">{{ (getCompanySubscription(comp.id)?.monthlyPrice || 1990).toLocaleString('pt-MZ') }} MT</span>
                <button
                  type="button"
                  class="manage-sub-link"
                  @click="openSubManager(comp)"
                >
                  <CreditCard :size="12" />
                  <span>Gerir Subscrição</span>
                </button>
              </div>
            </td>
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
          id="comp-name"
          v-model="formName"
          label="Nome Comercial"
          placeholder="Ex: Cantinho do Mar"
          required
        />
        <AppInput
          id="comp-legal"
          v-model="formLegalName"
          label="Razão Social / Nome Legal"
          placeholder="Ex: Cantinho do Mar Sociedade Unipessoal Lda"
        />
        <AppInput
          id="comp-tax"
          v-model="formTaxId"
          label="NUIT (Número de Identificação Tributária)"
          placeholder="Ex: 400123456"
          required
        />

        <div class="form-group">
          <label class="form-label">Plano Inicial</label>
          <select v-model="formPlanId" class="form-select">
            <option
              v-for="p in plansStore.plans"
              :key="p.id"
              :value="p.id"
            >
              {{ p.name }} — {{ p.price.toLocaleString('pt-MZ') }} MT/mês
            </option>
          </select>
        </div>

        <AppInput
          id="comp-phone"
          v-model="formPhone"
          label="Telefone Comercial"
          placeholder="+258 84 000 0000"
        />
        <AppInput
          id="comp-email"
          v-model="formEmail"
          type="email"
          label="Email de Contacto / Faturação"
          placeholder="admin@empresa.co.mz"
        />

        <div class="modal-actions">
          <AppButton type="button" variant="outline" @click="isModalOpen = false">
            Cancelar
          </AppButton>
          <AppButton type="submit" variant="primary">
            {{ formId ? 'Guardar Alterações' : 'Criar Empresa' }}
          </AppButton>
        </div>
      </form>
    </AppModal>

    <!-- Subscription Manager Modal -->
    <SubscriptionManagerModal
      :is-open="isSubModalOpen"
      :subscription="selectedSub"
      :plans="plansStore.plans"
      @close="isSubModalOpen = false"
      @save="handleSaveSubscription"
    />
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
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.2rem;
}

.super-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.super-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.super-table th {
  background: #f8fafc;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.super-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
}

.super-table tr:hover {
  background: #f8fafc;
}

.tenant-id {
  font-size: 0.6875rem;
  color: #64748b;
  display: block;
}

.plan-sub-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.plan-pill {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: rgba(56, 189, 248, 0.12);
  color: #0369a1;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  width: fit-content;
}

.sub-price {
  font-size: 0.75rem;
  color: #047857;
}

.manage-sub-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6875rem;
  color: #0369a1;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-weight: 600;
  margin-top: 0.15rem;
}

.manage-sub-link:hover {
  text-decoration: underline;
}

.badge-neutral {
  background: #f1f5f9;
  color: #334155;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.action-btn {
  background: #f1f5f9;
  border: none;
  color: #334155;
  padding: 0.4rem;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
}

.form-select {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.text-right {
  text-align: right;
}
</style>

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
  color: #0f172a;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #64748b;
}

.super-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
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
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.super-table td {
  padding: 1rem;
  border-bottom: 1px solid #eef2f6;
  color: #334155;
}

.text-white { color: #0f172a; }

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
}

.action-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
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

.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table-scroll .super-table {
  min-width: 820px;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 1.375rem;
  }

  .page-subtitle {
    font-size: 0.8125rem;
  }

  .super-card {
    padding: 0.75rem;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
