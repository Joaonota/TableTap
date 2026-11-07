import type {
  NfcCapabilities,
  NfcDiagnosticReport,
  NfcErrorCode,
  NfcOpState,
  NFCReadHandlers,
  NFCReadOptions,
  NFCVerifyResult,
  NFCWriteHandlers,
  NFCWriteOptions,
  NFCWriteOutcome,
  NfcPermissionState,
  NFCWriterAdapter,
  ParsedNfcRead,
  ParsedNfcRecord
} from '@/types'
import { NfcError } from '@/types'
import {
  buildNfcDiagnosticReport,
  detectNfcCapabilities,
  isNfcApiSupported,
  isNfcReadApiSupported,
  isNfcWriteApiSupported,
  isSecureContextForNfc,
  queryNfcPermissionState
} from './nfcCapabilities'
import { translateNfcException } from './nfcErrors'
import { normalizeMenuUrl, validateNfcUrl } from './nfcUrl'

/**
 * NFCService — wrapper sobre a Web NFC API nativa (NDEFReader).
 *
 * Responsabilidades:
 *  - detetar suporte e capacidades reais;
 *  - escrever registos NDEF tipo URL em etiquetas físicas;
 *  - ler etiquetas e verificar conteúdos reais;
 *  - traduzir erros para mensagens compreensíveis;
 *  - cancelar operações em curso e expor estados para a UI.
 *
 * TODOS os componentes passam por este serviço — nenhum `NDEFReader`
 * direto fora de src/services/nfc/.
 *
 * A escrita usa apenas `NDEFReader.write()` (o próprio método ativa a NFC e
 * espera pela etiqueta). Não se chama `scan()` antes: sobrepor uma sessão de
 * leitura à escrita não é necessário e pode originar erros/estados ambíguos.
 */

const DEFAULT_WRITE_TIMEOUT_MS = 90_000
const DEFAULT_READ_TIMEOUT_MS = 60_000

/** Descodifica uma mensagem NDEF. A tag é tratada como dado externo — nunca é executado. */
function parseNdefMessage(message: NDEFMessage): ParsedNfcRead {
  const records: ParsedNfcRecord[] = []
  let url: string | null = null
  let text: string | null = null

  for (const record of Array.from(message?.records ?? [])) {
    let recordUrl: string | null = null
    let recordText: string | null = null
    const data = record.data ?? null
    let payloadBytes = 0

    if (data instanceof DataView) {
      payloadBytes = data.byteLength
      try {
        const decoded = new TextDecoder().decode(data)
        if (record.recordType === 'url' || record.recordType === 'absolute-url') recordUrl = decoded
        else if (record.recordType === 'text') recordText = decoded
      } catch {
        // Payload não descodificável — ignorado com segurança
      }
    }

    if (recordUrl && !url) url = recordUrl
    if (recordText && !text) text = recordText

    records.push({
      recordType: record.recordType,
      mediaType: record.mediaType,
      id: record.id,
      lang: record.lang,
      encoding: record.encoding,
      url: recordUrl,
      text: recordText,
      payloadBytes
    })
  }

  let messageKind: 'url' | 'text' | 'unknown' = 'unknown'
  if (url) messageKind = 'url'
  else if (text) messageKind = 'text'

  return { serialNumber: null, records, url, text, messageKind, readAt: new Date().toISOString() }
}

export class RealNfcService implements NFCWriterAdapter {
  readonly id = 'web-nfc' as const
  readonly label = 'Web NFC (NDEFReader do navegador)'
  readonly implemented = true

  private sessionController: AbortController | null = null
  private lastSuccessfulWriteAt: string | null = null

  /** Web NFC API disponível neste contexto? */
  isSupported(): boolean {
    return isNfcApiSupported()
  }

  /** A API expõe leitura NDEF (`scan()`)? */
  isReadSupported(): boolean {
    return isNfcReadApiSupported()
  }

  /** A API expõe escrita NDEF (`write()`)? */
  isWriteSupported(): boolean {
    return isNfcWriteApiSupported()
  }

  /** Contexto seguro (HTTPS)? */
  isSecureContext(): boolean {
    return isSecureContextForNfc()
  }

  /** Capacidades calculadas de forma honesta (sem inventar suporte). */
  getCapabilities(permissionState: NfcPermissionState = 'unknown'): NfcCapabilities {
    return detectNfcCapabilities(permissionState)
  }

  /** Estado da permissão 'nfc' via Permissions API, quando o browser expõe. */
  async getPermissionState(): Promise<NfcPermissionState> {
    return queryNfcPermissionState()
  }

  /** Relatório de diagnóstico (apenas inspeção — não lê nem grava). */
  async getDiagnosticReport(
    operationState: NfcOpState = 'idle',
    lastError: NfcError | null = null
  ): Promise<NfcDiagnosticReport> {
    const permission = await queryNfcPermissionState()
    return buildNfcDiagnosticReport(
      permission,
      operationState,
      lastError,
      this.lastSuccessfulWriteAt !== null
    )
  }

