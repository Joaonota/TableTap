<script setup lang="ts">
import { ref } from 'vue'
import type { Restaurant, Table } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  UtensilsCrossed,
  Users,
  Eye,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  restaurant: Restaurant
  table: Table
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'browse-menu'): void
  (e: 'occupy-table', payload: { customerName: string; partySize?: number; notes?: string }): void
}>()

const activeTab = ref<'choose' | 'form'>('choose')
const customerName = ref('')
const partySize = ref<number>(2)
const notes = ref('')
const nameError = ref('')

const handleConfirmOccupation = () => {
  const trimmed = customerName.value.trim()
  if (!trimmed) {
    nameError.value = 'Por favor, insira o seu nome para iniciar a sessão na mesa.'
    return
  }
  nameError.value = ''
  emit('occupy-table', {
    customerName: trimmed,
    partySize: partySize.value > 0 ? Number(partySize.value) : undefined,
    notes: notes.value.trim() || undefined
  })
}

const handleBrowseOnly = () => {
  emit('browse-menu')
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    :title="`Bem-vindo(a) ao ${restaurant.name}`"
    :subtitle="`Mesa ${table.number} • ${table.area}`"
    max-width="520px"
    :prevent-close="true"
  >
    <div class="welcome-container">
      <!-- Restaurant Header Box -->
      <div class="welcome-hero-card">
        <img :src="restaurant.coverImage" :alt="restaurant.name" class="cover-bg" />
        <div class="cover-overlay"></div>
        <div class="hero-brand">
          <img :src="restaurant.logoUrl" :alt="restaurant.name" class="brand-logo" />
          <div class="brand-text">
            <h3 class="rest-name">{{ restaurant.name }}</h3>
            <div class="table-pill">
              <span class="live-dot"></span>
              <strong>Mesa {{ table.number }}</strong>
              <span class="pill-divider">•</span>
              <span><Users :size="13" class="inline-icon" /> Até {{ table.capacity }} pessoas</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Option 1 vs Option 2 Screen -->
      <div v-if="activeTab === 'choose'" class="options-view">
        <div class="welcome-intro">
          <h4 class="intro-heading">Como deseja começar a sua experiência?</h4>
          <p class="intro-sub">
            Pode consultar todo o menu antes de se sentar, ou iniciar diretamente a sua mesa para efetuar pedidos.
          </p>
        </div>

        <div class="choices-stack">
          <!-- Option 1: Browse Menu -->
          <button type="button" class="choice-card browse-choice" @click="handleBrowseOnly">
            <div class="choice-icon-wrap secondary">
              <Eye :size="24" />
            </div>
            <div class="choice-text">
              <div class="choice-title-row">
                <span class="choice-title">Opção 1: Apenas Ver Menu</span>
                <span class="choice-badge">Consulta livre</span>
              </div>
              <p class="choice-desc">
                Explore categorias, pratos, preços e ingredientes. Pode adicionar itens ao carrinho de teste e ocupar a mesa apenas quando quiser enviar o pedido.
              </p>
            </div>
          </button>

          <!-- Option 2: Occupy Table -->
          <button type="button" class="choice-card occupy-choice" @click="activeTab = 'form'">
            <div class="choice-icon-wrap primary">
              <UtensilsCrossed :size="24" />
            </div>
            <div class="choice-text">
              <div class="choice-title-row">
                <span class="choice-title">Opção 2: Ocupar Mesa e Pedir</span>
                <span class="choice-badge primary">Recomendado</span>
              </div>
              <p class="choice-desc">
                Inicie a sessão com o seu nome. Desbloqueia o envio direto de pedidos para a cozinha, pedidos adicionais durante a refeição e chamada de garçom.
              </p>
            </div>
          </button>
        </div>

        <div class="info-note">
          <Info :size="15" class="info-icon" />
          <span>Não é necessário instalar aplicação nem criar conta.</span>
        </div>
      </div>

      <!-- Occupation Form Screen -->
      <div v-else class="form-view">
        <div class="form-header-row">
          <button type="button" class="back-link" @click="activeTab = 'choose'">
            ← Voltar às opções
          </button>
          <span class="step-indicator">Identificação da Mesa</span>
        </div>

        <div class="occupation-form">
          <div class="form-group">
            <label for="welcomeCustomerName" class="input-label">
              O seu nome <span class="required">*</span>
            </label>
            <input
              id="welcomeCustomerName"
              v-model="customerName"
              type="text"
              placeholder="Ex: Carlos Mateus"
              class="form-text-input"
              :class="{ 'has-error': nameError }"
              autofocus
              @input="nameError = ''"
              @keyup.enter="handleConfirmOccupation"
            />
            <span v-if="nameError" class="field-error-msg">{{ nameError }}</span>
            <span v-else class="field-hint">O seu nome será identificado no balcão e na cozinha.</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="welcomePartySize" class="input-label">Número de Pessoas</label>
              <div class="party-selector">
                <button
                  v-for="n in [1, 2, 3, 4, 6]"
                  :key="n"
                  type="button"
                  class="party-btn"
                  :class="{ 'is-selected': partySize === n }"
                  @click="partySize = n"
                >
                  {{ n }}
                </button>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="welcomeNotes" class="input-label">Observações Iniciais (Opcional)</label>
            <input
              id="welcomeNotes"
              v-model="notes"
              type="text"
              placeholder="Ex: Aniversário, cadeira de bebé, mesa ao sol..."
              class="form-text-input"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="activeTab === 'choose'">
        <AppButton variant="secondary" size="md" @click="handleBrowseOnly">
          <template #icon-left>
            <Eye :size="16" />
          </template>
          Ver Menu Primeiro
        </AppButton>
        <AppButton variant="primary" size="md" @click="activeTab = 'form'">
          <template #icon-left>
            <UtensilsCrossed :size="16" />
          </template>
          Ocupar Mesa Agora
        </AppButton>
      </template>

      <template v-else>
        <AppButton variant="secondary" size="md" @click="activeTab = 'choose'">
          Voltar
        </AppButton>
        <AppButton
          variant="success"
          size="lg"
          :loading="isSubmitting"
          @click="handleConfirmOccupation"
        >
          <template #icon-left>
            <CheckCircle2 :size="18" />
          </template>
          Confirmar & Abrir Menu
        </AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.welcome-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.welcome-hero-card {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  height: 120px;
  background-color: #0f172a;
}

.cover-bg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.45;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.3) 0%, rgba(15, 23, 42, 0.85) 100%);
}

