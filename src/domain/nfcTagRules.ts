import type { NfcTag, NfcTagStatus } from '@/types'

/**
 * Regras de negócio das etiquetas NFC (registo administrativo).
 * Funções puras — usadas pelo repositório mock (que imita o backend) e pela
 * UI para decidir que ações mostrar. Um backend real deve aplicar as mesmas.
 */

export const NFC_TAG_STATUS_LABELS: Record<NfcTagStatus, string> = {
  pending: 'Pendente',
  configured: 'Configurada',
  active: 'Ativa',
  disabled: 'Desativada',
  reassignment_pending: 'Reatribuição pendente'
}

export const NFC_TAG_STATUS_DESCRIPTIONS: Record<NfcTagStatus, string> = {
  pending: 'Aguarda configuração física pela equipa TapMenu.',
  configured: 'A equipa registou a gravação da URL da mesa. Falta confirmar a instalação.',
  active: 'Instalada na mesa e em uso.',
  disabled: 'Fora de uso. Não está associada a nenhuma mesa.',
  reassignment_pending: 'A URL gravada não corresponde à mesa atual. A equipa tem de regravar a etiqueta.'
}

/** Formato do código físico: TAG-00017. */
export const NFC_TAG_CODE_PATTERN = /^TAG-\d{5}$/

export function formatTagCode(sequence: number): string {
  return `TAG-${String(sequence).padStart(5, '0')}`
}

/** Próximo código livre a partir dos existentes. */
export function nextTagCode(existingCodes: Iterable<string>): string {
  let max = 0
  for (const code of existingCodes) {
    const m = /^TAG-(\d+)$/.exec(code)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return formatTagCode(max + 1)
}

/**
 * Estado de uma etiqueta (não desativada) depois de mudar a associação.
 *  - nunca configurada                → pending
 *  - gravada com a URL da nova mesa   → configured
 *  - gravada com outra URL / sem mesa → reassignment_pending
 */
export function statusAfterAssociation(configuredPath: string | undefined, newTargetPath: string | undefined): NfcTagStatus {
  if (!configuredPath) return 'pending'
  if (newTargetPath && configuredPath === newTargetPath) return 'configured'
  return 'reassignment_pending'
}

export type NfcTagAction =
  | 'associate'
  | 'change_association'
  | 'reassign'
  | 'unassign'
  | 'mark_configured'
  | 'activate'
  | 'disable'
  | 'reactivate'

/** Ações permitidas pelo estado atual da etiqueta. */
export function allowedTagActions(tag: Pick<NfcTag, 'status' | 'tableId'>): NfcTagAction[] {
  const actions: NfcTagAction[] = []
  if (tag.status === 'disabled') return ['reactivate']

  if (!tag.tableId) {
    actions.push('associate')
  } else if (tag.status === 'pending') {
    // Ainda não foi gravada: mudar de mesa não tem impacto físico.
    actions.push('change_association', 'unassign')
  } else {
    // Já foi gravada: mudar de mesa obriga a regravar.
    actions.push('reassign', 'unassign')
  }

  if (tag.tableId && (tag.status === 'pending' || tag.status === 'reassignment_pending')) {
    actions.push('mark_configured')
  }
  if (tag.status === 'configured') actions.push('activate')
  actions.push('disable')
  return actions
}

export function canPerform(tag: Pick<NfcTag, 'status' | 'tableId'>, action: NfcTagAction): boolean {
  return allowedTagActions(tag).includes(action)
}
