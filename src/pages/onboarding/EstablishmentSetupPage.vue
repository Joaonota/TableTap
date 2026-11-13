<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { restaurantService } from '@/services'
import { homePathFor } from '@/router/homePath'
import { ESTABLISHMENT_CATEGORIES, type OpeningDay, type Restaurant } from '@/types'
import AppLogo from '@/components/ui/AppLogo.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { Store, Clock, Settings2, Check, ArrowLeft, ArrowRight, LogOut } from 'lucide-vue-next'

/**
 * Primeiro acesso do responsável: completa os dados do estabelecimento
 * pré-registado pela equipa TapMenu. Só sai daqui depois de concluir
 * (o router redireciona para esta página enquanto estiver por configurar).
 */
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const LANGUAGES = [
  { label: 'Português', value: 'pt' },
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' }
]
const STEPS = [
  { title: 'Estabelecimento', icon: Store },
  { title: 'Horário', icon: Clock },
  { title: 'Preferências', icon: Settings2 }
]

const restaurant = ref<Restaurant | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const step = ref(0)
const errors = ref<Record<string, string>>({})

const form = ref({
  name: '',
  category: '',
  description: '',
  phone: '',
  email: '',
  street: '',
  city: '',
  province: '',
  country: 'Moçambique',
  schedule: [] as OpeningDay[],
  language: 'pt',
  additionalInfo: '',
  lat: '',
  lng: ''
})

const defaultSchedule = (): OpeningDay[] =>
  DAY_NAMES.map((_, day) => ({ day, open: day !== 0, from: '08:00', to: '22:00' }))

onMounted(async () => {
  await authStore.init()
  const id = authStore.setupRestaurantId
  if (!id) {
    router.replace(homePathFor(authStore))
    return
  }
  try {
    const r = await restaurantService.getRestaurantById(id)
    if (!r) throw new Error('Estabelecimento não encontrado.')
    restaurant.value = r
    form.value = {
      name: r.name,
      category: r.category,
      description: r.description,
      phone: r.phone,
      email: r.email,
      street: r.address?.street ?? '',
      city: r.address?.city ?? '',
      province: r.address?.province ?? '',
      country: r.address?.country || 'Moçambique',
      schedule: r.openingSchedule.length === 7 ? r.openingSchedule.map(d => ({ ...d })) : defaultSchedule(),
      language: r.language || 'pt',
      additionalInfo: r.additionalInfo,
      lat: r.location ? String(r.location.lat) : '',
      lng: r.location ? String(r.location.lng) : ''
    }
  } catch (e) {
    toastStore.error('Não foi possível carregar o estabelecimento', (e as Error).message)
  } finally {
    isLoading.value = false
  }
})

const categoryOptions = computed(() => ESTABLISHMENT_CATEGORIES.map(c => ({ label: c, value: c })))

