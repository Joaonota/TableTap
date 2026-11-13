<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import { restaurantService, tenantService } from '@/services'
import ImageUploadField from '@/components/ui/ImageUploadField.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import type { PaymentMethod } from '@/types'
import {
  Settings,
  Store,
  Building2,
  DollarSign,
  CheckCircle2,
  ImageIcon
} from 'lucide-vue-next'

const tenantStore = useTenantStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

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
const restLogoUrl = ref('')
const restCoverUrl = ref('')

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
    restLogoUrl.value = r.logoUrl || ''
    restCoverUrl.value = r.coverImage || ''
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
      logoUrl: restLogoUrl.value,
      coverImage: restCoverUrl.value,
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

    // Dados da empresa: só o dono da empresa (o RLS recusa os restantes papéis).
    if (authStore.isCompanyOwner) {
      await tenantService.updateCompany(tenantStore.currentCompany.id, {
        legalName: compLegalName.value,
        taxId: compTaxId.value,
        phone: compPhone.value,
        email: compEmail.value
      })
    }

    await tenantStore.loadContext()
    toastStore.success('Configurações Gravadas', 'As preferências do restaurante e dados legais foram atualizados.')
  } catch (e) {
    toastStore.error('Erro ao guardar configurações', (e as Error).message)
  } finally {
    isSaving.value = false
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

      <!-- Dados da empresa (só o dono) -->
      <div v-if="authStore.isCompanyOwner" class="app-card">
        <div class="card-header">
          <div class="header-icon"><Building2 :size="18" /></div>
          <div>
            <h2 class="card-title">Empresa</h2>
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

      <!-- Imagens (Supabase Storage) -->
      <div v-if="tenantStore.currentRestaurant" class="app-card">
        <div class="card-header">
          <div class="header-icon"><ImageIcon :size="18" /></div>
          <div>
            <h2 class="card-title">Imagens do restaurante</h2>
            <p class="card-desc">Logótipo e capa apresentados no menu digital. Guardadas ao clicar em "Guardar".</p>
          </div>
        </div>
        <div class="images-grid">
          <ImageUploadField
            v-model="restLogoUrl"
            label="Logótipo"
            kind="logo"
            aspect="1 / 1"
            :tenant-id="tenantStore.currentRestaurant.tenantId"
            :restaurant-id="tenantStore.currentRestaurant.id"
          />
          <ImageUploadField
            v-model="restCoverUrl"
            label="Imagem de capa"
            kind="cover"
            aspect="16 / 9"
            :tenant-id="tenantStore.currentRestaurant.tenantId"
            :restaurant-id="tenantStore.currentRestaurant.id"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
}

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

@media (max-width: 560px) {
  .fields-row {
    grid-template-columns: 1fr;
  }

  .danger-body {
    width: 100%;
  }
}
</style>
