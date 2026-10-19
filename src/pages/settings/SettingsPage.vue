<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { restaurantService, tenantService, resetDatabase } from '@/services'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import type { PaymentMethod } from '@/types'
import {
  Settings,
  Store,
  Building2,
  DollarSign,
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-vue-next'

const tenantStore = useTenantStore()
const toastStore = useToastStore()

// Restaurant form
const restName = ref('')
const restDescription = ref('')
const restPhone = ref('')
const restEmail = ref('')
const restStreet = ref('')
const restCity = ref('')
const restTaxRate = ref(16)
const restServiceFee = ref(10)
const restOpeningHours = ref('')
const isOrderingEnabled = ref(true)

// Company form
const compLegalName = ref('')
const compTaxId = ref('')
const compPhone = ref('')
const compEmail = ref('')

const isSaving = ref(false)

const populateForms = () => {
  const r = tenantStore.currentRestaurant
  if (r) {
    restName.value = r.name
    restDescription.value = r.description
    restPhone.value = r.phone
    restEmail.value = r.email
    restStreet.value = r.address.street
    restCity.value = r.address.city
    restTaxRate.value = r.taxRate
    restServiceFee.value = r.settings.serviceFeePercent
    restOpeningHours.value = r.openingHours
    isOrderingEnabled.value = r.settings.allowCustomerOrdering
  }

  const c = tenantStore.currentCompany
  if (c) {
    compLegalName.value = c.legalName
    compTaxId.value = c.taxId
    compPhone.value = c.phone
    compEmail.value = c.email
  }
}

onMounted(() => {
  populateForms()
})

watch(() => tenantStore.currentRestaurant?.id, () => {
  populateForms()
})

const handleSaveSettings = async () => {
  if (!tenantStore.currentRestaurant || !tenantStore.currentCompany) return
  isSaving.value = true
  try {
    // Update Restaurant
    await restaurantService.updateRestaurant(tenantStore.currentRestaurant.id, {
      name: restName.value,
      description: restDescription.value,
      phone: restPhone.value,
      email: restEmail.value,
      taxRate: Number(restTaxRate.value),
      openingHours: restOpeningHours.value,
      address: {
        ...tenantStore.currentRestaurant.address,
        street: restStreet.value,
        city: restCity.value
      },
      settings: {
        ...tenantStore.currentRestaurant.settings,
        serviceFeePercent: Number(restServiceFee.value),
        allowCustomerOrdering: isOrderingEnabled.value
      }
    })

    // Update Company
    await tenantService.updateCompany(tenantStore.currentCompany.id, {
      legalName: compLegalName.value,
      taxId: compTaxId.value,
      phone: compPhone.value,
      email: compEmail.value
    })

    await tenantStore.loadContext()
    toastStore.success('Configurações Gravadas', 'As preferências do restaurante e dados legais foram atualizados.')
  } catch (e) {
    toastStore.error('Erro ao guardar configurações', (e as Error).message)
  } finally {
    isSaving.value = false
  }
}

const handleReset = () => {
  if (confirm('Deseja realmente repor todos os dados para o padrão original de demonstração?')) {
    resetDatabase()
    window.location.reload()
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Configurações Gerais</h1>
        <p class="page-subtitle">Personalize a identidade do restaurante, horários, impostos e moeda</p>
      </div>

      <AppButton variant="primary" :loading="isSaving" @click="handleSaveSettings">
        <template #icon-left>
          <CheckCircle2 :size="16" />
        </template>
        Guardar Alterações
      </AppButton>
    </div>

    <div class="settings-grid">
      <!-- Restaurant Settings Card -->
      <div class="app-card">
        <div class="card-header">
          <div class="header-icon"><Store :size="18" /></div>
          <div>
            <h2 class="card-title">Dados do Restaurante</h2>
            <p class="card-desc">Informações apresentadas no cabeçalho do menu público</p>
          </div>
        </div>

        <div class="form-fields">
          <AppInput
            v-model="restName"
            label="Nome Comercial do Restaurante"
            required
          />

          <AppInput
            v-model="restOpeningHours"
            label="Horário de Atendimento"
            placeholder="Ex: Terça a Domingo: 11:30 - 23:00"
          />

          <div class="fields-row">
            <AppInput
              v-model="restPhone"
              label="Telefone Principal"
            />
            <AppInput
              v-model="restEmail"
              label="Email de Contacto"
              type="email"
            />
          </div>

          <div class="fields-row">
            <AppInput
              v-model="restStreet"
              label="Endereço / Rua"
            />
            <AppInput
              v-model="restCity"
              label="Cidade / Província"
            />
          </div>

          <div class="form-group">
            <label class="input-label">Descrição Institucional</label>
            <textarea
              v-model="restDescription"
              rows="2"
              class="custom-textarea"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Financial & Ordering Rules -->
      <div class="app-card">
        <div class="card-header">
          <div class="header-icon"><DollarSign :size="18" /></div>
          <div>
            <h2 class="card-title">Taxas & Moeda Nacional</h2>
            <p class="card-desc">Cálculos tributários automáticos nos pedidos</p>
          </div>
        </div>

        <div class="form-fields">
          <div class="fields-row">
            <AppInput
              model-value="MT (Meticais)"
              label="Moeda Padrão"
              disabled
              hint="Moeda oficial de Moçambique"
            />

            <AppInput
              model-value="Africa/Maputo (UTC+2)"
              label="Fuso Horário"
              disabled
            />
          </div>

          <div class="fields-row">
            <AppInput
              v-model="restTaxRate"
              label="Taxa de IVA (%)"
              type="number"
              hint="Padrão legal: 16% IVA"
            />

            <AppInput
              v-model="restServiceFee"
              label="Taxa de Serviço / Gorjeta (%)"
              type="number"
              hint="Aplicada automaticamente no resumo do carrinho"
            />
          </div>

          <div class="checkbox-option-box">
            <label class="checkbox-label">
              <input v-model="isOrderingEnabled" type="checkbox" />
              <div>
                <strong>Permitir Pedidos pelo Menu Digital</strong>
                <p class="text-xs text-muted">Se desativado, o menu funciona em modo consulta apenas.</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Company Legal Entity -->
      <div class="app-card">
        <div class="card-header">
          <div class="header-icon"><Building2 :size="18" /></div>
          <div>
            <h2 class="card-title">Empresa / Tenant SaaS</h2>
            <p class="card-desc">Dados fiscais da entidade jurídica registada</p>
          </div>
        </div>

        <div class="form-fields">
          <AppInput
            v-model="compLegalName"
            label="Denominação Social (Legal)"
          />

          <div class="fields-row">
            <AppInput
              v-model="compTaxId"
              label="NUIT (Número de Identificação Tributária)"
            />
            <AppInput
              v-model="compPhone"
              label="Telefone Corporativo"
            />
          </div>

          <AppInput
            v-model="compEmail"
            label="Email Financeiro"
            type="email"
          />
        </div>
      </div>

      <!-- Danger Zone / Reset Database -->
      <div class="app-card danger-card">
        <div class="card-header">
          <div class="header-icon danger"><AlertTriangle :size="18" /></div>
          <div>
            <h2 class="card-title text-danger">Repor Dados de Demonstração</h2>
            <p class="card-desc">Restaure o estado original de fábrica com 3 empresas e catálogo completo</p>
          </div>
        </div>

        <div class="danger-body">
          <p class="text-sm text-muted">
            Esta operação apaga quaisquer novos pedidos, produtos criados ou alterações feitas no localStorage do seu navegador e repõe a base de demonstração original de Moçambique.
          </p>

          <AppButton variant="danger" @click="handleReset">
            <template #icon-left>
              <RotateCcw :size="16" />
            </template>
            Reiniciar Toda a Base Mockada
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
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
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--border-subtle);
}

.header-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-icon.danger {
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}

.card-title {
  font-size: 1.0625rem;
  font-weight: 700;
}

.card-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.input-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.custom-textarea {
  width: 100%;
  padding: 0.65rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.checkbox-option-box {
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.85rem;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
}

.danger-card {
  border-color: var(--color-danger-200);
}

.danger-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  align-items: flex-start;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