const validateStep = (): boolean => {
  const e: Record<string, string> = {}
  const f = form.value
  if (step.value === 0) {
    if (!f.name.trim()) e.name = 'Indique o nome comercial.'
    if (!f.category) e.category = 'Selecione a categoria.'
    if (!f.phone.trim()) e.phone = 'Indique um telefone de contacto.'
    if (!f.city.trim()) e.city = 'Indique a cidade.'
  } else if (step.value === 1) {
    if (!f.schedule.some(d => d.open)) e.schedule = 'Indique pelo menos um dia de funcionamento.'
    else if (f.schedule.some(d => d.open && (!d.from || !d.to))) e.schedule = 'Preencha as horas dos dias abertos.'
  } else if (step.value === 2) {
    const hasLat = f.lat.trim() !== ''
    const hasLng = f.lng.trim() !== ''
    if (hasLat !== hasLng) e.location = 'Indique a latitude e a longitude, ou deixe ambas vazias.'
    else if (hasLat) {
      const lat = Number(f.lat)
      const lng = Number(f.lng)
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        e.location = 'Coordenadas inválidas.'
      }
    }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

const next = () => {
  if (validateStep()) step.value++
}
const back = () => {
  errors.value = {}
  step.value--
}

/** Resumo em texto do horário (campo openingHours, usado no menu público). */
const scheduleSummary = (schedule: OpeningDay[]) =>
  schedule
    .filter(d => d.open)
    .map(d => `${DAY_NAMES[d.day].slice(0, 3)} ${d.from}–${d.to}`)
    .join(' · ')

const finish = async () => {
  if (!validateStep() || !restaurant.value) return
  const f = form.value
  isSaving.value = true
  try {
    await restaurantService.updateRestaurant(restaurant.value.id, {
      name: f.name.trim(),
      category: f.category,
      description: f.description.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      address: { street: f.street.trim(), city: f.city.trim(), province: f.province.trim(), country: f.country.trim() },
      openingSchedule: f.schedule,
      openingHours: scheduleSummary(f.schedule),
      language: f.language,
      additionalInfo: f.additionalInfo.trim(),
      location: f.lat.trim() ? { lat: Number(f.lat), lng: Number(f.lng) } : null
    })
    await restaurantService.completeOnboarding(restaurant.value.id)
    await authStore.refresh()
    toastStore.success('Estabelecimento configurado', 'Já pode começar a criar o seu menu.')
    router.replace(homePathFor(authStore))
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
        <p>Complete os dados do seu estabelecimento. Pode alterá-los mais tarde nas Configurações.</p>
      </div>

      <ol class="steps">
        <li
          v-for="(s, i) in STEPS"
          :key="s.title"
          class="step"
          :class="{ 'is-active': i === step, 'is-done': i < step }"
        >
          <span class="step-dot">
            <Check v-if="i < step" :size="14" />
            <component :is="s.icon" v-else :size="14" />
          </span>
          <span class="step-title">{{ s.title }}</span>
        </li>
      </ol>

      <div v-if="isLoading" class="loading">A carregar…</div>
      <div v-else-if="!restaurant" class="loading">Não foi possível carregar o estabelecimento.</div>

      <form v-else class="setup-form" @submit.prevent="step < STEPS.length - 1 ? next() : finish()">
        <!-- Passo 1 -->
        <template v-if="step === 0">
          <AppInput id="s-name" v-model="form.name" label="Nome comercial" :error="errors.name" required />
          <AppSelect
            id="s-category"
            v-model="form.category"
            label="Categoria"
            placeholder="Selecione…"
            :options="categoryOptions"
            :error="errors.category"
            required
          />
          <div class="form-group">
            <label class="form-label" for="s-desc">Descrição curta</label>
            <textarea id="s-desc" v-model="form.description" class="form-textarea" rows="2" placeholder="Opcional — aparece no menu digital" />
          </div>
          <div class="form-row">
            <AppInput id="s-phone" v-model="form.phone" label="Telefone" placeholder="+258 84 000 0000" :error="errors.phone" required />
            <AppInput id="s-email" v-model="form.email" type="email" label="Email público" placeholder="Opcional" />
          </div>
          <AppInput id="s-street" v-model="form.street" label="Morada" placeholder="Rua, número, bairro" />
          <div class="form-row form-row--3">
            <AppInput id="s-city" v-model="form.city" label="Cidade" :error="errors.city" required />
            <AppInput id="s-province" v-model="form.province" label="Província" />
            <AppInput id="s-country" v-model="form.country" label="País" />
          </div>
        </template>

        <!-- Passo 2 -->
        <template v-else-if="step === 1">
          <p class="step-help">Indique os dias e horas de funcionamento.</p>
          <div class="schedule">
            <div v-for="d in form.schedule" :key="d.day" class="schedule-row" :class="{ 'is-closed': !d.open }">
              <label class="schedule-day">
                <input v-model="d.open" type="checkbox" />
                <span>{{ DAY_NAMES[d.day] }}</span>
              </label>
              <template v-if="d.open">
                <input v-model="d.from" type="time" class="time-input" :aria-label="`${DAY_NAMES[d.day]} abre`" />
                <span class="schedule-sep">até</span>
                <input v-model="d.to" type="time" class="time-input" :aria-label="`${DAY_NAMES[d.day]} fecha`" />
              </template>
              <span v-else class="schedule-closed">Fechado</span>
            </div>
          </div>
          <p v-if="errors.schedule" class="field-error">{{ errors.schedule }}</p>
        </template>

        <!-- Passo 3 -->
        <template v-else>
          <AppSelect id="s-lang" v-model="form.language" label="Idioma principal do menu" :options="LANGUAGES" />
          <div class="form-group">
            <label class="form-label" for="s-info">Informação adicional</label>
            <textarea
              id="s-info"
              v-model="form.additionalInfo"
              class="form-textarea"
              rows="3"
              placeholder="Ex.: estacionamento, Wi-Fi, reservas, acessibilidade…"
            />
          </div>
          <div class="form-row">
            <AppInput id="s-lat" v-model="form.lat" label="Latitude" placeholder="-25.9692" hint="Opcional" />
            <AppInput id="s-lng" v-model="form.lng" label="Longitude" placeholder="32.5732" hint="Opcional" />
          </div>
          <p v-if="errors.location" class="field-error">{{ errors.location }}</p>
        </template>

        <div class="setup-actions">
          <AppButton v-if="step > 0" type="button" variant="outline" :disabled="isSaving" @click="back">
            <template #icon-left><ArrowLeft :size="16" /></template>
            Voltar
          </AppButton>
          <span v-else />
          <AppButton v-if="step < STEPS.length - 1" type="submit" variant="primary">
            Continuar
            <template #icon-right><ArrowRight :size="16" /></template>
          </AppButton>
          <AppButton v-else type="submit" variant="primary" :loading="isSaving">
            <template #icon-left><Check :size="16" /></template>
            Concluir configuração
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

.steps {
  list-style: none;
  display: flex;
  gap: 0.5rem;
  margin: 1.75rem 0;
  padding: 0;
}

.step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 3px solid #e2e8f0;
  color: #94a3b8;
  font-size: 0.8125rem;
  font-weight: 600;
}

.step.is-active {
  border-color: var(--primary, #0ea5e9);
  color: #0f172a;
}

.step.is-done {
  border-color: #10b981;
  color: #047857;
}

.step-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  flex-shrink: 0;
}

.step.is-done .step-dot {
  background: #d1fae5;
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

.form-textarea {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font: inherit;
  font-size: 0.875rem;
  resize: vertical;
}

.step-help {
  font-size: 0.875rem;
  color: #64748b;
}

.schedule {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.schedule-row.is-closed {
  background: #f8fafc;
}

.schedule-day {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 110px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
}

.time-input {
  padding: 0.4rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
  font-size: 0.875rem;
}

.schedule-sep,
.schedule-closed {
  font-size: 0.8125rem;
  color: #94a3b8;
}

.field-error {
  font-size: 0.8125rem;
  color: #dc2626;
}

.setup-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
}

@media (max-width: 640px) {
  .setup-card {
    padding: 1.25rem;
  }

  .form-row,
  .form-row--3 {
    grid-template-columns: 1fr;
  }

  .step-title {
    display: none;
  }

  .schedule-row {
    flex-wrap: wrap;
  }
}
</style>
