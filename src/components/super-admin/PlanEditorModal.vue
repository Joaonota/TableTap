<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Plan, PlanBillingPeriod, PlanFeature, PlanLimit } from '@/types'
import { FEATURE_CATALOG, LIMIT_CATALOG } from '@/types/plan'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import FeatureSelector from './FeatureSelector.vue'
import LimitEditor from './LimitEditor.vue'
import { Sliders, Zap, CheckCircle2 } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  initialPlan?: Plan | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', planData: Partial<Plan>): void
}>()

const activeTab = ref<'general' | 'features' | 'limits'>('general')

const formId = ref('')
const formName = ref('')
const formSlug = ref('')
const formDescription = ref('')
const formPrice = ref<number>(1990)
const formBillingPeriod = ref<PlanBillingPeriod>('monthly')
const formActive = ref(true)
const formHighlighted = ref(false)
const formDisplayOrder = ref(1)

const formFeatures = ref<PlanFeature[]>([])
const formLimits = ref<PlanLimit[]>([])

const isEditMode = computed(() => !!props.initialPlan?.id)

const resetFormWithDefaults = () => {
  formId.value = ''
  formName.value = ''
  formSlug.value = ''
  formDescription.value = ''
  formPrice.value = 1990
  formBillingPeriod.value = 'monthly'
  formActive.value = true
  formHighlighted.value = false
  formDisplayOrder.value = 1

  formFeatures.value = FEATURE_CATALOG.map(f => ({
    featureKey: f.key,
    enabled: f.key === 'MENU_DIGITAL' || f.key === 'QR_CODE'
  }))

  formLimits.value = LIMIT_CATALOG.map(l => ({
    resourceKey: l.key,
    limit: l.key === 'RESTAURANTS' ? 1 : l.key === 'PRODUCTS' ? 30 : 10
  }))
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    activeTab.value = 'general'
    if (props.initialPlan) {
      formId.value = props.initialPlan.id
      formName.value = props.initialPlan.name
      formSlug.value = props.initialPlan.slug
      formDescription.value = props.initialPlan.description
      formPrice.value = props.initialPlan.price
      formBillingPeriod.value = props.initialPlan.billingPeriod
      formActive.value = props.initialPlan.active
      formHighlighted.value = props.initialPlan.highlighted || false
      formDisplayOrder.value = props.initialPlan.displayOrder || 1

      // Ensure all features are mapped
      const existingFeatures = props.initialPlan.features || []
      formFeatures.value = FEATURE_CATALOG.map(f => {
        const found = existingFeatures.find(ef => ef.featureKey === f.key)
        return { featureKey: f.key, enabled: found ? found.enabled : false }
      })

      // Ensure all limits are mapped
      const existingLimits = props.initialPlan.limits || []
      formLimits.value = LIMIT_CATALOG.map(l => {
        const found = existingLimits.find(el => el.resourceKey === l.key)
        return { resourceKey: l.key, limit: found !== undefined ? found.limit : 10 }
      })
    } else {
      resetFormWithDefaults()
    }
  },
  { immediate: true }
)

