<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTableStore } from '@/stores/table'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import type { Table, TableStatus } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  Grid,
  List,
  Plus,
  QrCode,
  ExternalLink,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  Copy,
  Printer
} from 'lucide-vue-next'

const tableStore = useTableStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const viewMode = ref<'grid' | 'table'>('grid')
const isEditModalOpen = ref(false)
const isQrModalOpen = ref(false)
const selectedTable = ref<Table | null>(null)
const generatedQrDataUrl = ref('')

// Form state
const formId = ref<string | undefined>(undefined)
const formNumber = ref('')
const formName = ref('')
const formArea = ref<any>('Sala Principal')
const formCapacity = ref(4)

const areaOptions = [
  { label: 'Sala Principal', value: 'Sala Principal' },
  { label: 'Esplanada', value: 'Esplanada' },
  { label: 'Varanda', value: 'Varanda' },
  { label: 'Bar', value: 'Bar' },
  { label: 'Piso 1', value: 'Piso 1' },
  { label: 'Privado', value: 'Privado' }
]

onMounted(async () => {
  await tableStore.loadTables()
})

const openAddModal = () => {
  formId.value = undefined
  formNumber.value = String(tableStore.tables.length + 1).padStart(2, '0')
  formName.value = `Mesa ${formNumber.value}`
  formArea.value = 'Sala Principal'
  formCapacity.value = 4
  isEditModalOpen.value = true
}

const openEditModal = (tbl: Table) => {
  formId.value = tbl.id
  formNumber.value = tbl.number
  formName.value = tbl.name || ''
  formArea.value = tbl.area
  formCapacity.value = tbl.capacity
  isEditModalOpen.value = true
}

const handleSaveTable = async () => {
  if (!formNumber.value.trim()) {
    toastStore.warning('Insira o número da mesa')
    return
  }
  await tableStore.saveTable({
    id: formId.value,
    number: formNumber.value,
    name: formName.value,
    area: formArea.value,
    capacity: Number(formCapacity.value)
  })
  isEditModalOpen.value = false
}

const handleDeleteTable = async (id: string) => {
  if (confirm('Tem a certeza de que deseja remover esta mesa?')) {
    await tableStore.deleteTable(id)
  }
}

const openQrModal = async (tbl: Table) => {
  selectedTable.value = tbl
  const fullUrl = `${window.location.origin}${tbl.publicUrl}`
  generatedQrDataUrl.value = await tableStore.generateQrCode(fullUrl)
  isQrModalOpen.value = true
}

const copyUrl = (tbl: Table) => {
  const fullUrl = `${window.location.origin}${tbl.publicUrl}`
  navigator.clipboard.writeText(fullUrl)
  toastStore.success('Link Copiado', 'Endereço da mesa copiado para a área de transferência!')
}

const handleQuickStatusChange = async (tbl: Table, status: TableStatus) => {
  await tableStore.updateTableStatus(tbl.id, status)
}

const originUrl = typeof window !== 'undefined' ? window.location.origin : ''
const printDisplay = () => {
  window.print()
}
</script>