  /** Hora da última escrita física confirmada nesta sessão (ou null). */
  getLastSuccessfulWriteAt(): string | null {
    return this.lastSuccessfulWriteAt
  }

  /** Pré-condições físicas mínimas (suporte + escrita + HTTPS). Devolve erro traduzido ou null. */
  checkPreconditions(): NfcError | null {
    if (!isNfcApiSupported()) {
      return new NfcError(
        'not_supported',
        'Este dispositivo ou navegador não oferece suporte à gravação NFC pelo navegador.',
        undefined,
        {
          hint: 'A Web NFC existe em navegadores Chromium no Android/ChromeOS, sobre HTTPS. Em iPhone, use um Android compatível ou uma ferramenta externa.',
          retryable: false
        }
      )
    }
    if (!isSecureContextForNfc()) {
      return new NfcError(
        'insecure_context',
        'A gravação NFC só é possível numa página segura (HTTPS). Abra o TapMenu em HTTPS.',
        undefined,
        { retryable: false }
      )
    }
    if (!isNfcWriteApiSupported()) {
      return new NfcError(
        'not_supported',
        'A API NFC existe, mas este navegador não disponibiliza a operação de escrita NDEF.',
        undefined,
        { hint: 'Atualize o navegador ou use outro navegador Chromium compatível.', retryable: false }
      )
    }
    return null
  }

  /** Pré-condições para leitura/verificação (não exige escrita). */
  checkReadPreconditions(): NfcError | null {
    if (!isNfcApiSupported()) {
      return new NfcError(
        'not_supported',
        'Este dispositivo ou navegador não disponibiliza a Web NFC API para leitura de etiquetas.',
        undefined,
        { retryable: false }
      )
    }
    if (!isSecureContextForNfc()) {
      return new NfcError(
        'insecure_context',
        'A leitura NFC só é possível numa página segura (HTTPS). Abra o TapMenu em HTTPS.',
        undefined,
        { retryable: false }
      )
    }
    if (!isNfcReadApiSupported()) {
      return new NfcError(
        'not_supported',
        'A API NFC existe, mas este navegador não disponibiliza a operação de leitura NDEF.',
        undefined,
        { retryable: false }
      )
    }
    return null
  }

  /** Aborta a sessão física em curso (escrita, leitura ou verificação). */
  cancelNfcSession(): void {
    this.sessionController?.abort()
    this.sessionController = null
  }

