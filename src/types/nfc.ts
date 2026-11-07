// ==========================================
// NFC REAL — TYPES & DATA CONTRACTS
// Registo local de etiquetas, histórico e
// estados da operação físico (Web NFC).
// ==========================================

/** Estado do registo local de uma etiqueta. */
export type NfcRecordStatus =
  | 'active'     // gravação real concluída e publicada
  | 'protected'  // protegida no sistema (impede regravação pelo TapMenu)
  | 'failed'     // última tentativa de gravação falhou (nada de utilizável)
  | 'unassigned' // registada no sistema, nunca gravada fisicamente

/**
 * Modelo de dados do registo local de operação NFC.
 *
 * Nota de honestidade de dados:
 *  - `serialNumber` só é preenchido se o browser fornecer o UID físico
 *    (Web NFC nem sempre o disponibiliza). Nunca é inventado.
 *  - `hardwareName` não é fornecido pela Web NFC API — permanece `null`.
 */
export interface NFCTagRecord {
  id: string
  restaurantId: string
  restaurantName: string
  tenantId: string
  tableId: string
  tableNumber: string
  tableArea?: string
  /** URL absoluto que está/será gravado na etiqueta (NDEF URI). */
  url: string
  ndefType: string
  status: NfcRecordStatus
  /** UID/serial físico quando o browser o fornece; caso contrário `null`. */
  serialNumber: string | null
  /** Nome/modelo do chip físico — Web NFC não fornece; permanece `null`. */
  hardwareName: string | null
  /** Proteção aplicada: só o sistema suporta (bloqueio físico não é possível via Web NFC). */
  protection: 'none' | 'system'
  lastWrittenAt?: string
  /** Momento em que uma leitura de retorno confirmou que a etiqueta é legível. */
  lastReadConfirmedAt?: string
  /** Momento em que o conteúdo lido correspondia exatamente ao URL esperado. */
  lastContentValidatedAt?: string
  /** Compatibilidade com versões anteriores: último `lastContentValidatedAt`. */
  lastVerifiedAt?: string
  /** Nível de confiança da última sessão: escrita, leitura ou conteúdo validado. */
  verificationState?: NfcVerificationLevel
  lastVerification?: NFCVerifyStatus | 'unreadable' | 'cancelled' | null
  writeCount: number
  lastOperation?: NfcOperationType
  lastOperationAt?: string
  createdAt: string
  timeline: NfcTimelineEvent[]
}

/** Distinção honesta das três fases de uma gravação NFC. */
export type NfcVerificationLevel = 'written_only' | 'read_confirmed' | 'content_validated'

/** Alias requerido pela convenção do projeto. */
export type NfcTag = NFCTagRecord

export type NfcOperationType =
  | 'write'
  | 'rewrite'
  | 'read'
  | 'verify'
  | 'protect'
  | 'unprotect'
  | 'blocked_attempt'
  | 'cancelled'
  | 'error'

export type NfcTimelineEventType =
  | 'created'
  | 'write_started'
  | 'write_completed'
  | 'write_failed'
  | 'verified'
  | 'verify_failed'
  | 'read'
  | 'protected'
  | 'unprotected'
  | 'write_rejected'
  | 'cancelled'
  | 'error'

export interface NfcTimelineEvent {
  id: string
  tagId: string
  type: NfcTimelineEventType
  title: string
  description: string
  timestamp: string
  actor?: string
}

/** Estados explícitos da operação física para a UI. */
export type NfcOpState =
  | 'idle'
  | 'unsupported'
  | 'insecure_context'
  | 'ready'               // pronto — aguardando aproximação da etiqueta
  | 'tag_detected'
  | 'writing'
  | 'written'
  | 'verifying'
  | 'verified'
  | 'verify_failed'
  | 'failed'
  | 'cancelled'

/** Estados de compatibilidade do dispositivo/navegador. */
export type NfcPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

