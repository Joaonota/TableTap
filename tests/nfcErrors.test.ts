import { describe, expect, it } from 'vitest'
import { NfcError } from '@/types'
import { translateNfcException } from '@/services/nfc/nfcErrors'

const domError = (name: string, message: string) => ({ name, message })

describe('translateNfcException', () => {
  it('mantém NfcError já normalizado', () => {
    const original = new NfcError('cancelled', 'Cancelado')
    expect(translateNfcException(original)).toBe(original)
  })

  it('traduz NotSupportedError de etiqueta incompatível', () => {
    const error = translateNfcException(
      domError('NotSupportedError', 'This tag is not supported.'),
      { phase: 'write' }
    )
    expect(error.code).toBe('tag_not_supported')
    expect(error.message).toMatch(/não é compatível/)
    expect(error.message).not.toMatch(/DOMException/)
    expect(error.technical).toMatch(/NotSupportedError/)
    expect(error.hint).toMatch(/NTAG213/)
  })

  it('distingue etiqueta read-only', () => {
    const error = translateNfcException(
      domError('NotSupportedError', 'This tag is write-protected.'),
      { phase: 'write' }
    )
    expect(error.code).toBe('read_only_tag')
    expect(error.retryable).toBe(false)
  })

  it('traduz NFC desativado em NotAllowedError', () => {
    const error = translateNfcException(
      domError('NotAllowedError', 'NFC is disabled, please activate it.'),
      { phase: 'write' }
    )
    expect(error.code).toBe('adapter_unavailable')
    expect(error.message).toMatch(/desativado/i)
  })

  it('traduz permissão negada', () => {
    const error = translateNfcException(
      domError('NotAllowedError', 'Permission denied by user.'),
      { phase: 'write' }
    )
    expect(error.code).toBe('permission_denied')
  })

  it('traduz gesto do utilizador necessário', () => {
    const error = translateNfcException(
      domError('NotAllowedError', 'A user activation is required.'),
      { phase: 'write' }
    )
    expect(error.code).toBe('user_activation_required')
  })

  it('traduz SecurityError', () => {
    const error = translateNfcException(domError('SecurityError', 'Blocked by policy.'))
    expect(error.code).toBe('security_error')
  })

  it('traduz AbortError como cancelamento', () => {
    expect(translateNfcException(domError('AbortError', 'The operation was aborted.')).code).toBe('cancelled')
  })

  it('traduz NetworkError como transferência interrompida', () => {
    expect(translateNfcException(domError('NetworkError', 'Tag was removed.')).code).toBe('transfer_failed')
  })

  it('traduz InvalidStateError', () => {
    expect(translateNfcException(domError('InvalidStateError', 'Invalid state.')).code).toBe('invalid_state')
  })

  it('traduz NotReadableError como adaptador ocupado', () => {
    expect(translateNfcException(domError('NotReadableError', 'Busy.')).code).toBe('adapter_busy')
  })

  it('não expõe detalhe técnico como mensagem principal', () => {
    const error = translateNfcException(domError('NotSupportedError', 'This tag is not supported.'))
    expect(error.message).not.toContain('This tag is not supported')
  })
})
