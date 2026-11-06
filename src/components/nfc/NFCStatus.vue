<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { nfcService } from '@/services/nfc/nfcService'
import type { NfcCapabilities } from '@/types'
import {
  Radio,
  ShieldOff,
  AlertTriangle,
  ShieldCheck,
  RefreshCw
} from 'lucide-vue-next'

interface Props {
  /** mostra as notas de limitação/explicação por baixo do estado */
  showNotes?: boolean
  /** mostra o botão de re-verificação */
  showRefresh?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showNotes: true,
  showRefresh: false
})

const caps = ref<NfcCapabilities | null>(null)
const isChecking = ref(false)

const compute = async () => {
  isChecking.value = true
  const permission = await nfcService.getPermissionState()
  caps.value = nfcService.getCapabilities(permission)
  isChecking.value = false
}

onMounted(compute)

const state = computed<'available' | 'not_supported' | 'insecure'>(() => {
  const c = caps.value
  if (!c) return 'available' // estado neutro durante a verificação inicial
  if (!c.apiSupported) return 'not_supported'
  if (!c.secureContext) return 'insecure'
  return 'available'
})

const stateLabel = computed(() => {
  switch (state.value) {
    case 'available': return 'NFC disponível'
    case 'not_supported': return 'NFC não suportado'
    case 'insecure': return 'Contexto não seguro (HTTPS necessário)'
  }
})

const stateBoxClass = computed(() => ({
  'is-available': state.value === 'available',
  'is-unsupported': state.value === 'not_supported',
  'is-insecure': state.value === 'insecure'
}))
</script>

<template>
  <div class="nfc-status-card" :class="stateBoxClass">
    <div class="nfc-status-left">
      <div class="nfc-status-icon">
        <ShieldCheck v-if="state === 'available'" :size="22" />
        <AlertTriangle v-else-if="state === 'insecure'" :size="22" />
        <ShieldOff v-else :size="22" />
      </div>
      <div class="nfc-status-titles">
        <div class="nfc-status-title-row">
          <strong class="nfc-status-title">Gravação NFC REAL — Web NFC API</strong>
          <span class="nfc-status-state">
            <Radio :size="13" />
            {{ stateLabel }}
          </span>
        </div>
        <p class="nfc-status-sub">
          Sistema de gravação usando a Web NFC API (NDEFReader). A URL registada é gravada
          fisicamente na etiqueta — nunca há simulização de sucesso.
        </p>
      </div>
    </div>

    <button
      v-if="showRefresh"
      class="nfc-status-refresh"
      title="Voltar a verificar capacidades do dispositivo"
      :disabled="isChecking"
      @click="compute"
    >
      <RefreshCw :size="14" :class="{ 'spin': isChecking }" />
    </button>

    <ul v-if="showNotes && caps" class="nfc-status-notes">
      <li v-for="(note, i) in caps.notes" :key="i">{{ note }}</li>
    </ul>
  </div>
</template>

<style scoped>
.nfc-status-card {
  border-radius: var(--radius-lg);
  padding: 1.05rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--border-subtle);
  background: linear-gradient(135deg, var(--color-primary-50), #f0f7ff);
  position: relative;
}

.nfc-status-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nfc-status-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.is-available .nfc-status-icon {
  background-color: var(--color-primary-800);
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(30, 64, 175, 0.25);
}

.is-unsupported .nfc-status-icon,
.is-insecure .nfc-status-icon {
  background-color: #fef3c7;
  color: #b45309;
}

.is-unsupported {
  background: linear-gradient(135deg, #fffbeb, #fef3e2);
}

.is-insecure {
  background: linear-gradient(135deg, #fff7ed, #fffbeb);
}

.nfc-status-titles {
  min-width: 0;
}

.nfc-status-title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.nfc-status-title {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--color-primary-950);
}

.is-unsupported .nfc-status-title,
.is-insecure .nfc-status-title {
  color: #7c2d12;
}

.nfc-status-state {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-800);
  color: #ffffff;
}

.is-unsupported .nfc-status-state,
.is-insecure .nfc-status-state {
  background-color: #b45309;
}

.nfc-status-sub {
  font-size: 0.8125rem;
  color: var(--color-primary-900);
  line-height: 1.5;
  margin: 0;
}

.nfc-status-refresh {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: #ffffff;
  color: var(--color-neutral-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.nfc-status-refresh:hover {
  color: var(--color-primary-800);
  border-color: var(--color-primary-200);
}

.nfc-status-refresh:disabled {
  cursor: default;
  opacity: 0.7;
}

.spin {
  animation: nfc-spin 0.9s linear infinite;
}

@keyframes nfc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.nfc-status-notes {
  margin: 0;
  padding: 0.75rem 1rem 0.75rem 2.25rem;
  border-top: 1px dashed rgba(30, 64, 175, 0.25);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.nfc-status-notes li {
  font-size: 0.78rem;
  line-height: 1.45;
  color: #1e3a8a;
  list-style: disc outside;
}

.is-unsupported .nfc-status-notes li,
.is-insecure .nfc-status-notes li {
  color: #7c2d12;
}
</style>