export interface NfcCapabilities {
  /** `true` quando `NDEFReader` existe no window (API Web NFC presente). */
  apiSupported: boolean
  /** Contexto seguro HTTPS (obrigatório para Web NFC). */
  secureContext: boolean
  /** Heurística honesta: motor Chromium em plataforma compatível (não iOS). */
  browserCompatible: boolean
  /**
   * Bloqueio físico (read-only por hardware) NUNCA é suportado pela Web NFC.
   * Mantido como campo explícito para a UI não prometer o que não existe.
   */
  hardwareLockSupported: boolean
  /** `NDEFReader` existe e expõe `scan()` (leitura NDEF). */
  readApiSupported: boolean
  /** `NDEFReader` existe e expõe `write()` (escrita NDEF). */
  writeApiSupported: boolean
  /**
   * A Web NFC não permite confirmar antecipadamente a presença física de
   * hardware NFC. É sempre `false`/desconhecido até uma operação real.
   */
  physicalHardwareVerified: false
  browserEngine: 'chromium' | 'webkit' | 'gecko' | 'unknown'
  platformHint: 'android' | 'chromeos' | 'desktop' | 'ios' | 'other'
  permissionState: NfcPermissionState
  /** Mensagem única e específica para a configuração detetada. */
  compatibilitySummary: string
  /** Mensagens traduzidas e amigáveis sobre as limitações detetadas. */
  notes: string[]
}

export interface NfcBrowserInfo {
  name: string
  version: string | null
  engine: NfcCapabilities['browserEngine']
  isWebView: boolean
  isInAppBrowser: boolean
}

export interface NfcOsInfo {
  name: string
  version: string | null
}

export interface NfcDeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  /** Modelo só quando o user agent o expõe de forma fiável; nunca inventado. */
  model: string | null
}

export interface NfcApiAvailability {
  ndefReader: boolean
  scan: boolean
  write: boolean
}

/**
 * Relatório de diagnóstico honesto.
 *
 * Distingue explicitamente:
 *  - `webNfcApi`: a API existe no navegador;
 *  - `physicalNfc`: desconhecido — a API não expõe o estado do controlador;
 *  - `readStatus` / `writeStatus`: disponibilidade da API ou resultado testado.
 */
export interface NfcDiagnosticReport {
  generatedAt: string
  browser: NfcBrowserInfo
  os: NfcOsInfo
  device: NfcDeviceInfo
  userAgent: string
  https: boolean
  secureContext: boolean
  webNfcApi: boolean
  api: NfcApiAvailability
  permissionState: NfcPermissionState
  /** A Web NFC não fornece esta informação antes de uma operação real. */
  physicalNfc: 'unknown'
  readStatus: 'available' | 'unavailable' | 'untested'
  writeStatus: 'available' | 'unavailable' | 'untested'
  /** `true` se uma escrita física foi confirmada nesta sessão da aplicação. */
  writeTested: boolean
  operationState: NfcOpState
  lastError: { code: NfcErrorCode; message: string; technical: string } | null
  compatibility: 'full' | 'partial' | 'unsupported'
  compatibilitySummary: string
  limitations: string[]
  recommendations: string[]
}

/** Contrato comum para futuros métodos de gravação. */
export interface NFCWriterAdapter {
  readonly id: 'web-nfc' | 'android-native' | 'external-writer'
  readonly label: string
  /** `false` quando a integração ainda não está implementada nesta versão. */
  readonly implemented: boolean
  isSupported(): boolean
  writeUrl(url: string, handlers?: NFCWriteHandlers, options?: NFCWriteOptions): Promise<NFCWriteOutcome>
  readTag(handlers?: NFCReadHandlers, options?: NFCReadOptions): Promise<ParsedNfcRead>
}

export interface NfcAdapterAvailability {
  id: NFCWriterAdapter['id']
  label: string
  implemented: boolean
  supported: boolean
  note: string
}

