import type {
  NfcApiAvailability,
  NfcBrowserInfo,
  NfcCapabilities,
  NfcDeviceInfo,
  NfcDiagnosticReport,
  NfcError,
  NfcOpState,
  NfcOsInfo,
  NfcPermissionState
} from '@/types'

/**
 * Deteção REAL de capacidades Web NFC.
 *
 * Princípios:
 *  - Nunca inventar suporte: só afirma o que a API/heurística realmente mostra.
 *  - A existência de `NDEFReader` prova apenas que a API está exposta — NÃO
 *    prova que exista hardware NFC, que o NFC esteja ligado, nem que a escrita
 *    funcione. Isso só se confirma com uma operação física.
 *  - `hardwareLockSupported` é sempre `false` — a Web NFC API não expõe o
 *    bloqueio físico (read-only por hardware) das etiquetas.
 */

type NdefReaderConstructor = {
  new (): NDEFReader
  prototype?: { scan?: unknown; write?: unknown }
}

function getNdefReader(): NdefReaderConstructor | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as unknown as { NDEFReader?: unknown }).NDEFReader
  return typeof ctor === 'function' ? (ctor as NdefReaderConstructor) : null
}

export function isNfcApiSupported(): boolean {
  return getNdefReader() !== null
}

export function isNfcReadApiSupported(): boolean {
  const ctor = getNdefReader()
  return !!ctor && typeof ctor.prototype?.scan === 'function'
}

export function isNfcWriteApiSupported(): boolean {
  const ctor = getNdefReader()
  return !!ctor && typeof ctor.prototype?.write === 'function'
}

export function isSecureContextForNfc(): boolean {
  if (typeof window === 'undefined') return false
  return window.isSecureContext === true
}

function safeUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
}

function matchVersion(ua: string, pattern: RegExp): string | null {
  const m = ua.match(pattern)
  return m?.[1] ? m[1].replace(/_/g, '.') : null
}

function isIosPlatform(ua: string): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true
  return (
    /Macintosh/.test(ua)
    && typeof navigator !== 'undefined'
    && navigator.maxTouchPoints > 1
  )
}

export function detectBrowserInfo(ua: string = safeUserAgent()): NfcBrowserInfo {
  const webView =
    /;\s*wv\)/.test(ua)
    || /WebView/i.test(ua)
    || /FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger/i.test(ua)
  const inApp = webView || /FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger/i.test(ua)

  // iOS usa sempre WebKit, independentemente da marca do browser.
  if (isIosPlatform(ua)) {
    if (/CriOS\//.test(ua)) {
      return { name: 'Chrome (iOS)', version: matchVersion(ua, /CriOS\/([\d.]+)/), engine: 'webkit', isWebView: false, isInAppBrowser: inApp }
    }
    if (/FxiOS\//.test(ua)) {
      return { name: 'Firefox (iOS)', version: matchVersion(ua, /FxiOS\/([\d.]+)/), engine: 'webkit', isWebView: false, isInAppBrowser: inApp }
    }
    if (/EdgiOS\//.test(ua)) {
      return { name: 'Edge (iOS)', version: matchVersion(ua, /EdgiOS\/([\d.]+)/), engine: 'webkit', isWebView: false, isInAppBrowser: inApp }
    }
    if (/OPiOS\/|OPR\//.test(ua)) {
      return { name: 'Opera (iOS)', version: matchVersion(ua, /(?:OPiOS|OPR)\/([\d.]+)/), engine: 'webkit', isWebView: false, isInAppBrowser: inApp }
    }
    return { name: 'Safari (iOS)', version: matchVersion(ua, /Version\/([\d.]+)/), engine: 'webkit', isWebView: false, isInAppBrowser: inApp }
  }

  if (/SamsungBrowser\//.test(ua)) {
    return { name: 'Samsung Internet', version: matchVersion(ua, /SamsungBrowser\/([\d.]+)/), engine: 'chromium', isWebView: webView, isInAppBrowser: inApp }
  }
  if (/OPR\//.test(ua) || /Opera\//.test(ua)) {
    return { name: 'Opera', version: matchVersion(ua, /(?:OPR|Opera)\/([\d.]+)/), engine: 'chromium', isWebView: webView, isInAppBrowser: inApp }
  }
  if (/EdgA?\//.test(ua)) {
    return { name: 'Microsoft Edge', version: matchVersion(ua, /EdgA?\/([\d.]+)/), engine: 'chromium', isWebView: webView, isInAppBrowser: inApp }
  }
  if (/Android/.test(ua) && /Chrome\//.test(ua)) {
    return {
      name: webView ? 'Android WebView (Chromium)' : 'Chrome (Android)',
      version: matchVersion(ua, /Chrome\/([\d.]+)/),
      engine: 'chromium',
      isWebView: webView,
      isInAppBrowser: inApp
    }
  }
  if (/Firefox\//.test(ua)) {
    return { name: 'Firefox', version: matchVersion(ua, /Firefox\/([\d.]+)/), engine: 'gecko', isWebView: false, isInAppBrowser: inApp }
  }
  if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) {
    return { name: 'Chromium', version: matchVersion(ua, /(?:Chrome|Chromium)\/([\d.]+)/), engine: 'chromium', isWebView: webView, isInAppBrowser: inApp }
  }
  if (/Safari\//.test(ua)) {
    return { name: 'Safari', version: matchVersion(ua, /Version\/([\d.]+)/), engine: 'webkit', isWebView: false, isInAppBrowser: inApp }
  }
  return { name: 'Desconhecido', version: null, engine: 'unknown', isWebView: webView, isInAppBrowser: inApp }
}

