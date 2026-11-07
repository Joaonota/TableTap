import { describe, expect, it } from 'vitest'
import { normalizeMenuUrl, validateNfcUrl } from '@/services/nfc/nfcUrl'

describe('validateNfcUrl', () => {
  it('aceita URLs absolutos HTTPS e HTTP', () => {
    expect(validateNfcUrl('https://tapmenu.app/menu/rest/1').valid).toBe(true)
    expect(validateNfcUrl('http://localhost:5173/menu/rest/1').valid).toBe(true)
  })

  it('rejeita URL vazio', () => {
    const result = validateNfcUrl('   ')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/vazio/i)
  })

  it('rejeita caminhos relativos', () => {
    expect(validateNfcUrl('/menu/rest/1').valid).toBe(false)
  })

  it('rejeita protocolos não HTTP(S)', () => {
    expect(validateNfcUrl('javascript:alert(1)').valid).toBe(false)
    expect(validateNfcUrl('ftp://example.com/tag').valid).toBe(false)
  })

  it('rejeita URLs com espaços', () => {
    expect(validateNfcUrl('https://tapmenu.app/menu/a b').valid).toBe(false)
  })
})

describe('normalizeMenuUrl', () => {
  it('remove espaços e barras finais para comparação', () => {
    expect(normalizeMenuUrl('  https://tapmenu.app/menu/a/1///  ')).toBe('https://tapmenu.app/menu/a/1')
  })
})
