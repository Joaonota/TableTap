<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { restaurantService } from '@/services'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import { usePlanLimit } from '@/composables/usePlanLimit'
import { ESTABLISHMENT_CATEGORIES, type OpeningDay, type Restaurant } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import ImageUploadField from '@/components/ui/ImageUploadField.vue'
import PlanLimitNotice from '@/components/plans/PlanLimitNotice.vue'
import GoogleReviewLinkEditor from '@/components/establishments/GoogleReviewLinkEditor.vue'
import { Plus, Edit2, Power, Store, MapPin, Phone, ArrowRight, Star } from 'lucide-vue-next'

/**
 * Estabelecimentos da empresa. O responsável cria e gere os seus
 * estabelecimentos dentro do limite do plano (RESTAURANTS); o limite é
 * aplicado também na base de dados (trigger enforce_plan_limit).
 */
const router = useRouter()
const tenantStore = useTenantStore()
const toastStore = useToastStore()
const restaurantsLimit = usePlanLimit('RESTAURANTS')

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const company = computed(() => tenantStore.currentCompany)
const establishments = computed(() =>
  tenantStore.allRestaurants.filter(r => r.tenantId === company.value?.id)
)

watch(() => establishments.value.length, () => restaurantsLimit.refresh())

// ---------------- Formulário ----------------
const isModalOpen = ref(false)
const isSaving = ref(false)
const editingId = ref<string | null>(null)
const errors = ref<Record<string, string>>({})

const defaultSchedule = (): OpeningDay[] =>
  DAY_NAMES.map((_, day) => ({ day, open: day !== 0, from: '08:00', to: '22:00' }))

const emptyForm = () => ({
  name: '',
  category: '',
  description: '',
  logoUrl: '',
  phone: company.value?.phone ?? '',
  email: company.value?.email ?? '',
  street: '',
  city: company.value?.city ?? '',
  province: company.value?.province ?? '',
  country: company.value?.country || 'Moçambique',
  schedule: defaultSchedule(),
  isActive: true
})
const form = ref(emptyForm())

const openCreate = () => {
  if (!restaurantsLimit.guard()) return
  editingId.value = null
  errors.value = {}
  form.value = emptyForm()
  isModalOpen.value = true
}

const openEdit = (r: Restaurant) => {
  editingId.value = r.id
  errors.value = {}
  form.value = {
    name: r.name,
    category: r.category,
    description: r.description,
    logoUrl: r.logoUrl,
    phone: r.phone,
    email: r.email,
    street: r.address?.street ?? '',
    city: r.address?.city ?? '',
    province: r.address?.province ?? '',
    country: r.address?.country || 'Moçambique',
    schedule: r.openingSchedule.length === 7 ? r.openingSchedule.map(d => ({ ...d })) : defaultSchedule(),
    isActive: r.isActive
  }
  isModalOpen.value = true
}

const scheduleSummary = (schedule: OpeningDay[]) =>
  schedule
    .filter(d => d.open)
    .map(d => `${DAY_NAMES[d.day].slice(0, 3)} ${d.from}–${d.to}`)
    .join(' · ')

const validate = () => {
  const e: Record<string, string> = {}
  const f = form.value
  if (!f.name.trim()) e.name = 'Indique o nome do estabelecimento.'
  if (!f.city.trim()) e.city = 'Indique a cidade.'
  if (f.schedule.some(d => d.open && (!d.from || !d.to))) e.schedule = 'Preencha as horas dos dias abertos.'
  errors.value = e
  return Object.keys(e).length === 0
}

const handleSave = async () => {
  if (!validate() || !company.value) return
  const f = form.value
  const common = {
    name: f.name.trim(),
    category: f.category,
    description: f.description.trim(),
    logoUrl: f.logoUrl,
    phone: f.phone.trim(),
    email: f.email.trim(),
    address: { street: f.street.trim(), city: f.city.trim(), province: f.province.trim(), country: f.country.trim() },
    openingSchedule: f.schedule,
    openingHours: scheduleSummary(f.schedule),
    isActive: f.isActive
  }
  isSaving.value = true
  try {
    if (editingId.value) {
      await restaurantService.updateRestaurant(editingId.value, common)
      toastStore.success('Estabelecimento atualizado', common.name)
    } else {
      await restaurantService.createRestaurant({
        ...common,
        tenantId: company.value.id,
        slug: '',
        coverImage: '',
        currency: 'MT',
        timezone: 'Africa/Maputo',
        taxRate: 16,
        language: 'pt',
        location: null,
        additionalInfo: '',
        googleReviewUrl: '',
        settings: {
          allowCustomerOrdering: true,
          requireTableForOrder: true,
          serviceFeePercent: 0,
          themeAccentColor: '#0ea5e9',
          enabledPaymentMethods: ['cash']
        }
      })
      toastStore.success('Estabelecimento criado', common.name)
    }
    isModalOpen.value = false
    await tenantStore.loadContext()
  } catch (e) {
    // Inclui a mensagem do limite do plano devolvida pela base de dados.
    toastStore.error('Não foi possível guardar', (e as Error).message)
    restaurantsLimit.refresh()
  } finally {
    isSaving.value = false
  }
}

