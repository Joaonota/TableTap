<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePlatformStore } from '@/stores/platform'
import { usePlansStore } from '@/stores/plans'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { Settings, ShieldAlert, Save, RefreshCw } from 'lucide-vue-next'

const platformStore = usePlatformStore()
const plansStore = usePlansStore()

const platformName = ref('TapMenu Moçambique')
const supportEmail = ref('suporte@tapmenu.co.mz')
const supportPhone = ref('+258 84 300 4000')
const defaultPlanId = ref('plan-pro')
const trialDays = ref(14)
const allowSelfSignup = ref(true)
const maintenanceMode = ref(false)

onMounted(async () => {
  await Promise.all([
    platformStore.fetchPlatformData(),
    plansStore.fetchPlans()
  ])

  if (platformStore.config) {
    platformName.value = platformStore.config.platformName
    supportEmail.value = platformStore.config.supportEmail
    supportPhone.value = platformStore.config.supportPhone
    defaultPlanId.value = platformStore.config.defaultPlanId
    trialDays.value = platformStore.config.trialDays
    allowSelfSignup.value = platformStore.config.allowSelfSignup
    maintenanceMode.value = platformStore.config.maintenanceMode
  }
})

const handleSaveConfig = async () => {
  await platformStore.updateConfig({
    platformName: platformName.value,
    supportEmail: supportEmail.value,
    supportPhone: supportPhone.value,
    defaultPlanId: defaultPlanId.value,
    trialDays: Number(trialDays.value) || 14,
    allowSelfSignup: allowSelfSignup.value,
    maintenanceMode: maintenanceMode.value
  })
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Configurações Gerais da Plataforma</h1>
        <p class="page-subtitle">Parâmetros globais, políticas de adesão, contactos de suporte e modo de manutenção</p>
      </div>

      <AppButton variant="primary" @click="handleSaveConfig">
        <Save :size="16" />
        <span>Guardar Configurações</span>
      </AppButton>
    </div>

    <div class="settings-grid">
      <!-- Identity & Support -->
      <div class="super-card">
        <h2 class="card-title">Identidade & Contactos Globais</h2>
        <p class="card-subtitle">Exibidos nos emails automáticos, rodapés e suporte técnico</p>

        <div class="form-body">
          <AppInput
            id="cfg-name"
            v-model="platformName"
            label="Nome da Instância SaaS"
            placeholder="TapMenu Moçambique"
          />

          <AppInput
            id="cfg-email"
            v-model="supportEmail"
            type="email"
            label="Email de Suporte & Faturação"
            placeholder="suporte@tapmenu.co.mz"
          />

          <AppInput
            id="cfg-phone"
            v-model="supportPhone"
            label="Linha Telefónica de Apoio ao Cliente"
            placeholder="+258 84 000 0000"
          />
        </div>
      </div>

      <!-- Registration & Trial Policies -->
      <div class="super-card">
        <h2 class="card-title">Políticas de Adesão & Demonstração</h2>
        <p class="card-subtitle">Regras aplicadas a novos restaurantes no auto-registo</p>

        <div class="form-body">
          <div class="form-group">
            <label class="form-label">Plano Padrão de Boas-Vindas</label>
            <select v-model="defaultPlanId" class="form-select">
              <option
                v-for="p in plansStore.plans"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }} ({{ p.price.toLocaleString('pt-MZ') }} MT/mês)
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Duração do Período de Teste Gratuito (Dias)</label>
            <input
              type="number"
              v-model="trialDays"
              min="0"
              max="90"
              class="form-select"
            />
          </div>

          <div class="toggles-list">
            <label class="toggle-row">
              <input type="checkbox" v-model="allowSelfSignup" />
              <div>
                <strong>Permitir Auto-Registo de Restaurantes</strong>
                <p>Permite que novos estabelecimentos criem conta na página pública.</p>
              </div>
            </label>

            <label class="toggle-row alert-toggle">
              <input type="checkbox" v-model="maintenanceMode" />
              <div>
                <strong class="text-warning">Ativar Modo Manutenção</strong>
                <p>Apenas super administradores poderão aceder à plataforma.</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
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

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.super-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.card-subtitle {
  font-size: 0.7813rem;
  color: #64748b;
  margin: 0.25rem 0 1.25rem;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
}

.form-select {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  font-size: 0.875rem;
  outline: none;
}

.form-select:focus {
  border-color: #38bdf8;
}

.toggles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.5rem;
}

.toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
}

.toggle-row input {
  margin-top: 0.2rem;
  width: 18px;
  height: 18px;
  accent-color: #0d7a5f;
}

.toggle-row strong {
  display: block;
  font-size: 0.875rem;
  color: #0f172a;
}

.toggle-row p {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0.15rem 0 0;
}

.alert-toggle {
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  padding: 0.75rem;
}

.text-warning {
  color: #b45309;
}
</style>

