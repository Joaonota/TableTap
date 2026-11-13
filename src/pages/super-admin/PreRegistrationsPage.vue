<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { establishmentService, type InviteDelivery, type PreRegisterCompanyInput } from '@/services'
import { usePlansStore } from '@/stores/plans'
import { usePlatformStore } from '@/stores/platform'
import { useToastStore } from '@/stores/toast'
import { copyToClipboard } from '@/services/qrCodeService'
import type { EstablishmentInvitation, SubscriptionStatus } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { Plus, Mail, Link2, Edit2, Copy, Search } from 'lucide-vue-next'

/**
 * Pré-registo de empresas clientes: a equipa TapMenu cria a empresa e a
 * subscrição (plano) e convida o responsável, que define a palavra-passe,
 * completa o perfil da empresa e cria os seus estabelecimentos.
 */
const toastStore = useToastStore()
const plansStore = usePlansStore()
const platformStore = usePlatformStore()

const invitations = ref<EstablishmentInvitation[]>([])
const isLoading = ref(true)
const search = ref('')
const statusFilter = ref<'all' | EstablishmentInvitation['status']>('all')

const STATUS_LABEL: Record<EstablishmentInvitation['status'], string> = {
  pending: 'Por convidar',
  invited: 'Convite enviado',
  accepted: 'Acesso ativo'
}
const STATUS_VARIANT = { pending: 'warning', invited: 'primary', accepted: 'success' } as const

const SUB_STATUSES: { value: SubscriptionStatus; label: string }[] = [
  { value: 'trial', label: 'Período de teste' },
  { value: 'active', label: 'Ativa' },
  { value: 'suspended', label: 'Suspensa' }
]

const loadData = async () => {
  isLoading.value = true
  try {
    const [list] = await Promise.all([
      establishmentService.getAll(),
      plansStore.fetchPlans(),
      platformStore.fetchPlatformData()
    ])
    invitations.value = list
  } catch (e) {
    toastStore.error('Erro ao carregar pré-registos', (e as Error).message)
  } finally {
    isLoading.value = false
  }
}
onMounted(loadData)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return invitations.value.filter(i => {
    if (statusFilter.value !== 'all' && i.status !== statusFilter.value) return false
    if (!q) return true
    return [i.commercialName, i.companyName, i.ownerName, i.ownerEmail, i.city].some(v => v?.toLowerCase().includes(q))
  })
})

const replaceRow = (row: EstablishmentInvitation) => {
  const idx = invitations.value.findIndex(i => i.id === row.id)
  if (idx === -1) invitations.value.unshift(row)
  else invitations.value[idx] = row
}

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-PT') : '—')

// ---------------- Pré-registo ----------------
const isCreateOpen = ref(false)
const isSaving = ref(false)
const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = () => ({
  companyName: '',
  commercialName: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  country: 'Moçambique',
  province: '',
  city: '',
  planId: platformStore.config?.defaultPlanId || plansStore.plans.find(p => p.active)?.id || '',
  subscriptionStatus: 'trial' as SubscriptionStatus,
  startDate: today(),
  accountActive: true,
  internalNotes: '',
  customPrice: '',
  sendInvite: true
})
const form = ref(emptyForm())

const activePlans = computed(() => plansStore.plans.filter(p => p.active))

const openCreate = () => {
  form.value = emptyForm()
  isCreateOpen.value = true
}

const handleCreate = async () => {
  const f = form.value
  if (!f.companyName.trim() || !f.ownerName.trim() || !f.ownerEmail.trim() || !f.planId) {
    toastStore.warning('Validação', 'Preencha a empresa, o responsável, o email e o plano.')
    return
  }
  const price = f.customPrice.trim() === '' ? null : Number(f.customPrice)
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    toastStore.warning('Validação', 'Preço ajustado inválido.')
    return
  }
  const input: PreRegisterCompanyInput = {
    companyName: f.companyName.trim(),
    commercialName: f.commercialName.trim() || f.companyName.trim(),
    ownerName: f.ownerName.trim(),
    ownerEmail: f.ownerEmail.trim(),
    ownerPhone: f.ownerPhone.trim(),
    country: f.country.trim(),
    province: f.province.trim(),
    city: f.city.trim(),
    planId: f.planId,
    subscriptionStatus: f.subscriptionStatus,
    accountActive: f.accountActive,
    startDate: f.startDate,
    internalNotes: f.internalNotes.trim(),
    customPrice: price
  }
  isSaving.value = true
  try {
    const created = await establishmentService.preregister(input)
    replaceRow(created)
    isCreateOpen.value = false
    toastStore.success('Empresa pré-registada', created.commercialName)
    if (f.sendInvite) await sendInvite(created, 'email')
  } catch (e) {
    toastStore.error('Não foi possível pré-registar', (e as Error).message)
  } finally {
    isSaving.value = false
  }
}