const generateSlugFromName = () => {
  if (!isEditMode.value && formName.value) {
    formSlug.value = formName.value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}

const handleSave = () => {
  if (!formName.value.trim()) return

  emit('save', {
    ...(formId.value ? { id: formId.value } : {}),
    name: formName.value.trim(),
    slug: formSlug.value.trim() || 'plano',
    description: formDescription.value.trim(),
    price: Number(formPrice.value) || 0,
    currency: 'MT',
    billingPeriod: formBillingPeriod.value,
    active: formActive.value,
    highlighted: formHighlighted.value,
    displayOrder: Number(formDisplayOrder.value) || 1,
    features: formFeatures.value,
    limits: formLimits.value
  })
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="isEditMode ? `Editar Plano: ${formName}` : 'Criar Novo Plano'"
    :subtitle="'Configure preços em Meticais (MT), funcionalidades e limites do plano SaaS'"
    max-width="780px"
    @close="emit('close')"
  >
    <div class="plan-editor-container">
      <!-- Tabs -->
      <div class="tabs-nav">
        <button
          type="button"
          class="tab-btn"
          :class="{ 'active': activeTab === 'general' }"
          @click="activeTab = 'general'"
        >
          <Sliders :size="16" />
          <span>Informações Gerais</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ 'active': activeTab === 'features' }"
          @click="activeTab = 'features'"
        >
          <Zap :size="16" />
          <span>Funcionalidades ({{ formFeatures.filter(f => f.enabled).length }}/{{ formFeatures.length }})</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ 'active': activeTab === 'limits' }"
          @click="activeTab = 'limits'"
        >
          <CheckCircle2 :size="16" />
          <span>Limites Operacionais</span>
        </button>
      </div>

      <!-- Tab Content: General -->
      <div v-show="activeTab === 'general'" class="tab-pane">
        <div class="form-row-2">
          <AppInput
            id="plan-name"
            v-model="formName"
            label="Nome do Plano"
            placeholder="Ex: Pro, Business, Enterprise"
            required
            @input="generateSlugFromName"
          />

          <AppInput
            id="plan-slug"
            v-model="formSlug"
            label="Slug / Identificador URL"
            placeholder="pro, business, enterprise"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="plan-description">Descrição Comercial</label>
          <textarea
            id="plan-description"
            v-model="formDescription"
            rows="3"
            class="form-textarea"
            placeholder="Breve resumo a apresentar na página de preços e no portal..."
          ></textarea>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Preço Mensal (MT)</label>
            <div class="price-input-wrap">
              <span class="currency-prefix">MT</span>
              <input
                type="number"
                v-model="formPrice"
                min="0"
                step="50"
                class="price-number-input"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Periodicidade</label>
            <select v-model="formBillingPeriod" class="form-select">
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Ordem de Exibição</label>
            <input
              type="number"
              v-model="formDisplayOrder"
              min="1"
              class="form-select"
            />
          </div>
        </div>

        <div class="toggles-box">
          <label class="toggle-row">
            <input type="checkbox" v-model="formActive" />
            <div>
              <strong>Plano Ativo</strong>
              <p>Disponível para novas subscrições e upgrades.</p>
            </div>
          </label>

          <label class="toggle-row">
            <input type="checkbox" v-model="formHighlighted" />
            <div>
              <strong>Destacar Plano ("Mais Popular")</strong>
              <p>Exibe selo comemorativo e realce visual na tabela de preços.</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Tab Content: Features -->
      <div v-show="activeTab === 'features'" class="tab-pane">
        <FeatureSelector v-model="formFeatures" />
      </div>

      <!-- Tab Content: Limits -->
      <div v-show="activeTab === 'limits'" class="tab-pane">
        <LimitEditor v-model="formLimits" />
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer">
        <AppButton variant="outline" @click="emit('close')">
          Cancelar
        </AppButton>
        <AppButton variant="primary" @click="handleSave">
          Guardar Plano
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.plan-editor-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tabs-nav {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  padding-bottom: 0.5rem;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.85rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-muted, #6b7280);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  background: var(--color-background, #f3f4f6);
  color: var(--color-text, #111827);
}

.tab-btn.active {
  background: rgba(13, 122, 95, 0.1);
  color: var(--color-primary, #0d7a5f);
}

.tab-pane {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
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
  color: var(--color-text, #374151);
}

.form-textarea {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, #d1d5db);
  background: #ffffff;
  color: var(--color-text, #111827);
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #0d7a5f);
  box-shadow: 0 0 0 2px rgba(13, 122, 95, 0.15);
}

.form-select {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, #d1d5db);
  background: #ffffff;
  color: var(--color-text, #111827);
  font-size: 0.875rem;
}

.price-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
}

.currency-prefix {
  padding: 0.65rem 0.75rem;
  background: var(--color-background, #f3f4f6);
  color: var(--color-text-muted, #6b7280);
  font-weight: 700;
  font-size: 0.8125rem;
  border-right: 1px solid var(--color-border, #d1d5db);
}

.price-number-input {
  flex: 1;
  border: none;
  padding: 0.65rem 0.75rem;
  font-size: 0.9375rem;
  font-weight: 700;
  outline: none;
  color: var(--color-text, #111827);
}

.toggles-box {
  background: var(--color-background, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
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
  accent-color: var(--color-primary, #0d7a5f);
}

.toggle-row strong {
  font-size: 0.875rem;
  color: var(--color-text, #111827);
}

.toggle-row p {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  margin: 0.15rem 0 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}
</style>