const toggleActive = async (r: Restaurant) => {
  try {
    await restaurantService.updateRestaurant(r.id, { isActive: !r.isActive })
    await tenantStore.loadContext()
    toastStore.info('Estado alterado', `${r.name} está agora ${r.isActive ? 'inativo' : 'ativo'}.`)
  } catch (e) {
    toastStore.error('Erro ao alterar estado', (e as Error).message)
  }
}

// ---------------- Google (link de avaliação próprio de cada estabelecimento) ----------------
const googleRestaurantId = ref<string | null>(null)
/** Sempre a versão atual do estabelecimento (atualizada após guardar). */
const googleRestaurant = computed(() => establishments.value.find(r => r.id === googleRestaurantId.value) ?? null)
const openGoogle = (r: Restaurant) => {
  googleRestaurantId.value = r.id
}

/** Passa a gerir este estabelecimento (mesas, tags, menu…). */
const manage = (r: Restaurant) => {
  tenantStore.setRestaurant(r.id)
  router.push('/app/mesas')
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Estabelecimentos</h1>
        <p class="page-subtitle">
          {{ company?.name }} · cada estabelecimento tem as suas próprias mesas, tags NFC, menu e equipa
        </p>
      </div>
      <AppButton
        variant="primary"
        :disabled="restaurantsLimit.isReached.value"
        :title="restaurantsLimit.message.value || undefined"
        @click="openCreate"
      >
        <template #icon-left><Plus :size="16" /></template>
        Novo Estabelecimento
      </AppButton>
    </div>

    <PlanLimitNotice :evaluation="restaurantsLimit.evaluation.value" />

    <div v-if="!establishments.length" class="empty-card">
      <Store :size="32" />
      <h2>Ainda não tem estabelecimentos</h2>
      <p>Crie o primeiro estabelecimento para começar a configurar mesas, tags NFC e o menu.</p>
      <AppButton variant="primary" :disabled="restaurantsLimit.isReached.value" @click="openCreate">
        <template #icon-left><Plus :size="16" /></template>
        Criar estabelecimento
      </AppButton>
    </div>

    <div v-else class="grid">
      <article v-for="r in establishments" :key="r.id" class="card" :class="{ 'is-inactive': !r.isActive }">
        <header class="card-head">
          <img v-if="r.logoUrl" :src="r.logoUrl" alt="" class="logo" />
          <span v-else class="logo logo--empty"><Store :size="20" /></span>
          <div class="card-title">
            <strong>{{ r.name }}</strong>
            <span class="muted">{{ r.category || 'Sem categoria' }}</span>
          </div>
          <AppBadge :variant="r.isActive ? 'success' : 'neutral'">{{ r.isActive ? 'Ativo' : 'Inativo' }}</AppBadge>
        </header>
        <p v-if="r.description" class="desc">{{ r.description }}</p>
        <ul class="meta">
          <li><MapPin :size="14" /> {{ [r.address?.street, r.address?.city].filter(Boolean).join(', ') || '—' }}</li>
          <li v-if="r.phone"><Phone :size="14" /> {{ r.phone }}</li>
          <li v-if="r.openingHours" class="muted">{{ r.openingHours }}</li>
          <li class="google-line" :class="r.googleReviewUrl ? 'is-ok' : 'is-missing'">
            <Star :size="14" />
            {{ r.googleReviewUrl ? 'Link do Google configurado' : 'Sem link do Google' }}
          </li>
        </ul>
        <footer class="card-actions">
          <button class="icon-btn" :title="r.isActive ? 'Desativar' : 'Ativar'" @click="toggleActive(r)">
            <Power :size="14" />
          </button>
          <button class="icon-btn" title="Editar" @click="openEdit(r)">
            <Edit2 :size="14" />
          </button>
          <AppButton size="sm" variant="ghost" :title="`Link de avaliação Google de ${r.name}`" @click="openGoogle(r)">
            <template #icon-left><Star :size="14" /></template>
            Google
          </AppButton>
          <AppButton size="sm" variant="outline" @click="manage(r)">
            Gerir
            <template #icon-right><ArrowRight :size="14" /></template>
          </AppButton>
        </footer>
      </article>
    </div>

    <AppModal
      :is-open="isModalOpen"
      :title="editingId ? 'Editar Estabelecimento' : 'Novo Estabelecimento'"
      max-width="640px"
      @close="isModalOpen = false"
    >
      <form class="modal-form" @submit.prevent="handleSave">
        <AppInput id="e-name" v-model="form.name" label="Nome do estabelecimento" placeholder="Ex.: Sabores Maputo" :error="errors.name" required />
        <div class="form-group">
          <label class="form-label" for="e-cat">Categoria</label>
          <select id="e-cat" v-model="form.category" class="form-select">
            <option value="">Selecione…</option>
            <option v-for="c in ESTABLISHMENT_CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="e-desc">Descrição</label>
          <textarea id="e-desc" v-model="form.description" class="form-textarea" rows="2" />
        </div>
        <ImageUploadField
          v-if="company"
          v-model="form.logoUrl"
          label="Logo"
          :tenant-id="company.id"
          :restaurant-id="editingId ?? undefined"
          kind="logo"
          aspect="1 / 1"
        />
        <div class="form-row">
          <AppInput id="e-phone" v-model="form.phone" label="Telefone" />
          <AppInput id="e-email" v-model="form.email" type="email" label="Email" />
        </div>
        <AppInput id="e-street" v-model="form.street" label="Endereço" placeholder="Rua, número, bairro" />
        <div class="form-row form-row--3">
          <AppInput id="e-city" v-model="form.city" label="Cidade" :error="errors.city" required />
          <AppInput id="e-province" v-model="form.province" label="Província" />
          <AppInput id="e-country" v-model="form.country" label="País" />
        </div>

        <div class="form-group">
          <span class="form-label">Horário</span>
          <div class="schedule">
            <div v-for="d in form.schedule" :key="d.day" class="schedule-row">
              <label class="schedule-day">
                <input v-model="d.open" type="checkbox" />
                <span>{{ DAY_NAMES[d.day] }}</span>
              </label>
              <template v-if="d.open">
                <input v-model="d.from" type="time" class="time-input" />
                <span class="muted">até</span>
                <input v-model="d.to" type="time" class="time-input" />
              </template>
              <span v-else class="muted">Fechado</span>
            </div>
          </div>
          <p v-if="errors.schedule" class="field-error">{{ errors.schedule }}</p>
        </div>

        <label class="check-row">
          <input v-model="form.isActive" type="checkbox" />
          <span>Estabelecimento ativo</span>
        </label>
        <p class="muted small">Pagamentos, taxas e o menu digital configuram-se em Configurações, com este estabelecimento selecionado.</p>

        <div class="modal-actions">
          <AppButton type="button" variant="outline" @click="isModalOpen = false">Cancelar</AppButton>
          <AppButton type="submit" variant="primary" :loading="isSaving">
            {{ editingId ? 'Guardar' : 'Criar estabelecimento' }}
          </AppButton>
        </div>
      </form>
    </AppModal>

    <!-- Estabelecimento → Configurações → Google -->
    <AppModal
      :is-open="!!googleRestaurant"
      :title="googleRestaurant ? `Google — ${googleRestaurant.name}` : 'Google'"
      max-width="560px"
      @close="googleRestaurantId = null"
    >
      <GoogleReviewLinkEditor v-if="googleRestaurant" :restaurant="googleRestaurant" />
    </AppModal>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
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
  margin-top: 0.2rem;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  padding: 3rem 1.5rem;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  color: #64748b;
}