<template>
  <div class="tables-page">
    <div class="tables-header">
      <div>
        <h1 class="page-title">Gestão de Mesas & Espaços</h1>
        <p class="page-subtitle">Configure mesas, capacidade de clientes e aceda aos respetivos links e QR Codes</p>
      </div>

      <div class="header-actions">
        <div class="view-toggle">
          <button
            class="toggle-btn"
            :class="{ 'is-active': viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            <Grid :size="16" />
            <span>Grelha</span>
          </button>
          <button
            class="toggle-btn"
            :class="{ 'is-active': viewMode === 'table' }"
            @click="viewMode = 'table'"
          >
            <List :size="16" />
            <span>Tabela</span>
          </button>
        </div>

        <AppButton variant="primary" @click="openAddModal">
          <template #icon-left>
            <Plus :size="16" />
          </template>
          Adicionar Mesa
        </AppButton>
      </div>
    </div>

    <!-- Grid View -->
    <div v-if="viewMode === 'grid'" class="tables-grid">
      <div
        v-for="tbl in tableStore.tables"
        :key="tbl.id"
        class="table-card"
        :class="`status-${tbl.status}`"
      >
        <div class="card-top">
          <div class="table-number-box">
            <span class="t-prefix">MESA</span>
            <span class="t-num">{{ tbl.number }}</span>
          </div>

          <AppBadge
            :variant="
              tbl.status === 'free' ? 'success' :
              tbl.status === 'occupied' ? 'primary' :
              tbl.status === 'has_order' ? 'warning' :
              tbl.status === 'waiting_bill' ? 'danger' :
              tbl.status === 'waiting_service' ? 'danger' : 'neutral'
            "
          >
            {{
              tbl.status === 'free' ? 'Livre' :
              tbl.status === 'occupied' ? 'Ocupada' :
              tbl.status === 'has_order' ? 'Com Pedido' :
              tbl.status === 'waiting_service' ? 'Chama Garçom' :
              tbl.status === 'waiting_bill' ? 'Pede Conta' : 'Indisponível'
            }}
          </AppBadge>
        </div>

        <div class="table-info">
          <div class="t-name">{{ tbl.name }}</div>
          <div class="t-meta">
            <span>{{ tbl.area }}</span> •
            <span><Users :size="13" class="inline-icon" /> Até {{ tbl.capacity }} pessoas</span>
          </div>
        </div>

        <!-- Quick Status Selector -->
        <div class="quick-status-row">
          <select
            :value="tbl.status"
            class="status-select"
            @change="handleQuickStatusChange(tbl, ($event.target as HTMLSelectElement).value as TableStatus)"
          >
            <option value="free">Marcar como Livre</option>
            <option value="occupied">Marcar Ocupada</option>
            <option value="has_order">Com Pedido Ativo</option>
            <option value="waiting_service">Aguardar Garçom</option>
            <option value="waiting_bill">Aguardar Conta</option>
            <option value="unavailable">Indisponível</option>
          </select>
        </div>

        <div class="table-actions-row">
          <button class="t-action-btn" title="Gerar e Ver QR Code" @click="openQrModal(tbl)">
            <QrCode :size="16" />
            <span>QR Code</span>
          </button>

          <a :href="tbl.publicUrl" target="_blank" class="t-action-btn" title="Abrir Menu do Cliente">
            <ExternalLink :size="16" />
            <span>Menu</span>
          </a>

          <button class="t-icon-btn" title="Editar Mesa" @click="openEditModal(tbl)">
            <Edit2 :size="14" />
          </button>

          <button class="t-icon-btn danger" title="Remover Mesa" @click="handleDeleteTable(tbl.id)">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <div v-else class="app-card table-view-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Nome</th>
            <th>Área</th>
            <th>Lotação</th>
            <th>Estado Atual</th>
            <th>Acesso Digital</th>
            <th class="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tbl in tableStore.tables" :key="tbl.id">
            <td><strong>Mesa {{ tbl.number }}</strong></td>
            <td>{{ tbl.name }}</td>
            <td>{{ tbl.area }}</td>
            <td>{{ tbl.capacity }} pessoas</td>
            <td>
              <AppBadge
                :variant="
                  tbl.status === 'free' ? 'success' :
                  tbl.status === 'occupied' ? 'primary' :
                  tbl.status === 'has_order' ? 'warning' : 'neutral'
                "
              >
                {{ tbl.status }}
              </AppBadge>
            </td>
            <td>
              <button class="link-btn" @click="openQrModal(tbl)">
                <QrCode :size="14" />
                <span>Ver QR Code</span>
              </button>
            </td>
            <td class="text-right">
              <div class="row-btns">
                <a :href="tbl.publicUrl" target="_blank" class="icon-link" title="Testar Menu">
                  <ExternalLink :size="15" />
                </a>
                <button class="icon-link" title="Editar" @click="openEditModal(tbl)">
                  <Edit2 :size="15" />
                </button>
                <button class="icon-link danger" title="Eliminar" @click="handleDeleteTable(tbl.id)">
                  <Trash2 :size="15" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / Edit Table Modal -->
    <AppModal
      :is-open="isEditModalOpen"
      :title="formId ? 'Editar Mesa' : 'Adicionar Nova Mesa'"
      @close="isEditModalOpen = false"
    >
      <form class="modal-form" @submit.prevent="handleSaveTable">
        <div class="form-row">
          <AppInput
            v-model="formNumber"
            label="Número da Mesa"
            placeholder="Ex: 01, 02, M1..."
            required
          />
          <AppInput
            v-model="formCapacity"
            label="Capacidade (Pessoas)"
            type="number"
            required
          />
        </div>

        <AppInput
          v-model="formName"
          label="Nome / Descrição da Mesa (Opcional)"
          placeholder="Ex: Mesa Janela Vista Jardim"
        />

        <AppSelect
          v-model="formArea"
          label="Área do Restaurante"
          :options="areaOptions"
          required
        />
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="isEditModalOpen = false">Cancelar</AppButton>
        <AppButton variant="primary" @click="handleSaveTable">Guardar Mesa</AppButton>
      </template>
    </AppModal>

    <!-- QR Code Modal Local Generation -->
    <AppModal
      :is-open="isQrModalOpen"
      :title="`Código QR — Mesa ${selectedTable?.number}`"
      :subtitle="selectedTable?.name || tenantStore.currentRestaurant?.name"
      maxWidth="420px"
      @close="isQrModalOpen = false"
    >
      <div v-if="selectedTable" class="qr-modal-content">
        <div class="qr-frame">
          <img v-if="generatedQrDataUrl" :src="generatedQrDataUrl" alt="QR Code Mesa" class="qr-image" />
          <div class="qr-branding">
            <strong>TapMenu</strong> • Aproxime a Câmara
          </div>
        </div>

        <div class="qr-url-box">
          <span class="url-text">{{ originUrl }}{{ selectedTable.publicUrl }}</span>
          <button class="copy-btn" title="Copiar Link" @click="copyUrl(selectedTable)">
            <Copy :size="15" />
          </button>
        </div>

        <div class="qr-modal-actions">
          <AppButton variant="outline" class="w-full" @click="printDisplay">
            <template #icon-left>
              <Printer :size="16" />
            </template>
            Imprimir Display de Mesa
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.tables-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tables-header {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.view-toggle {
  display: flex;
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.2rem;
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-600);
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.toggle-btn.is-active {
  background: #ffffff;
  color: var(--color-primary-800);
  box-shadow: var(--shadow-xs);
}

/* Grid */
.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

.table-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.table-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-number-box {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.t-prefix {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-muted);
}

.t-num {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-neutral-900);
  line-height: 1;
}