  /**
   * Gravação REAL de um registo NDEF URL numa etiqueta física.
   *
   * Fluxo:
   *   1. valida URL, suporte e HTTPS;
   *   2. cria NDEFReader e chama `write()` — o browser pede permissão,
   *      ativa a NFC e aguarda a aproximação da etiqueta;
   *   3. `onreading` (quando emitido) reporta a deteção física;
   *   4. a promise resolve apenas quando a escrita física termina.
   *
   * Não há tentativas automáticas. Nunca falsifica conclusão.
   */
  async writeUrl(
    url: string,
    handlers: NFCWriteHandlers = {},
    options: NFCWriteOptions = {}
  ): Promise<NFCWriteOutcome> {
    const pre = this.checkPreconditions()
    if (pre) throw pre

    const validation = validateNfcUrl(url)
    if (!validation.valid) {
      throw new NfcError(
        'invalid_url',
        validation.reason || 'O URL a gravar não é válido.',
        `InvalidUrl: ${url}`,
        { retryable: false }
      )
    }

    this.cancelNfcSession()

    const controller = new AbortController()
    this.sessionController = controller
    const detections: ParsedNfcRead[] = []
    let reader: NDEFReader | null = null
    let timedOut = false

    const timeoutMs = options.timeoutMs ?? DEFAULT_WRITE_TIMEOUT_MS
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      reader = new NDEFReader()

      // O evento reading é emitido pelo Chrome quando a etiqueta é apresentada.
      // É progresso informativo — não substitui a confirmação de `write()`.
      reader.onreading = (event: NDEFReadingEvent) => {
        const read = parseNdefMessage(event.message)
        read.serialNumber = event.serialNumber ?? null
        detections.push(read)
        handlers.onTagDetected?.(read)
        handlers.onWriting?.()
      }
      reader.onreadingerror = () => handlers.onReadingError?.()

      handlers.onWaiting?.()

      // Escrita direta (sem scan prévio). `overwrite: true` permite regravar
      // etiquetas já formatadas; continua a falhar honestamente se não houver
      // NDEF, se estiver bloqueada ou se o adaptador não suportar escrita.
      await reader.write(
        { records: [{ recordType: 'url', data: url }] },
        { overwrite: options.overwrite !== false, signal: controller.signal }
      )

      const writtenAt = new Date().toISOString()
      this.lastSuccessfulWriteAt = writtenAt
      handlers.onWritten?.()

      return {
        url,
        writtenAt,
        detections,
        tagDetected: detections.length > 0,
        writeConfirmedByBrowser: true
      }
    } catch (e) {
      if (timedOut) {
        throw new NfcError(
          'timeout',
          'Tempo esgotado à espera de uma etiqueta compatível. Aproxime a etiqueta e tente novamente.',
          translateNfcException(e).technical,
          { retryable: true }
        )
      }
      throw translateNfcException(e, { phase: 'write' })
    } finally {
      window.clearTimeout(timeoutId)
      if (reader) {
        reader.onreading = null
        reader.onreadingerror = null
      }
      if (this.sessionController === controller) this.sessionController = null
    }
  }

  /** Alias retrocompatível de `writeUrl`. */
  writeNdefUrl(
    url: string,
    handlers: NFCWriteHandlers = {},
    options: NFCWriteOptions = {}
  ): Promise<NFCWriteOutcome> {
    return this.writeUrl(url, handlers, options)
  }

  /**
   * Leitura REAL de uma etiqueta: `scan()` + evento reading.
   * Resolve com o primeiro conteúdo lido; aborta o scan logo a seguir.
   */
  async readTag(handlers: NFCReadHandlers = {}, options: NFCReadOptions = {}): Promise<ParsedNfcRead> {
    const pre = this.checkReadPreconditions()
    if (pre) throw pre
    this.cancelNfcSession()

    const controller = new AbortController()
    this.sessionController = controller
    const timeoutMs = options.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS
    let timedOut = false
    let reader: NDEFReader | null = null

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      reader = new NDEFReader()
      await reader.scan({ signal: controller.signal })
      handlers.onWaiting?.()

      return await new Promise<ParsedNfcRead>((resolve, reject) => {
        const onAbort = () => {
          reject(
            timedOut
              ? new NfcError('timeout', 'Tempo esgotado à espera da etiqueta. Tente novamente.', 'TimeoutError: read timeout', { retryable: true })
              : new NfcError('cancelled', 'Operação cancelada.', 'AbortError: session aborted', { retryable: true })
          )
        }
        if (controller.signal.aborted) {
          onAbort()
          return
        }
        controller.signal.addEventListener('abort', onAbort, { once: true })

        reader!.onreading = (event: NDEFReadingEvent) => {
          // Remover o listener antes de abortar para não rejeitar a promise
          // já resolvida (o abort também é usado para parar o scan).
          controller.signal.removeEventListener('abort', onAbort)
          const read = parseNdefMessage(event.message)
          read.serialNumber = event.serialNumber ?? null
          controller.abort()
          resolve(read)
        }
        reader!.onreadingerror = () => {
          controller.signal.removeEventListener('abort', onAbort)
          controller.abort()
          reject(
            new NfcError(
              'transfer_failed',
              'Não foi possível ler a etiqueta. Aproxime-a novamente de forma firme e mantenha o contacto até ao fim da leitura.',
              'ReadingError: tag unreadable',
              { retryable: true }
            )
          )
        }
      })
    } catch (e) {
      if (timedOut) {
        throw new NfcError(
          'timeout',
          'Tempo esgotado à espera da etiqueta. Tente novamente.',
          translateNfcException(e).technical,
          { retryable: true }
        )
      }
      throw translateNfcException(e, { phase: 'read' })
    } finally {
      window.clearTimeout(timeoutId)
      if (reader) {
        reader.onreading = null
        reader.onreadingerror = null
      }
      if (this.sessionController === controller) this.sessionController = null
    }
  }

  /**
   * Verificação REAL: lê a etiqueta e compara o URL encontrado com o esperado.
   * 'verified' só é devolvido quando o conteúdo físico existe, é um registo
   * URL e é igual (após normalização) ao esperado.
   */
  async verifyUrl(expectedUrl: string, handlers: NFCReadHandlers = {}): Promise<NFCVerifyResult> {
    const read = await this.readTag(handlers)
    const foundRecord = read.records.find(
      r => (r.recordType === 'url' || r.recordType === 'absolute-url') && !!r.url
    )
    const foundUrl = foundRecord?.url ?? read.url
    const expected = normalizeMenuUrl(expectedUrl)
    const found = foundUrl ? normalizeMenuUrl(foundUrl) : null

    let status: NFCVerifyResult['status']
    if (found && found === expected) {
      status = 'verified'
    } else if (found) {
      status = 'different'
    } else {
      status = 'no_url'
    }

    return {
      status,
      expectedUrl,
      foundUrl,
      foundRecordType: foundRecord?.recordType ?? null,
      read
    }
  }
}

/** Estado UI derivado de um erro NFC normalizado. */
export function stateFromError(error: NfcError): NfcOpState {
  if (error.code === 'cancelled') return 'cancelled'
  if (error.code === 'not_supported' || error.code === 'insecure_context') return 'unsupported'
  return 'failed'
}

/** Códigos que indicam incompatibilidade da etiqueta (não defeito comprovado). */
export const TAG_COMPATIBILITY_ERROR_CODES: NfcErrorCode[] = [
  'tag_not_supported',
  'read_only_tag'
]

/** Instância única usada por toda a aplicação. */
export const nfcService = new RealNfcService()
