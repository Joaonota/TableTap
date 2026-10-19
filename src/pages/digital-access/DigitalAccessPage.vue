<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTableStore } from '@/stores/table'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import type { DigitalAccess } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  QrCode,
  Radio,
  ExternalLink,
  Copy,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldAlert
} from 'lucide-vue-next'

const tableStore = useTableStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const selectedAccess = ref<DigitalAccess | null>(null)
const isQrModalOpen = ref(false)
const isNfcModalOpen = ref(false)
const qrDataUrl = ref('')
const isSimulatingNfc = ref(false)
const nfcSimulationOutput = ref<string | null>(null)

onMounted(async () => {
  await tableStore.loadTables()
})

const openQrModal = async (access: DigitalAccess) => {
  selectedAccess.value = access
  const fullUrl = `${window.location.origin}${access.url}`
  qrDataUrl.value = await tableStore.generateQrCode(fullUrl)
  isQrModalOpen.value = true
}

const copyLink = (access: DigitalAccess) => {
  const fullUrl = `${window.location.origin}${access.url}`
  navigator.clipboard.writeText(fullUrl)
  toastStore.success('Link Copiado!', 'URL da mesa copiada para a área de transferência.')
}

const openNfcModal = (access: DigitalAccess) => {
  selectedAccess.value = access
  nfcSimulationOutput.value = null
  isNfcModalOpen.value = true
}

const runNfcSimulation = () => {
  if (!selectedAccess.value) return
  isSimulatingNfc.value = true
  nfcSimulationOutput.value = null

  setTimeout(() => {
    const record = tableStore.simulateNfcWrite(selectedAccess.value!)
    isSimulatingNfc.value = false
    nfcSimulationOutput.value = `[NDEF RECORD GENERATED]\nTipo: URI (Uniform Resource Identifier)\nPayload: ${record.urlPayload}\nTag UID: ${record.tagUid}\nStatus: Simulação Concluída com Sucesso (200 OK)`
  }, 1200)
}

const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tapmenu.example'
const printSheet = () => window.print()
</script>