.table-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.t-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-neutral-800);
}

.t-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.inline-icon {
  vertical-align: middle;
}

.quick-status-row {
  margin-top: 0.25rem;
}

.status-select {
  width: 100%;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  background: var(--color-neutral-50);
  outline: none;
  cursor: pointer;
}

.table-actions-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.t-action-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.45rem 0.5rem;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.t-action-btn:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
  color: var(--color-primary-800);
}

.t-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-neutral-600);
}

.t-icon-btn:hover {
  background: var(--color-neutral-200);
}

.t-icon-btn.danger:hover {
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}

/* Table View */
.table-view-card {
  padding: 0;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.data-table th {
  background: var(--color-neutral-50);
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  border-bottom: 1px solid var(--border-medium);
}

.data-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  color: var(--color-primary-700);
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
}

.row-btns {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.icon-link {
  color: var(--color-neutral-600);
  padding: 0.25rem;
}

.icon-link:hover {
  color: var(--color-primary-800);
}

.icon-link.danger:hover {
  color: var(--color-danger-600);
}

.text-right {
  text-align: right;
}

/* Modal Form */
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

/* QR Modal */
.qr-modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.qr-frame {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.qr-image {
  width: 240px;
  height: 240px;
  display: block;
  margin: 0 auto 0.75rem;
}

.qr-branding {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.qr-url-box {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
}

.url-text {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--color-neutral-700);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  background: transparent;
  border: none;
  color: var(--color-primary-800);
  cursor: pointer;
  padding: 0.25rem;
}

.qr-modal-actions {
  width: 100%;
}
</style>