// ---------------- Convites ----------------
const invitingId = ref<string | null>(null)
const generatedLink = ref<{ email: string; link: string } | null>(null)

const sendInvite = async (inv: EstablishmentInvitation, delivery: InviteDelivery) => {
  invitingId.value = inv.id
  try {
    const result = await establishmentService.invite(inv.id, delivery)
    if (result.delivery === 'link' && result.link) {
      generatedLink.value = { email: result.email, link: result.link }
    } else {
      toastStore.success('Convite enviado', `Email enviado para ${result.email}.`)
    }
    // Atualiza estado/contagem do convite.
    const fresh = (await establishmentService.getAll()).find(i => i.id === inv.id)
    if (fresh) replaceRow(fresh)
  } catch (e) {
    toastStore.error('Não foi possível emitir o convite', (e as Error).message)
  } finally {
    invitingId.value = null
  }
}

const copyLink = async () => {
  if (!generatedLink.value) return
  const ok = await copyToClipboard(generatedLink.value.link)
  if (ok) toastStore.success('Link copiado')
  else toastStore.warning('Copie o link manualmente')
}

// ---------------- Edição de dados internos ----------------
const editing = ref<EstablishmentInvitation | null>(null)
const editForm = ref({ ownerName: '', ownerPhone: '', country: '', province: '', city: '', internalNotes: '' })

const openEdit = (inv: EstablishmentInvitation) => {
  editing.value = inv
  editForm.value = {
    ownerName: inv.ownerName,
    ownerPhone: inv.ownerPhone,
    country: inv.country,
    province: inv.province,
    city: inv.city,
    internalNotes: inv.internalNotes
  }
}

