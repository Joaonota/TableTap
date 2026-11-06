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
  lastVerifiedAt?: string
  writeCount: number
  lastOperation?: NfcOperationType
  lastOperationAt?: string
  createdAt: string
  timeline: NfcTimelineEvent[]
}

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
  browserEngine: 'chromium' | 'webkit' | 'gecko' | 'unknown'
  platformHint: 'android' | 'chromeos' | 'desktop' | 'ios' | 'other'
  permissionState: NfcPermissionState
  /** Mensagens traduzidas e amigáveis sobre as limitações detetadas. */
  notes: string[]
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
}

/** Handlers de progresso para a leitura/verificação real. */
export interface NFCReadHandlers {
  onWaiting?: () => void
}

/** Erros de NFC já traduzidos para mensagens compreensíveis. */
export type NfcErrorCode =
  | 'not_supported'
  | 'insecure_context'
  | 'permission_denied'
  | 'adapter_unavailable'
  | 'adapter_busy'
  | 'read_only_tag'
  | 'transfer_failed'
  | 'cancelled'
  | 'invalid_state'
  | 'unknown'

/** Erro de NFC normalizado — nunca exibir `DOMException` em bruto na UI. */
export class NfcError extends Error {
  readonly code: NfcErrorCode
  /** Detalhe técnico original (exibido só em diagnóstico/details). */
  readonly technical: string

  constructor(code: NfcErrorCode, message: string, technical?: string) {
    super(message)
    this.name = 'NfcError'
    this.code = code
    this.technical = technical || `${code}`
  }
}