<template>
  <div class="digital-access-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Acesso Digital — NFC & Códigos QR</h1>
        <p class="page-subtitle">
          Faça a gestão dos pontos de acesso físicos para abertura instantânea do menu nas mesas
        </p>
      </div>
    </div>

    <!-- Info Notice Box -->
    <div class="info-alert-card">
      <div class="alert-icon-box">
        <Radio :size="22" />
      </div>
      <div class="alert-content">
        <h3 class="alert-title">Tecnologia Híbrida: NFC Contactless + QR Code de Alta Resolução</h3>
        <p class="alert-text">
          O cliente pode simplesmente aproximar o telemóvel da etiqueta NFC gravada ou ler o QR Code com a câmara nativa. Ambos os métodos apontam para a mesma URL segura da mesa correspondente.
        </p>
      </div>
    </div>

    <!-- Access Points Table -->
    <div class="app-card access-card">
      <div class="card-header">
        <h2 class="card-title">Pontos de Acesso Configurados no Restaurante</h2>
        <span class="badge badge-primary">{{ tableStore.accessList.length }} Mesas Ativas</span>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mesa</th>
              <th>Endereço do Menu Digital (URL)</th>
              <th>UID Tag NFC</th>
              <th>Status NFC</th>
              <th>Total de Scans</th>
              <th>Último Acesso</th>
              <th class="text-right">Ações de Ponto de Acesso</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="access in tableStore.accessList" :key="access.id">
              <td>
                <span class="table-number-pill">Mesa {{ access.tableNumber }}</span>
              </td>

              <td>
                <span class="url-snippet" :title="`${originUrl}${access.url}`">
                  {{ access.url }}
                </span>
              </td>

              <td>
                <span class="nfc-uid-tag">
                  {{ access.nfcTagUid || 'Não associado' }}
                </span>
              </td>

              <td>
                <AppBadge
                  :variant="
                    access.nfcStatus === 'programmed' ? 'success' :
                    access.nfcStatus === 'simulated' ? 'primary' : 'neutral'
                  "
                >
                  {{ access.nfcStatus === 'simulated' ? 'Simulado' : access.nfcStatus }}
                </AppBadge>
              </td>

              <td>
                <strong>{{ access.scanCount || 0 }}</strong> leituras
              </td>

              <td class="text-xs text-muted">
                {{ access.lastScannedAt ? new Date(access.lastScannedAt).toLocaleTimeString('pt-PT') : 'Sem registo' }}
              </td>

              <td class="text-right">
                <div class="actions-row">
                  <button class="btn-action" title="Gerar e Ver QR Code" @click="openQrModal(access)">
                    <QrCode :size="15" />
                    <span>QR</span>
                  </button>

                  <button class="btn-action nfc-btn" title="Simular Programação NFC" @click="openNfcModal(access)">
                    <Radio :size="15" />
                    <span>NFC</span>
                  </button>

                  <button class="btn-icon" title="Copiar URL" @click="copyLink(access)">
                    <Copy :size="15" />
                  </button>

                  <a :href="access.url" target="_blank" class="btn-icon" title="Abrir Menu">
                    <ExternalLink :size="15" />
                  </a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- NFC Simulation History -->
    <div v-if="tableStore.nfcHistory.length > 0" class="app-card nfc-history-card">
      <div class="card-header">
        <h2 class="card-title">Histórico de Auditoria de Gravações NFC (Simuladas)</h2>
        <span class="badge badge-neutral">{{ tableStore.nfcHistory.length }} Registos</span>
      </div>

      <div class="history-list">
        <div
          v-for="rec in tableStore.nfcHistory"
          :key="rec.id"
          class="history-item"
        >
          <div class="history-left">
            <CheckCircle2 :size="18" class="text-success" />
            <div>
              <strong>Mesa {{ rec.tableNumber }} • {{ rec.tagUid }}</strong>
              <div class="history-url">{{ rec.urlPayload }}</div>
            </div>
          </div>
          <div class="history-time">
            {{ new Date(rec.timestamp).toLocaleTimeString('pt-PT') }}
          </div>
        </div>
      </div>
    </div>

    <!-- QR Code Modal -->
    <AppModal
      :is-open="isQrModalOpen"
      :title="`Código QR — Mesa ${selectedAccess?.tableNumber}`"
      subtitle="Gerado localmente pelo TapMenu em SVG/PNG de alta densidade"
      maxWidth="420px"
      @close="isQrModalOpen = false"
    >
      <div v-if="selectedAccess" class="qr-preview-box">
        <div class="qr-render-frame">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="qr-canvas" />
          <div class="qr-footer-text">
            <strong>{{ tenantStore.currentRestaurant?.name }}</strong>
            <p>Mesa {{ selectedAccess.tableNumber }}</p>
          </div>
        </div>

        <div class="modal-url-display">
          <span>{{ originUrl }}{{ selectedAccess.url }}</span>
          <button class="btn-copy-sm" @click="copyLink(selectedAccess)">
            <Copy :size="14" />
          </button>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isQrModalOpen = false">Fechar</AppButton>
        <AppButton variant="primary" @click="printSheet">
          <template #icon-left>
            <Printer :size="16" />
          </template>
          Imprimir Folha de Mesa
        </AppButton>
      </template>
    </AppModal>

    <!-- NFC Simulation Modal -->
    <AppModal
      :is-open="isNfcModalOpen"
      :title="`Programação NFC — Mesa ${selectedAccess?.tableNumber}`"
      subtitle="Simulador de gravação física de tags NTAG213 / NTAG215"
      maxWidth="520px"
      @close="isNfcModalOpen = false"
    >
      <div v-if="selectedAccess" class="nfc-modal-content">
        <div class="nfc-notice-box">
          <ShieldAlert :size="20" class="text-warning" />
          <p class="text-xs">
            <strong>Aviso de Simulação:</strong> A gravação física em hardware NFC depende de leitores USB/smartphones com suporte a Web NFC. Nesta fase, o processo é validado e simulado deterministicamente.
          </p>
        </div>

        <div class="payload-summary">
          <div class="payload-field">
            <span class="field-label">URL Destino a Gravar:</span>
            <span class="field-val">{{ originUrl }}{{ selectedAccess.url }}</span>
          </div>
          <div class="payload-field">
            <span class="field-label">UID da Etiqueta NFC:</span>
            <span class="field-val font-mono">{{ selectedAccess.nfcTagUid || 'NFC-AUTOGEN' }}</span>
          </div>
        </div>

        <div v-if="nfcSimulationOutput" class="console-output">
          <pre>{{ nfcSimulationOutput }}</pre>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isNfcModalOpen = false">Cancelar</AppButton>
        <AppButton
          variant="primary"
          :loading="isSimulatingNfc"
          @click="runNfcSimulation"
        >
          <template #icon-left>
            <Radio :size="16" />
          </template>
          Executar Gravação Simulada
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.digital-access-page {
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
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.info-alert-card {
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.alert-icon-box {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  background: var(--color-primary-800);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.alert-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-primary-900);
  margin-bottom: 0.25rem;
}

.alert-text {
  font-size: 0.8125rem;
  color: var(--color-primary-900);
  line-height: 1.5;
}

/* Access Card & Table */
.access-card {
  padding: 0;
  overflow: hidden;
}

.card-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.table-wrapper {
  overflow-x: auto;
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
  vertical-align: middle;
}

.table-number-pill {
  font-weight: 700;
  color: var(--color-neutral-900);
}

.url-snippet {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--color-primary-800);
  background: var(--color-primary-50);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nfc-uid-tag {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--color-neutral-600);
}

.actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  color: var(--color-neutral-700);
  transition: all var(--transition-fast);
}

.btn-action:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
  color: var(--color-primary-800);
}

.btn-action.nfc-btn:hover {
  background: #fdf2f8;
  border-color: #fbcfe8;
  color: #db2777;
}

.btn-icon {
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-neutral-600);
}

.btn-icon:hover {
  background: var(--color-neutral-100);
}

.text-right {
  text-align: right;
}

/* NFC History */
.nfc-history-card {
  padding: 1.25rem 1.5rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
}

.history-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.history-url {
  font-family: monospace;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.history-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Modals */
.qr-preview-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.qr-render-frame {
  background: #ffffff;
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.qr-canvas {
  width: 240px;
  height: 240px;
  display: block;
  margin: 0 auto 0.75rem;
}

.qr-footer-text strong {
  font-size: 1rem;
  color: var(--color-neutral-900);
}

.qr-footer-text p {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.modal-url-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-family: monospace;
}

.btn-copy-sm {
  background: transparent;
  border: none;
  color: var(--color-primary-800);
  cursor: pointer;
}

.nfc-modal-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.nfc-notice-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: var(--color-warning-50);
  border: 1px solid var(--color-warning-100);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  color: var(--color-warning-600);
}

.payload-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--color-neutral-50);
  padding: 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.payload-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
}

.field-val {
  font-size: 0.875rem;
  color: var(--color-neutral-900);
}

.console-output {
  background: #0f172a;
  color: #38bdf8;
  padding: 1rem;
  border-radius: var(--radius-md);
  font-family: monospace;
  font-size: 0.75rem;
  overflow-x: auto;
}
</style>