const handleEdit = async () => {
  if (!editing.value) return
  if (!editForm.value.ownerName.trim()) {
    toastStore.warning('Validação', 'Indique o nome do responsável.')
    return
  }
  isSaving.value = true
  try {
    replaceRow(await establishmentService.update(editing.value.id, { ...editForm.value }))
    editing.value = null
    toastStore.success('Dados atualizados')
  } catch (e) {
    toastStore.error('Erro ao guardar', (e as Error).message)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="super-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Pré-registo de Empresas</h1>
        <p class="page-subtitle">Crie a empresa cliente, atribua o plano e envie o convite ao responsável</p>
      </div>
      <AppButton variant="primary" @click="openCreate">
        <template #icon-left><Plus :size="16" /></template>
        Pré-registar Empresa
      </AppButton>
    </div>

    <div class="filters">
      <div class="search-box">
        <Search :size="15" />
        <input v-model="search" type="search" placeholder="Pesquisar por nome, responsável, email ou cidade" />
      </div>
      <select v-model="statusFilter" class="form-select filter-select">
        <option value="all">Todos os estados</option>
        <option value="pending">Por convidar</option>
        <option value="invited">Convite enviado</option>
        <option value="accepted">Acesso ativo</option>
      </select>
    </div>

    <div class="super-card">
      <div class="table-scroll">
        <table class="super-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Responsável</th>
              <th>Localização</th>
              <th>Estado</th>
              <th>Perfil / Estabelecimentos</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="6" class="empty-row">A carregar…</td>
            </tr>
            <tr v-else-if="!filtered.length">
              <td colspan="6" class="empty-row">
                {{ invitations.length ? 'Nenhuma empresa corresponde à pesquisa.' : 'Ainda não há empresas pré-registadas.' }}
              </td>
            </tr>
            <tr v-for="inv in filtered" :key="inv.id">
              <td>
                <strong class="text-strong">{{ inv.commercialName }}</strong>
                <div class="text-xs text-muted">{{ inv.companyName }}</div>
                <span v-if="!inv.accountActive" class="text-xs danger">Conta suspensa</span>
              </td>
              <td>
                <div>{{ inv.ownerName }}</div>
                <div class="text-xs text-muted">{{ inv.ownerEmail }}</div>
                <div v-if="inv.ownerPhone" class="text-xs text-muted">{{ inv.ownerPhone }}</div>
              </td>
              <td>{{ [inv.city, inv.province, inv.country].filter(Boolean).join(', ') || '—' }}</td>
              <td>
                <AppBadge :variant="STATUS_VARIANT[inv.status]">{{ STATUS_LABEL[inv.status] }}</AppBadge>
                <div v-if="inv.invitedAt" class="text-xs text-muted">
                  {{ inv.inviteCount }}× · último {{ formatDate(inv.invitedAt) }}
                </div>
              </td>
              <td>
                <span v-if="inv.onboardingCompletedAt" class="text-xs ok">Perfil concluído {{ formatDate(inv.onboardingCompletedAt) }}</span>
                <span v-else class="text-xs text-muted">Perfil por concluir</span>
                <div class="text-xs text-muted">{{ inv.restaurantCount }} estabelecimento(s)</div>
              </td>
              <td class="text-right">
                <div class="actions-row">
                  <template v-if="inv.status !== 'accepted'">
                    <button
                      class="action-btn"
                      :title="inv.status === 'invited' ? 'Reenviar convite por email' : 'Enviar convite por email'"
                      :disabled="invitingId === inv.id"
                      @click="sendInvite(inv, 'email')"
                    >
                      <Mail :size="14" />
                    </button>
                    <button
                      class="action-btn"
                      title="Gerar link de convite (WhatsApp, SMS…)"
                      :disabled="invitingId === inv.id"
                      @click="sendInvite(inv, 'link')"
                    >
                      <Link2 :size="14" />
                    </button>
                  </template>
                  <button class="action-btn" title="Editar dados internos" @click="openEdit(inv)">
                    <Edit2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pré-registo -->
    <AppModal :is-open="isCreateOpen" title="Pré-registar Empresa" max-width="620px" @close="isCreateOpen = false">
      <form class="modal-form" @submit.prevent="handleCreate">
        <h3 class="form-section">Empresa</h3>
        <div class="form-row">
          <AppInput id="pr-comp" v-model="form.companyName" label="Nome da empresa" placeholder="Ex.: Sabores de Moçambique, Lda" required />
          <AppInput id="pr-commercial" v-model="form.commercialName" label="Nome comercial" placeholder="Igual ao nome da empresa" />
        </div>
        <div class="form-row form-row--3">
          <AppInput id="pr-country" v-model="form.country" label="País" />
          <AppInput id="pr-province" v-model="form.province" label="Província / Estado" />
          <AppInput id="pr-city" v-model="form.city" label="Cidade" />
        </div>

        <h3 class="form-section">Responsável</h3>
        <AppInput id="pr-owner" v-model="form.ownerName" label="Nome" required />
        <div class="form-row">
          <AppInput id="pr-email" v-model="form.ownerEmail" type="email" label="Email (login)" required />
          <AppInput id="pr-phone" v-model="form.ownerPhone" label="Telefone" placeholder="+258 84 000 0000" />
        </div>

        <h3 class="form-section">Plano e conta</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="pr-plan">Plano</label>
            <select id="pr-plan" v-model="form.planId" class="form-select" required>
              <option v-for="p in activePlans" :key="p.id" :value="p.id">
                {{ p.name }} — {{ p.price.toLocaleString('pt-MZ') }} MT
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="pr-status">Estado da subscrição</label>
            <select id="pr-status" v-model="form.subscriptionStatus" class="form-select">
              <option v-for="s in SUB_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <AppInput id="pr-start" v-model="form.startDate" type="date" label="Data de início" />
          <AppInput
            id="pr-price"
            v-model="form.customPrice"
            type="number"
            label="Preço ajustado (MT)"
            placeholder="Usar preço do plano"
            hint="Opcional"
          />
        </div>

        <label class="check-row">
          <input v-model="form.accountActive" type="checkbox" />
          <span>Conta ativa (desmarque para criar a empresa suspensa)</span>
        </label>

        <div class="form-group">
          <label class="form-label" for="pr-notes">Notas internas</label>
          <textarea id="pr-notes" v-model="form.internalNotes" class="form-textarea" rows="2" placeholder="Só visível para a equipa TapMenu" />
        </div>

        <label class="check-row">
          <input v-model="form.sendInvite" type="checkbox" />
          <span>Enviar o convite por email logo após o registo</span>
        </label>

        <div class="modal-actions">
          <AppButton type="button" variant="outline" @click="isCreateOpen = false">Cancelar</AppButton>
          <AppButton type="submit" variant="primary" :loading="isSaving">Pré-registar</AppButton>
        </div>
      </form>
    </AppModal>

    <!-- Link de convite gerado -->
    <AppModal
      :is-open="!!generatedLink"
      title="Link de convite"
      :subtitle="generatedLink ? `Para ${generatedLink.email}` : ''"
      max-width="520px"
      @close="generatedLink = null"
    >
      <div v-if="generatedLink" class="modal-form">
        <p class="text-sm text-muted">
          Envie este link ao responsável (WhatsApp, SMS…). É de uso único: ao abri-lo, define a palavra-passe e acede ao
          TapMenu. Não o partilhe com mais ninguém.
        </p>
        <div class="link-box font-mono">{{ generatedLink.link }}</div>
        <div class="modal-actions">
          <AppButton variant="outline" @click="generatedLink = null">Fechar</AppButton>
          <AppButton variant="primary" @click="copyLink">
            <template #icon-left><Copy :size="16" /></template>
            Copiar link
          </AppButton>
        </div>
      </div>
    </AppModal>

    <!-- Edição -->
    <AppModal :is-open="!!editing" title="Editar dados internos" :subtitle="editing?.commercialName" max-width="520px" @close="editing = null">
      <form class="modal-form" @submit.prevent="handleEdit">
        <AppInput id="ed-owner" v-model="editForm.ownerName" label="Nome do responsável" required />
        <AppInput id="ed-phone" v-model="editForm.ownerPhone" label="Telefone" />
        <div class="form-row form-row--3">
          <AppInput id="ed-country" v-model="editForm.country" label="País" />
          <AppInput id="ed-province" v-model="editForm.province" label="Província / Estado" />
          <AppInput id="ed-city" v-model="editForm.city" label="Cidade" />
        </div>
        <div class="form-group">
          <label class="form-label" for="ed-notes">Notas internas</label>
          <textarea id="ed-notes" v-model="editForm.internalNotes" class="form-textarea" rows="3" />
        </div>
        <p class="text-xs text-muted">O email de login do responsável não pode ser alterado depois do pré-registo.</p>
        <div class="modal-actions">
          <AppButton type="button" variant="outline" @click="editing = null">Cancelar</AppButton>
          <AppButton type="submit" variant="primary" :loading="isSaving">Guardar</AppButton>
        </div>
      </form>
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
  color: #0f172a;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.2rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 220px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #94a3b8;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0.6rem 0;
  font: inherit;
  font-size: 0.875rem;
  color: #0f172a;
  background: transparent;
}

.filter-select {
  width: auto;
  min-width: 180px;
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
  min-width: 820px;
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
  vertical-align: top;
}

.super-table tr:hover {
  background: #f8fafc;
}

.empty-row {
  text-align: center;
  padding: 2rem 1rem !important;
  color: #64748b;
}

.text-strong {
  color: #0f172a;
}

.text-xs {
  font-size: 0.75rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-muted {
  color: #64748b;
}

.ok {
  color: #047857;
  font-weight: 600;
}

.danger {
  color: #dc2626;
  font-weight: 600;
  display: block;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
}

.action-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.action-btn:hover:not(:disabled) {
  background: #e2e8f0;
  color: #0f172a;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-section {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-top: 0.25rem;
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
  color: #111827;
  font: inherit;
  font-size: 0.875rem;
}

.form-textarea {
  resize: vertical;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
}

.link-box {
  padding: 0.75rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.75rem;
  word-break: break-all;
  color: #0f172a;
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

@media (max-width: 640px) {
  .page-title {
    font-size: 1.375rem;
  }

  .form-row,
  .form-row--3 {
    grid-template-columns: 1fr;
  }
}
</style>