/** Um registo NDEF lido da etiqueta, já descodificado e pronto para a UI. */
export interface ParsedNfcRecord {
  recordType: string
  mediaType?: string
  id?: string
  lang?: string
  encoding?: string
  /** URL descodificado quando o registo é do tipo `url`. */
  url: string | null
  /** Texto descodificado quando o registo é do tipo `text`. */
  text: string | null
  /** Bytes úteis do payload (0 se indisponível). */
  payloadBytes: number
}

export interface ParsedNfcRead {
  serialNumber: string | null
  records: ParsedNfcRecord[]
  url: string | null
  text: string | null
  messageKind: 'url' | 'text' | 'unknown'
  readAt: string
}

/** Resultado da verificação de conteúdo após a gravação. */
export type NFCVerifyStatus = 'verified' | 'different' | 'no_url'

export interface NFCVerifyResult {
  status: NFCVerifyStatus
  expectedUrl: string
  foundUrl: string | null
  /** Tipo do registo NDEF que continha o URL (ex.: `url`). */
  foundRecordType: string | null
  read: ParsedNfcRead
}

/** Handlers de progresso para a gravação real (encadeamento de estados). */
export interface NFCWriteHandlers {
  /** Depois de o scan Authorization ok — "Pronto para gravar". */
  onWaiting?: () => void
  /** Evento `reading` durante a sessão de escrita — "Etiqueta detetada". */
  onTagDetected?: (read: ParsedNfcRead) => void
  /** Evento `readingerror`. */
  onReadingError?: () => void
  /** Enquanto a promise de escrita está pendente — "Gravando...". */
  onWriting?: () => void
  /** Escrita concluída fisicamente ("Gravação concluída"). */
  onWritten?: () => void
}

export interface NFCWriteOutcome {
  url: string
  writtenAt: string
  /** Conteúdos lidos da etiqueta durante a sessão de escrita (antes/depois). */
  detections: ParsedNfcRead[]
  /** `true` se o browser emitiu um evento `reading` durante a escrita. */
  tagDetected: boolean
  /** A promise de `write()` resolveu — o browser confirmou a escrita física. */
  writeConfirmedByBrowser: boolean
}

export interface NFCWriteOptions {
  /** Tempo máximo à espera de interação/etiqueta. Default: 90 s. */
  timeoutMs?: number
  /** Sobrescrever conteúdo existente. Default: `true` (regravação explícita). */
  overwrite?: boolean
}

/** Handlers de progresso para a leitura/verificação real. */
export interface NFCReadHandlers {
  onWaiting?: () => void
}

export interface NFCReadOptions {
  /** Tempo máximo à espera de etiqueta. Default: 60 s. */
  timeoutMs?: number
}

/** Erros de NFC já traduzidos para mensagens compreensíveis. */
export type NfcErrorCode =
  | 'not_supported'        // API Web NFC / navegador indisponível
  | 'tag_not_supported'    // etiqueta sem NDEF / tipo não suportado
  | 'insecure_context'
  | 'security_error'
  | 'permission_denied'
  | 'user_activation_required'
  | 'adapter_unavailable'  // sem adaptador/NFC desativado
  | 'adapter_busy'
  | 'read_only_tag'
  | 'transfer_failed'
  | 'invalid_url'
  | 'cancelled'
  | 'invalid_state'
  | 'timeout'
  | 'unknown'

export interface NfcErrorOptions {
  /** Ação recomendada ao utilizador (nunca detalhe técnico em bruto). */
  hint?: string
  /** Se faz sentido tentar novamente sem alterar hardware/etiqueta. */
  retryable?: boolean
}

/** Erro de NFC normalizado — nunca exibir `DOMException` em bruto na UI. */
export class NfcError extends Error {
  readonly code: NfcErrorCode
  /** Detalhe técnico original (exibido só em diagnóstico/details). */
  readonly technical: string
  readonly hint: string | null
  readonly retryable: boolean

  constructor(code: NfcErrorCode, message: string, technical?: string, options: NfcErrorOptions = {}) {
    super(message)
    this.name = 'NfcError'
    this.code = code
    this.technical = technical || `${code}`
    this.hint = options.hint ?? null
    this.retryable = options.retryable ?? true
  }
}
