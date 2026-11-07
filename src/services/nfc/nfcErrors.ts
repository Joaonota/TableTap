import { NfcError } from '@/types'

/**
 * Tradução de exceções Web NFC para mensagens compreensíveis (pt-PT).
 * Nunca mostrar `Error: DOMException...` em bruto na UI — o detalhe técnico
 * é preservado em `technical` para diagnóstico no ecrã "Diagnóstico NFC".
 *
 * `phase` ajuda a distinguir erros equivalentes: um `NotSupportedError`
 * durante `write()` é normalmente a etiqueta; durante `scan()` é normalmente
 * o adaptador / navegador.
 */

export interface NfcErrorTranslationContext {
  phase?: 'read' | 'write' | 'unknown'
}

const TAG_NDEF_HINT =
  'Use uma etiqueta NFC Forum Type 2 gravável e formatada em NDEF (por exemplo NTAG213, NTAG215 ou NTAG216).'

export function translateNfcException(
  e: unknown,
  context: NfcErrorTranslationContext = {}
): NfcError {
  if (e instanceof NfcError) return e

  const err = (e ?? {}) as { name?: string; message?: string }
  const name = err.name ?? ''
  const message = err.message ?? ''
  const technical = `${name || 'Erro'}: ${message || 'sem detalhe adicional'}`
  const phase = context.phase ?? 'unknown'

  switch (name) {
    case 'AbortError':
      return new NfcError('cancelled', 'Operação cancelada.', technical, { retryable: true })

    case 'NotAllowedError':
      if (/activate|disabled|nfc.*off|suspended|turned off/i.test(message)) {
        return new NfcError(
          'adapter_unavailable',
          'O NFC está desativado no dispositivo. Ative o NFC nas definições do telemóvel e tente novamente.',
          technical,
          { hint: 'Definições do Android → Conexões/Dispositivos → NFC.', retryable: true }
        )
      }
      if (/user activation|gesture|sticky/i.test(message)) {
        return new NfcError(
          'user_activation_required',
          'A gravação NFC tem de ser iniciada por um toque no botão. Toque novamente em "Gravar etiqueta NFC".',
          technical,
          { retryable: true }
        )
      }
      if (/overwrite|already contains|existing records/i.test(message)) {
        return new NfcError(
          'invalid_state',
          'A etiqueta já contém dados e a substituição não foi autorizada. Confirme a opção de regravação e tente novamente.',
          technical,
          { retryable: true }
        )
      }
      if (/denied|rejected|permission|not allowed/i.test(message)) {
        return new NfcError(
          'permission_denied',
          'Permissão de uso da NFC negada. Autorize o acesso à NFC nas permissões do navegador e tente novamente.',
          technical,
          { hint: 'Permissões do site → NFC → Permitir.', retryable: true }
        )
      }
      return new NfcError(
        'permission_denied',
        'Não foi permitido usar a NFC nesta sessão. Toque novamente em "Gravar etiqueta NFC" para tentar de novo.',
        technical,
        { retryable: true }
      )

    case 'SecurityError':
      return new NfcError(
        'security_error',
        'O navegador bloqueou o acesso NFC por segurança. Confirme que a página está em HTTPS e tente novamente.',
        technical,
        { hint: 'Abra o TapMenu num domínio HTTPS, sem restrições de política do browser.', retryable: true }
      )

    case 'NotSupportedError': {
      const isReadOnly = /write[-\s]?protected|read[-\s]?only|locked/i.test(message)
      if (isReadOnly) {
        return new NfcError(
          'read_only_tag',
          'Esta etiqueta está protegida contra escrita (read-only) e não pode ser gravada. Utilize outra etiqueta gravável.',
          technical,
          { hint: TAG_NDEF_HINT, retryable: false }
        )
      }

      const isTagLevel = /tag|ndef|format|mifare|classic/i.test(message)
      if (isTagLevel || phase === 'write') {
        return new NfcError(
          'tag_not_supported',
          'Esta etiqueta não é compatível com a gravação através deste dispositivo. Verifique se é uma etiqueta NFC NDEF compatível.',
          technical,
          {
            hint: `${TAG_NDEF_HINT} Etiquetas MIFARE Classic e etiquetas não formatadas não são suportadas pela Web NFC. A etiqueta não está necessariamente avariada.`,
            retryable: true
          }
        )
      }

      return new NfcError(
        'adapter_unavailable',
        'Nenhum leitor NFC compatível foi disponibilizado pelo navegador. Verifique se o NFC está ativado e se este navegador suporta Web NFC.',
        technical,
        { hint: 'Confirme NFC ligado e use Chrome/Edge/Samsung Internet no Android sobre HTTPS.', retryable: true }
      )
    }

    case 'NotReadableError':
      return new NfcError(
        'adapter_busy',
        'Não foi possível aceder ao leitor NFC. Feche outras aplicações que usem NFC (pagamentos, leitura de cartões) e tente novamente.',
        technical,
        { retryable: true }
      )

    case 'NetworkError':
      return new NfcError(
        'transfer_failed',
        'A transferência foi interrompida — provavelmente a etiqueta foi removida durante a gravação. Mantenha a etiqueta encostada à traseira do dispositivo e tente novamente.',
        technical,
        { retryable: true }
      )

    case 'InvalidStateError':
      return new NfcError(
        'invalid_state',
        'Estado de NFC inválido. Feche esta janela, confirme que o NFC está ativado e tente novamente.',
        technical,
        { retryable: true }
      )

    case 'TimeoutError':
      return new NfcError(
        'timeout',
        'Tempo de comunicação com a etiqueta esgotado. Encoste a etiqueta de forma firme e tente novamente.',
        technical,
        { retryable: true }
      )

    case 'TypeError':
      if (/NDEFReader|undefined/i.test(message)) {
        return new NfcError(
          'not_supported',
          'A Web NFC API não está disponível neste dispositivo ou navegador.',
          technical,
          { retryable: false }
        )
      }
      break

    default:
      break
  }

  // Heurísticas adicionais pela mensagem
  if (/user activation|gesture/i.test(message)) {
    return new NfcError(
      'user_activation_required',
      'A NFC precisa de ser acionada por um toque (gesto do utilizador). Toque em "Gravar etiqueta NFC" para começar.',
      technical,
      { retryable: true }
    )
  }
  if (/secure/i.test(message)) {
    return new NfcError(
      'insecure_context',
      'A gravação NFC só é possível numa página segura (HTTPS). Abra o TapMenu num endereço HTTPS.',
      technical,
      { retryable: false }
    )
  }
  if (/tag is not supported|not supported|ndef|format/i.test(message) && phase === 'write') {
    return new NfcError(
      'tag_not_supported',
      'Esta etiqueta não é compatível com a gravação através deste dispositivo. Verifique se é uma etiqueta NFC NDEF compatível.',
      technical,
      { hint: TAG_NDEF_HINT, retryable: true }
    )
  }

  return new NfcError(
    'unknown',
    'Ocorreu um erro inesperado na operação NFC. O detalhe técnico está disponível no diagnóstico e a operação pode ser repetida.',
    technical,
    { retryable: true }
  )
}
