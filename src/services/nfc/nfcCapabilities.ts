import type { NfcCapabilities, NfcPermissionState } from '@/types'

/**
 * Deteção REAL de capacidades Web NFC.
 *
 * Princípios:
 *  - Nunca inventar suporte: só afirma o que a API/heurística realmente mostra.
 *  - `hardwareLockSupported` é sempre `false` — a Web NFC API não expõe o
 *    bloqueio físico (read-only por hardware) das etiquetas.
 */

export function isNfcApiSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'NDEFReader' in window && typeof (window as unknown as { NDEFReader?: unknown }).NDEFReader === 'function'
}

export function isSecureContextForNfc(): boolean {
  if (typeof window === 'undefined') return false
  return window.isSecureContext === true
}

function detectEngine(ua: string): NfcCapabilities['browserEngine'] {
  if (/Chrom(e|ium)|CriOS|Edg\//.test(ua)) return 'chromium'
  if (/Firefox|FxiOS/.test(ua)) return 'gecko'
  if (/Safari/.test(ua)) return 'webkit'
  return 'unknown'
}

function detectPlatform(ua: string): NfcCapabilities['platformHint'] {
  if (/Android/.test(ua)) return 'android'
  if (/CrOS/.test(ua)) return 'chromeos'
  // iPadOS 13+ presentationally masquerades as desktop Mac Safari
  if (/iPhone|iPad|iPod/.test(ua) || (/(Macintosh)/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/Windows|Linux|Macintosh/.test(ua)) return 'desktop'
  return 'other'
}

/**
 * Verificação de permissão 'nfc' via Permissions API.
 * Devolve 'unknown' quando o navegador não expõe o nome de permissão 'nfc'.
 */
export async function queryNfcPermissionState(): Promise<NfcPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions || typeof navigator.permissions.query !== 'function') {
    return 'unknown'
  }
  try {
    const status = await navigator.permissions.query({ name: 'nfc' as PermissionName })
    if (status.state === 'granted') return 'granted'
    if (status.state === 'denied') return 'denied'
    if (status.state === 'prompt') return 'prompt'
    return 'unknown'
  } catch {
    // Alguns navegadores lançam TypeError para nomes de permissão não suportados
    return 'unknown'
  }
}

export function detectNfcCapabilities(permissionState: NfcPermissionState = 'unknown'): NfcCapabilities {
  const apiSupported = isNfcApiSupported()
  const secureContext = isSecureContextForNfc()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const browserEngine = detectEngine(ua)
  const platformHint = detectPlatform(ua)

  // Chromium é o único motor com implementação real de Web NFC;
  // Safari/iOS e Firefox não implementam (estado público da API).
  const browserCompatible =
    apiSupported && secureContext && browserEngine === 'chromium' && platformHint !== 'ios'

  const notes: string[] = []

  if (!apiSupported) {
    notes.push('Este dispositivo ou navegador não oferece suporte à gravação NFC pelo navegador.')
    notes.push('A Web NFC API está atualmente disponível em navegadores baseados em Chromium (ex.: Chrome no Android).')
  }
  if (apiSupported && !secureContext) {
    notes.push('A página precisa de estar em contexto seguro (HTTPS) para o NFC funcionar.')
  }
  if (!browserCompatible) {
    if (platformHint === 'ios') {
      notes.push('iOS/Safari não implementa a Web NFC API — a gravação física não é possível neste dispositivos.')
    } else if (platformHint === 'desktop') {
      notes.push('NFC físico indisponível neste equipamento — em desktop é necessário leitor NFC compatível e navegador baseado em Chromium.')
    } else {
      notes.push('O NFC pode não funcionar neste navegador/sistema operativo.')
    }
  }
  notes.push('O NFC tem de estar ativado nas definições do dispositivo.')
  notes.push('A funcionalidade depende do navegador e do sistema operativo.')
  notes.push('Em desktop sem NFC compatível, a gravação física não pode ser executada — o QR Code continua disponível como alternativa.')

  return {
    apiSupported,
    secureContext,
    browserCompatible,
    hardwareLockSupported: false,
    browserEngine,
    platformHint,
    permissionState,
    notes
  }
}
