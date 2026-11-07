<script setup lang="ts">
import type { NfcError, NfcOpState } from '@/types'
import {
  CheckCircle2,
  AlertTriangle,
  ShieldQuestion,
  Search
} from 'lucide-vue-next'

interface Props {
  /** estado da operação; 'different'/'no_url'/'unreadable'/'idle' descrevem resultados de verificação */
  state: NfcOpState | 'different' | 'no_url' | 'unreadable' | 'idle'
  expectedUrl?: string | null
  foundUrl?: string | null
  /** detalhe técnico opcional (exibido só no bloco de falha) */
  technical?: string | null
}

defineProps<Props>()

/**
 * NFCVerification — bloco de VERIFICAÇÃO REAL pós-gravação.
 * Mostra esperado vs. encontrado e nunca afirma validação sem confirmação.
 */
const statusTitle: Record<string, string> = {
  verifying: 'Verificando conteúdo gravado...',
  verified: 'Etiqueta verificada com sucesso.',
  different: 'Conteúdo diferente do esperado',
  no_url: 'Etiqueta sem registo URL',
  unreadable: 'Gravação concluída, mas a verificação independente não foi possível',
  verify_failed: 'Verificação não concluída',
  cancelled: 'Verificação cancelada',
  failed: 'Falha na verificação'
}

const statusBody: Record<string, string> = {
  verifying: 'Encoste novamente a etiqueta NFC na parte traseira do dispositivo.',
  verified: 'O conteúdo físico da etiqueta corresponde ao endereço esperado.',
  different: 'Não foi possível confirmar que o conteúdo gravado corresponde ao endereço esperado. A etiqueta não é marcada como validada.',
  no_url: 'A etiqueta foi lida mas não contém um registo NDEF URL. A etiqueta não é marcada como validada.',
  unreadable: 'A escrita física terminou, mas não foi possível ler a etiqueta novamente. A gravação não foi validada por leitura independente.',
  verify_failed: 'Não foi possível confirmar o conteúdo gravado. Encoste novamente a etiqueta para tentar verificar.',
  cancelled: 'A verificação foi cancelada. Pode verificar a etiqueta mais tarde em "Detalhes".',
  failed: 'Não foi possível concluir a verificação. Tente novamente.'
}

const statusIcon: Record<string, unknown> = {
  verifying: Search,
  verified: CheckCircle2,
  different: AlertTriangle,
  no_url: ShieldQuestion,
  unreadable: ShieldQuestion,
  verify_failed: ShieldQuestion,
  cancelled: ShieldQuestion,
  failed: AlertTriangle
}

const toneClass: Record<string, string> = {
  verifying: 'tone-info',
  verified: 'tone-success',
  different: 'tone-warning',
  no_url: 'tone-warning',
  unreadable: 'tone-warning',
  verify_failed: 'tone-warning',
  cancelled: 'tone-neutral',
  failed: 'tone-warning'
}
</script>

<template>
  <div class="verification-card" :class="toneClass[state] || 'tone-neutral'">
    <div class="verification-head">
      <component :is="(statusIcon[state] || ShieldQuestion) as any" :size="22" class="verification-icon" />
      <div>
        <strong class="verification-title">{{ statusTitle[state] || statusTitle.failed }}</strong>
        <p v-if="statusBody[state]" class="verification-body">{{ statusBody[state] }}</p>
      </div>
    </div>

    <div v-if="state === 'verifying'" class="verification-pulse" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>

    <div
      v-if="(state === 'different' || state === 'no_url' || state === 'verified') && expectedUrl"
      class="verification-compare"
    >
      <div class="compare-row">
        <span class="compare-key">Esperado</span>
        <span class="compare-val font-mono">{{ expectedUrl }}</span>
      </div>
      <div class="compare-row">
        <span class="compare-key">Encontrado</span>
        <span class="compare-val font-mono" :class="{ 'val-missing': !foundUrl }">
          {{ foundUrl || '— nenhum URL lido —' }}
        </span>
      </div>
    </div>

    <p v-if="state === 'failed' && technical" class="verification-technical font-mono">{{ technical }}</p>
  </div>
</template>

<style scoped>
.verification-card {
  border-radius: var(--radius-lg);
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tone-success { background: #f0fdf4; border: 1px solid #bbf7d0; }
.tone-info { background: var(--color-primary-50); border: 1px solid var(--color-primary-200); }
.tone-warning { background: #fffbeb; border: 1px solid #fde68a; }
.tone-neutral { background: var(--color-neutral-50); border: 1px solid var(--border-subtle); }

.verification-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.tone-success .verification-icon { color: #16a34a; }
.tone-info .verification-icon { color: var(--color-primary-800); animation: v-pulse 1.1s ease-in-out infinite; }
.tone-warning .verification-icon { color: #b45309; }
.tone-neutral .verification-icon { color: var(--color-neutral-600); }

@keyframes v-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.04); }
}

.verification-title {
  font-size: 0.9rem;
  font-weight: 800;
}

.tone-success .verification-title { color: #166534; }
.tone-info .verification-title { color: var(--color-primary-900); }
.tone-warning .verification-title { color: #92400e; }
.tone-neutral .verification-title { color: var(--color-neutral-800); }

.verification-body {
  margin: 0.15rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.tone-success .verification-body { color: #15803d; }
.tone-info .verification-body { color: var(--color-primary-900); }
.tone-warning .verification-body { color: #78350f; }
.tone-neutral .verification-body { color: var(--text-muted); }

.verification-pulse {
  display: inline-flex;
  gap: 0.35rem;
}

.verification-pulse span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary-700);
  animation: dot-pulse 1s ease-in-out infinite;
}

.verification-pulse span:nth-child(2) { animation-delay: 0.15s; }
.verification-pulse span:nth-child(3) { animation-delay: 0.3s; }

@keyframes dot-pulse {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50% { transform: translateY(-4px); opacity: 1; }
}

.verification-compare {
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  padding-top: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.compare-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.compare-key {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.compare-val {
  font-size: 0.75rem;
  word-break: break-all;
  text-align: right;
  min-width: 0;
}

.val-missing {
  color: #b45309;
  font-style: italic;
}

.verification-technical {
  margin: 0;
  font-size: 0.6875rem;
  color: #92400e;
  opacity: 0.8;
  word-break: break-all;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
