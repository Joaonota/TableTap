import type {
  NfcCapabilities,
  NfcOpState,
  NFCReadHandlers,
  NFCVerifyResult,
  NFCWriteHandlers,
  NFCWriteOutcome,
  NfcPermissionState,
  ParsedNfcRead,
  ParsedNfcRecord
} from '@/types'
import { NfcError } from '@/types'
import {
  detectNfcCapabilities,
  isNfcApiSupported,
  isSecureContextForNfc,
  queryNfcPermissionState
} from './nfcCapabilities'
import { translateNfcException } from './nfcErrors'

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
 */

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
        if (record.recordType === 'url') recordUrl = decoded
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

export class RealNfcService {
  private sessionController: AbortController | null = null

  /** Web NFC API disponível neste contexto? */
  isSupported(): boolean {
    return isNfcApiSupported()
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

  /** Pré-condições físicas mínimas (suporte + HTTPS). Devolve erro traduzido ou null. */
  checkPreconditions(): NfcError | null {
    if (!isNfcApiSupported()) {
      return new NfcError(
        'not_supported',
        'Este dispositivo ou navegador não oferece suporte à gravação NFC pelo navegador.'
      )
    }
    if (!isSecureContextForNfc()) {
      return new NfcError(
        'insecure_context',
        'A gravação NFC só é possível numa página segura (HTTPS). Abra o TapMenu em HTTPS.'
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
   * Fluxo (padrão Web NFC):
   *   1. scan()   → ativa a NFC e pede permissão (requer gesto do utilizador);
   *   2. aguardar aproximação → handlers.onWaiting();
   *   3. evento reading → handlers.onTagDetected() + handlers.onWriting();
   *   4. write({ records: [{ recordType: 'url', data }] }, { overwrite: true })
   *      só resolve quando a escrita física termina.
   *
   * Nunca falsifica conclusão: resolve apenas quando o browser confirma a
   * escrita no chip, e rejeita com erro traduzido em qualquer falha.
   */
  async writeNdefUrl(url: string, handlers: NFCWriteHandlers = {}): Promise<NFCWriteOutcome> {
    const pre = this.checkPreconditions()
    if (pre) throw pre
    this.cancelNfcSession()

    const controller = new AbortController()
    this.sessionController = controller
    const detections: ParsedNfcRead[] = []
    let reader: NDEFReader | null = null

    try {
      reader = new NDEFReader()

      reader.onreading = (event: NDEFReadingEvent) => {
        const read = parseNdefMessage(event.message)
        read.serialNumber = event.serialNumber ?? null
        detections.push(read)
        handlers.onTagDetected?.(read)
        handlers.onWriting?.()
      }
      reader.onreadingerror = () => handlers.onReadingError?.()

      // Entre o scan resolvido e o próximo evento reading, o sistema está
      // "Pronto para gravar" — à espera da aproximação da etiqueta.
      handlers.onWaiting?.()
      await reader.scan({ signal: controller.signal })

      // Escrita com overwrite: permite gravar/regravar etiquetas com dados.
      await reader.write(
        { records: [{ recordType: 'url', data: url }] },
        { overwrite: true, signal: controller.signal }
      )

      return {
        url,
        writtenAt: new Date().toISOString(),
        detections
      }
    } catch (e) {
      throw translateNfcException(e)
    } finally {
      if (reader) {
        reader.onreading = null
        reader.onreadingerror = null
      }
      if (this.sessionController === controller) this.sessionController = null
    }
  }

  /**
   * Leitura REAL de uma etiqueta: scan() + evento reading.
   * Resolve com o primeiro conteúdo lido; aborta o scan logo a seguir.
   */
  async readTag(handlers: NFCReadHandlers = {}): Promise<ParsedNfcRead> {
    const pre = this.checkPreconditions()
    if (pre) throw pre
    this.cancelNfcSession()

    const controller = new AbortController()
    this.sessionController = controller
    let reader: NDEFReader | null = null

    try {
      reader = new NDEFReader()
      await reader.scan({ signal: controller.signal })
      handlers.onWaiting?.()

      return await new Promise<ParsedNfcRead>((resolve, reject) => {
        const onAbort = () => reject(new NfcError('cancelled', 'Operação cancelada.'))
        if (controller.signal.aborted) {
          onAbort()
          return
        }
        controller.signal.addEventListener('abort', onAbort, { once: true })

        reader!.onreading = (event: NDEFReadingEvent) => {
          const read = parseNdefMessage(event.message)
          read.serialNumber = event.serialNumber ?? null
          controller.abort()
          resolve(read)
        }
        reader!.onreadingerror = () => {
          controller.abort()
          reject(
            new NfcError(
              'transfer_failed',
              'Não foi possível ler a etiqueta. Aproxime-a novamente de forma firme e mantenha o contacto até ao fim da leitura.'
            )
          )
        }
      })
    } catch (e) {
      throw translateNfcException(e)
    } finally {
      if (reader) {
        reader.onreading = null
        reader.onreadingerror = null
      }
      if (this.sessionController === controller) this.sessionController = null
    }
  }

  /**
   * Verificação REAL: lê a etiqueta e compara o URL encontrado com o esperado.
   * 'verified' só é devolvido quando o conteúdo físico existe e é igual.
   */
  async verifyUrl(expectedUrl: string, handlers: NFCReadHandlers = {}): Promise<NFCVerifyResult> {
    const read = await this.readTag(handlers)
    const foundUrl = read.url
    let status: NFCVerifyResult['status']
    if (foundUrl && foundUrl.trim() === expectedUrl.trim()) {
      status = 'verified'
    } else if (foundUrl) {
      status = 'different'
    } else {
      status = 'no_url'
    }

    return { status, expectedUrl, foundUrl, read }
  }
}

/** Estado UI derivado de um erro NFC normalizado. */
export function stateFromError(error: NfcError): NfcOpState {
  if (error.code === 'cancelled') return 'cancelled'
  if (error.code === 'not_supported' || error.code === 'insecure_context') return 'unsupported'
  return 'failed'
}

/** Instância única usada por toda a aplicação. */
export const nfcService = new RealNfcService()