export function detectOsInfo(ua: string = safeUserAgent()): NfcOsInfo {
  if (/Android/.test(ua)) return { name: 'Android', version: matchVersion(ua, /Android\s+([\d.]+)/) }
  if (isIosPlatform(ua)) {
    const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
    return { name: isIpad ? 'iPadOS' : 'iOS', version: matchVersion(ua, /OS\s+([\d_]+)/) }
  }
  if (/CrOS/.test(ua)) return { name: 'ChromeOS', version: matchVersion(ua, /CrOS\s+\S+\s+([\d.]+)/) }
  if (/Windows NT 10\.0/.test(ua)) return { name: 'Windows', version: '10/11' }
  if (/Windows NT/.test(ua)) return { name: 'Windows', version: matchVersion(ua, /Windows NT\s+([\d.]+)/) }
  if (/Mac OS X/.test(ua)) return { name: 'macOS', version: matchVersion(ua, /Mac OS X\s+([\d_]+)/) }
  if (/Linux/.test(ua)) return { name: 'Linux', version: null }
  return { name: 'Desconhecido', version: null }
}

export function detectDeviceInfo(ua: string = safeUserAgent()): NfcDeviceInfo {
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(ua)
  const isPhone = /iPhone|iPod/.test(ua) || (isAndroid && /Mobile/.test(ua))

  let type: NfcDeviceInfo['type'] = 'desktop'
  if (isIpad || (isAndroid && !/Mobile/.test(ua))) type = 'tablet'
  else if (isPhone) type = 'mobile'
  else if (!/Windows|Macintosh|Linux|CrOS/.test(ua)) type = 'unknown'

  let model: string | null = null
  const modelMatch = ua.match(/Android[^;]*;\s*([^;)]+?)\s+Build\//i)
  if (modelMatch?.[1] && !/^wv$/i.test(modelMatch[1]) && modelMatch[1].length <= 40) {
    model = modelMatch[1].trim()
  }

  return { type, model }
}

