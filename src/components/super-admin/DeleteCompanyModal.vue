<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { tenantService } from '@/services'
import type { Company, CompanyDeletionPreview, CompanyDeletionResult } from '@/types'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { AlertTriangle, Loader2 } from 'lucide-vue-next'

/**
 * Eliminação permanente de uma empresa (Super Admin do Sistema).
 *
 * Confirmação forte em dois passos: resumo dos dados que serão perdidos,
 * aceitação explícita e o nome da empresa escrito à mão. A base de dados
 * volta a validar a permissão e o nome — esta janela só evita acidentes.
 */
const props = defineProps<{
  isOpen: boolean
  company: Company | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'deleted', result: CompanyDeletionResult): void
}>()

const preview = ref<CompanyDeletionPreview | null>(null)
const loadError = ref('')
const deleteError = ref('')
const isLoadingPreview = ref(false)
const isDeleting = ref(false)
const acknowledged = ref(false)
const typedName = ref('')

watch(
  () => [props.isOpen, props.company?.id] as const,
  async ([open]) => {
    if (!open || !props.company) return
    preview.value = null
    loadError.value = ''
    deleteError.value = ''
    acknowledged.value = false
    typedName.value = ''
    isLoadingPreview.value = true
    try {
      preview.value = await tenantService.getCompanyDeletionPreview(props.company.id)
    } catch (e) {
      loadError.value = (e as Error).message
    } finally {
      isLoadingPreview.value = false
    }
  },
  { immediate: true }
)

const normalize = (value: string) => value.trim().toLocaleLowerCase('pt')
const nameMatches = computed(() => !!preview.value && normalize(typedName.value) === normalize(preview.value.name))
const canDelete = computed(() => acknowledged.value && nameMatches.value && !isDeleting.value)

const summaryRows = computed(() => {
  const c = preview.value?.counts
  if (!c) return []
  return [
    { label: 'Estabelecimentos', value: c.restaurants },
    { label: 'Mesas', value: c.tables },
    { label: 'Tags NFC', value: c.nfcTags },
    { label: 'Categorias', value: c.categories },
    { label: 'Produtos', value: c.products },
    { label: 'Pedidos', value: c.orders },
    { label: 'Pagamentos', value: c.payments },
    { label: 'Sessões de mesa', value: c.tableSessions },
    { label: 'Pedidos de atendimento', value: c.serviceRequests },
    { label: 'Funcionários', value: c.staff },
    { label: 'Utilizadores com conta', value: preview.value?.authAccounts ?? c.users }
  ]
})

const close = () => {
  if (!isDeleting.value) emit('close')
}

const confirmDelete = async () => {
  if (!props.company || !canDelete.value) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    const result = await tenantService.deleteCompanyPermanently(props.company.id, typedName.value.trim())
    emit('deleted', result)
  } catch (e) {
    deleteError.value = (e as Error).message
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    title="Eliminar empresa"
    max-width="560px"
    :prevent-close="isDeleting"
    @close="close"
  >
    <div class="delete-body">
      <div class="danger-banner">
        <AlertTriangle :size="20" />
        <p>
          Está prestes a eliminar esta empresa e todos os dados associados. Esta operação é permanente e não poderá
          ser desfeita.
        </p>
      </div>

      <div v-if="isLoadingPreview" class="state-row">
        <Loader2 :size="16" class="spin" />
        A carregar o resumo da empresa…
      </div>
      <p v-else-if="loadError" class="error-text">{{ loadError }}</p>

      <template v-else-if="preview">
        <div class="company-summary">
          <strong>{{ preview.name }}</strong>
          <span v-if="preview.legalName && preview.legalName !== preview.name" class="muted">{{ preview.legalName }}</span>
          <span class="muted">
            Plano {{ preview.planName ?? '—' }} · Subscrição {{ preview.subscriptionStatus ?? '—' }} ·
            {{ preview.isActive ? 'Ativa' : 'Suspensa' }}
          </span>
        </div>

        <div>
          <p class="section-label">Serão eliminados permanentemente</p>
          <dl class="counts-grid">
            <div v-for="row in summaryRows" :key="row.label" class="count-item">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
          <p class="muted small">
            Inclui também menus, variantes, adicionais, personalização, subscrição, dados de onboarding, ficheiros
            carregados e o histórico interno da empresa. O histórico administrativo da plataforma é mantido. Nenhuma
            outra empresa é afetada.
          </p>
        </div>

        <p v-if="!preview.isActive" class="muted small">
          Se só pretende bloquear o acesso mantendo os dados, a empresa já está suspensa — não precisa de a eliminar.
        </p>
        <p v-else class="muted small">
          Para bloquear o acesso mantendo os dados, use antes <strong>Suspender empresa</strong>.
        </p>

        <label class="ack-row">
          <input v-model="acknowledged" type="checkbox" :disabled="isDeleting" />
          <span>Compreendo que todos os dados desta empresa serão perdidos e que não é possível recuperá-los.</span>
        </label>

        <label class="name-field">
          <span>Para confirmar, escreva o nome da empresa: <strong>{{ preview.name }}</strong></span>
          <input
            v-model="typedName"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :placeholder="preview.name"
            :disabled="isDeleting"
            @paste.prevent
          />
        </label>

        <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
      </template>
    </div>

    <template #footer>
      <AppButton variant="secondary" :disabled="isDeleting" @click="close">Cancelar</AppButton>
      <AppButton variant="danger" :disabled="!canDelete" :loading="isDeleting" @click="confirmDelete">
        Eliminar permanentemente
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.delete-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.danger-banner {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.45;
}

.danger-banner svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.danger-banner p {
  margin: 0;
}

.state-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
  font-size: 0.875rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.company-summary {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #0f172a;
}

.section-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #64748b;
}

.counts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
  margin: 0 0 0.5rem;
}

.count-item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.count-item dt {
  color: #475569;
}

.count-item dd {
  margin: 0;
  font-weight: 700;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.muted {
  color: #64748b;
}

.small {
  font-size: 0.8125rem;
  line-height: 1.45;
  margin: 0;
}

.ack-row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
}

.ack-row input {
  margin-top: 0.2rem;
}

.name-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: #334155;
}

.name-field input {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #fca5a5;
  font-size: 0.875rem;
  color: #111827;
  background: #ffffff;
}

.name-field input:focus {
  outline: 2px solid #ef4444;
  outline-offset: 1px;
}

.error-text {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.8125rem;
}
</style>