.empty-card h2 {
  font-size: 1.125rem;
  color: #0f172a;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.card.is-inactive {
  opacity: 0.7;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.logo--empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #64748b;
}

.card-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.card-title strong {
  color: #0f172a;
}

.desc {
  font-size: 0.875rem;
  color: #475569;
}

.meta {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8125rem;
  color: #334155;
}

.meta li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.meta li.google-line.is-ok {
  color: var(--color-success-700, #047857);
}

.meta li.google-line.is-missing {
  color: var(--color-warning-700, #b45309);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: auto;
}

.card-actions > :last-child {
  margin-left: auto;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #475569;
  cursor: pointer;
}

.icon-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.muted {
  color: #64748b;
  font-size: 0.8125rem;
}

.small {
  font-size: 0.75rem;
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

.form-row--3 {
  grid-template-columns: 1fr 1fr 1fr;
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

.form-select,
.form-textarea {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  font: inherit;
  font-size: 0.875rem;
}

.schedule {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.schedule-day {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.time-input {
  padding: 0.3rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
  font-size: 0.8125rem;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.field-error {
  font-size: 0.8125rem;
  color: #dc2626;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 1.375rem;
  }

  .form-row,
  .form-row--3 {
    grid-template-columns: 1fr;
  }

  .schedule-row {
    flex-wrap: wrap;
  }
}
</style>