function detectPlatform(ua: string): NfcCapabilities['platformHint'] {
  if (/Android/.test(ua)) return 'android'
  if (/CrOS/.test(ua)) return 'chromeos'
  if (isIosPlatform(ua)) return 'ios'
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

/**
 * Mensagem específica por configuração — distingue hardware de suporte da API.
 */
export function getCompatibilitySummary(caps: NfcCapabilities): string {
  if (caps.platformHint === 'ios') {
    return 'A gravação NFC diretamente pelo navegador não está disponível nesta configuração. Utilize um dispositivo Android compatível ou uma ferramenta externa de gravação.'
  }
  if (caps.browserEngine === 'webkit') {
    return 'O navegador atual (WebKit/Safari) não disponibiliza a Web NFC API. A gravação NFC pelo navegador não está disponível.'
  }
  if (caps.browserEngine === 'gecko') {
    return 'O Firefox não disponibiliza a Web NFC API. A gravação NFC pelo navegador não está disponível.'
  }
  if (!caps.apiSupported) {
    if (caps.platformHint === 'desktop') {
      return 'A gravação NFC pelo navegador não está disponível neste equipamento. Use um dispositivo Android compatível ou uma ferramenta externa de gravação.'
    }
    if (caps.platformHint === 'android') {
      return 'O dispositivo pode possuir NFC, mas o navegador atual não disponibiliza a API necessária. Abra o TapMenu no Chrome, Edge ou Samsung Internet sobre HTTPS.'
    }
    return 'Este navegador ou sistema operativo não disponibiliza a Web NFC API.'
  }
  if (!caps.secureContext) {
    return 'A página precisa de estar em contexto seguro (HTTPS) para o NFC funcionar.'
  }
  if (!caps.writeApiSupported) {
    return 'A API NFC existe, mas este navegador não expõe a operação de escrita NDEF.'
  }
  return 'Este navegador permite operações NFC. Pode iniciar a gravação.'
}

export function detectNfcCapabilities(permissionState: NfcPermissionState = 'unknown'): NfcCapabilities {
  const apiSupported = isNfcApiSupported()
  const readApiSupported = isNfcReadApiSupported()
  const writeApiSupported = isNfcWriteApiSupported()
  const secureContext = isSecureContextForNfc()
  const ua = safeUserAgent()
  const browserEngine = detectBrowserInfo(ua).engine
  const platformHint = detectPlatform(ua)

  // Chromium é o único motor com implementação real de Web NFC;
  // Safari/iOS e Firefox não implementam (estado público da API).
  const browserCompatible =
    apiSupported && secureContext && browserEngine === 'chromium' && platformHint !== 'ios'

  const notes: string[] = []

  if (!apiSupported) {
    notes.push('Este dispositivo ou navegador não oferece suporte à gravação NFC pelo navegador.')
    notes.push('A Web NFC API está atualmente disponível em navegadores baseados em Chromium (Chrome/Edge/Samsung Internet) no Android e em ChromeOS.')
  }
  if (apiSupported && !secureContext) {
    notes.push('A página precisa de estar em contexto seguro (HTTPS) para o NFC funcionar.')
  }
  if (apiSupported && !writeApiSupported) {
    notes.push('A API NFC está exposta, mas a escrita NDEF não está disponível neste navegador.')
  }
  if (!browserCompatible) {
    if (platformHint === 'ios') {
      notes.push('iOS/Safari não implementa a Web NFC API — a gravação física não é possível neste dispositivo.')
    } else if (platformHint === 'desktop') {
      notes.push('Em desktop, a Web NFC não está normalmente disponível. Use um telemóvel Android compatível ou uma ferramenta externa de gravação.')
    } else if (platformHint === 'android') {
      notes.push('O NFC pode existir no telefone, mas o navegador atual pode não expor a API. Abra num navegador Chromium compatível.')
    } else {
      notes.push('O NFC pode não funcionar neste navegador/sistema operativo.')
    }
  }
  notes.push('A Web NFC API não permite confirmar antecipadamente se existe hardware NFC nem se está ligado — só uma operação real o confirma.')
  notes.push('O NFC tem de estar ativado nas definições do dispositivo.')
  notes.push('A etiqueta tem de estar formatada em NDEF e ser gravável (ex.: NTAG213/215/216).')
  notes.push('Em desktop sem NFC compatível, a gravação física não pode ser executada — o QR Code continua disponível como alternativa.')

  const base: NfcCapabilities = {
    apiSupported,
    secureContext,
    browserCompatible,
    hardwareLockSupported: false,
    readApiSupported,
    writeApiSupported,
    physicalHardwareVerified: false,
    browserEngine,
    platformHint,
    permissionState,
    compatibilitySummary: '',
    notes
  }
  base.compatibilitySummary = getCompatibilitySummary(base)
  return base
}

/**
 * Constrói o relatório visual de diagnóstico.
 * Não executa qualquer leitura/escrita — apenas inspeciona o ambiente e os
 * resultados de operações já realizadas (fornecidos pelo chamador).
 */
export function buildNfcDiagnosticReport(
  permissionState: NfcPermissionState,
  operationState: NfcOpState,
  lastError: NfcError | null,
  writeTested: boolean
): NfcDiagnosticReport {
  const ua = safeUserAgent()
  const browser = detectBrowserInfo(ua)
  const os = detectOsInfo(ua)
  const device = detectDeviceInfo(ua)
  const caps = detectNfcCapabilities(permissionState)

  const api: NfcApiAvailability = {
    ndefReader: caps.apiSupported,
    scan: caps.readApiSupported,
    write: caps.writeApiSupported
  }

  const limitations: string[] = []
  const recommendations: string[] = []

  if (caps.platformHint === 'ios') {
    limitations.push('iOS/Safari (e todos os browsers no iOS) não expõem a Web NFC API.')
    recommendations.push('Use um telemóvel Android com Chrome/Edge/Samsung Internet, ou grave o URL com uma aplicação externa de NFC (ex.: NFC Tools).')
  }
  if (browser.isWebView || browser.isInAppBrowser) {
    limitations.push('Browsers embutidos em aplicações (WebView) normalmente não expõem a Web NFC API.')
    recommendations.push('Abra o TapMenu diretamente no Chrome, Edge ou Samsung Internet.')
  }
  if (!caps.apiSupported) {
    limitations.push('A Web NFC API (NDEFReader) não está disponível neste navegador.')
    if (caps.platformHint === 'desktop') {
      limitations.push('A Web NFC não é suportada em desktop; não confirma nem nega a existência de hardware NFC.')
      recommendations.push('Use um dispositivo Android compatível ou uma ferramenta externa de gravação NFC.')
    } else if (caps.platformHint === 'android') {
      recommendations.push('Instale/abra num navegador baseado em Chromium e confirme que o NFC está ligado nas definições do telefone.')
    } else {
      recommendations.push('Use um dispositivo Android compatível ou uma ferramenta externa de gravação NFC.')
    }
  }
  if (caps.apiSupported && !caps.secureContext) {
    limitations.push('A página não está em contexto seguro (HTTPS).')
    recommendations.push('Abra o TapMenu num endereço HTTPS.')
  }
  if (caps.apiSupported && !caps.writeApiSupported) {
    limitations.push('A escrita NDEF não está exposta por este navegador.')
    recommendations.push('Atualize o navegador ou use outro navegador Chromium compatível.')
  }
  if (caps.permissionState === 'denied') {
    limitations.push('A permissão NFC foi recusada para este site.')
    recommendations.push('Autorize o acesso NFC nas permissões do site/browser e tente novamente.')
  }

  limitations.push('A existência de NDEFReader não prova que o hardware NFC exista ou esteja ligado.')
  limitations.push('A Web NFC não expõe o modelo do chip nem o estado físico da etiqueta.')
  limitations.push('Etiquetas não formatadas em NDEF, MIFARE Classic ou protegidas contra escrita não podem ser gravadas via Web NFC.')
  limitations.push('Bloqueio físico permanente (read-only por hardware) não é suportado pela Web NFC.')
  recommendations.push('Use etiquetas NFC Forum Type 2 graváveis (NTAG213/215/216) formatadas em NDEF.')
  recommendations.push('Mantenha a etiqueta encostada até a operação terminar e evite retirá-la durante a escrita.')
  if (caps.browserCompatible) {
    recommendations.push('A compatibilidade da API está OK. A escrita só é confirmada ao executar uma gravação real com uma etiqueta compatível.')
  }

  let compatibility: NfcDiagnosticReport['compatibility'] = 'full'
  if (!caps.apiSupported) compatibility = 'unsupported'
  else if (!caps.secureContext || !caps.writeApiSupported || !caps.browserCompatible) compatibility = 'partial'

  return {
    generatedAt: new Date().toISOString(),
    browser,
    os,
    device,
    userAgent: ua,
    https: typeof window !== 'undefined' && window.location?.protocol === 'https:',
    secureContext: caps.secureContext,
    webNfcApi: caps.apiSupported,
    api,
    permissionState: caps.permissionState,
    physicalNfc: 'unknown',
    readStatus: caps.readApiSupported ? 'available' : 'unavailable',
    writeStatus: caps.writeApiSupported ? 'available' : 'unavailable',
    writeTested,
    operationState,
    lastError: lastError
      ? { code: lastError.code, message: lastError.message, technical: lastError.technical }
      : null,
    compatibility,
    compatibilitySummary: caps.compatibilitySummary,
    limitations,
    recommendations
  }
}