.hero-brand {
  position: absolute;
  inset: 0;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #ffffff;
}

.brand-logo {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  border: 2px solid #ffffff;
  object-fit: cover;
  box-shadow: var(--shadow-md);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.rest-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.01em;
}

.table-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  width: fit-content;
}

.live-dot {
  width: 8px;
  height: 8px;
  background-color: var(--color-success-400);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--color-success-400);
}

.pill-divider {
  opacity: 0.6;
}

.inline-icon {
  display: inline;
  vertical-align: middle;
}

.welcome-intro {
  margin-bottom: 0.75rem;
}

.intro-heading {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.intro-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.choices-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.choice-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border-color);
  background-color: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;
}

.choice-card:hover {
  border-color: var(--color-primary-400);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.occupy-choice {
  border-color: rgba(30, 64, 175, 0.3);
  background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
}

.occupy-choice:hover {
  border-color: var(--color-primary-600);
}

.choice-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.choice-icon-wrap.primary {
  background-color: var(--color-primary-100);
  color: var(--color-primary-800);
}

.choice-icon-wrap.secondary {
  background-color: var(--color-slate-100);
  color: var(--color-slate-700);
}

.choice-text {
  flex: 1;
}

.choice-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.choice-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.choice-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  background-color: var(--color-slate-200);
  color: var(--color-slate-800);
}

.choice-badge.primary {
  background-color: var(--color-primary-600);
  color: #ffffff;
}

.choice-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.info-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  background-color: var(--color-slate-50);
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-color);
}

.info-icon {
  color: var(--color-primary-600);
  flex-shrink: 0;
}

/* Form View */
.form-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    gap: 0.5rem;
  }

.back-link {
  background: none;
  border: none;
  color: var(--color-primary-700);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.back-link:hover {
  text-decoration: underline;
}

.step-indicator {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.occupation-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.input-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.required {
  color: var(--color-danger-500);
}

.form-text-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  outline: none;
  transition: border-color var(--transition-fast);
  min-height: 44px;
}

.form-text-input:focus {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.12);
}

.form-text-input.has-error {
  border-color: var(--color-danger-500);
}

.field-error-msg {
  font-size: 0.75rem;
  color: var(--color-danger-600);
  font-weight: 600;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.party-selector {
  display: flex;
  gap: 0.5rem;
}

.party-btn {
  flex: 1;
  min-height: 44px;
  background-color: #ffffff;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.party-btn:hover {
  border-color: var(--color-primary-400);
}

.party-btn.is-selected {
  background-color: var(--color-primary-700);
  border-color: var(--color-primary-700);
  color: #ffffff;
}
</style>
