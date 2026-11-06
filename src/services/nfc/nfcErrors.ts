import { NfcError } from '@/types'

/**
 * Tradução de exceções Web NFC para mensagens compreensíveis (pt-PT).
 * Nunca mostrar `Error: DOMException...` em bruto na UI — o detalhe técnico
 * é preservado em `technical` para diagnóstico no ecrã "Testar NFC".
 */
export function translateNfcException(e: unknown): NfcError {
  if (e instanceof NfcError) return e

  const err = (e ?? {}) as { name?: string; message?: string }
  const name = err.name ?? ''
  const message = err.message ?? ''
  const technical = `${name || 'Erro'}: ${message || 'sem detalhe adicional'}`

  switch (name) {
    case 'AbortError':
      return new NfcError('cancelled', 'Operação cancelada.', technical)

    case 'NotAllowedError':
      if (/activate|disabled|nfc.*off|suspended/i.test(message)) {
        return new NfcError(
          'adapter_unavailable',
          'O NFC está desativado no dispositivo. Ative o NFC nas definições do telemóvel e tente novamente.',
          technical
        )
      }
      if (/denied|rejected|permission/i.test(message)) {
        return new NfcError(
          'permission_denied',
          'Permissão de uso da NFC negada. Autorize o acesso à NFC nas permissões do navegador e tente novamente.',
          technical
        )
      }
      return new NfcError(
        'permission_denied',
        'Não foi permitido usar a NFC nesta sessão. Toque novamente em "Gravar etiqueta NFC" para tentar de novo.',
        technical
      )

    case 'NotSupportedError':
      if (/adapter/i.test(message)) {
        return new NfcError(
          'adapter_unavailable',
          'Nenhum leitor NFC disponível. Verifique se o NFC está ativado no dispositivo e se o navegador suporta Web NFC.',
          technical
        )
      }
      return new NfcError(
        'not_supported',
        'Este tipo de etiqueta NFC não é suportado pelo navegador (tem de estar formatada NDEF) ou o adaptador não suporta escrita.',
        technical
      )

    case 'NotReadableError':
      return new NfcError(
        'adapter_busy',
        'Não foi possível aceder ao leitor NFC. Feche outras aplicações que usem NFC (pagamentos, leitura de cartões) e tente novamente.',
        technical
      )

    case 'NetworkError':
      return new NfcError(
        'transfer_failed',
        'A transferência foi interrompida — provavelmente a etiqueta foi removida durante a gravação. Mantenha a etiqueta encostada à traseira do dispositivo e tente novamente.',
        technical
      )

    case 'InvalidStateError':
      return new NfcError(
        'invalid_state',
        'Estado de NFC inválido. Feche esta janela, confirme que o NFC está ativado e tente novamente.',
        technical
      )

    case 'TimeoutError':
      return new NfcError(
        'adapter_unavailable',
        'Tempo de comunicação com a etiqueta esgotado. Encoste a etiqueta de forma firme e tente novamente.',
        technical
      )

    case 'TypeError':
      if (/NDEFReader|undefined/i.test(message)) {
        return new NfcError(
          'not_supported',
          'A Web NFC API não está disponível neste dispositivo ou navegador.',
          technical
        )
      }
      break

    default:
      break
  }

  // Heurísticas adicionais pela mensagem
  if (/user activation|gesture/i.test(message)) {
    return new NfcError(
      'permission_denied',
      'A NFC precisa de ser acionada por um toque (gesto do utilizador). Toque em "Gravar etiqueta NFC" para começar.',
      technical
    )
  }
  if (/secure/i.test(message)) {
    return new NfcError(
      'insecure_context',
      'A gravação NFC só é possível numa página segura (HTTPS). Abra o TapMenu num endereço HTTPS.',
      technical
    )
  }

  return new NfcError(
    'unknown',
    'Ocorreu um erro inesperado na operação NFC. O detalhe técnico está disponível no diagnóstico e a operação pode ser repetida.',
    technical
  )
}
