import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  NfcTag,
  NfcTimelineEvent,
  NfcTimelineEventType,
  NfcOperationType,
  NFCWriteOutcome,
  ParsedNfcRead
} from '@/types'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'
import { normalizeMenuUrl } from '@/services/nfc/nfcUrl'

/**
 * Registo local REAL de etiquetas NFC (persistido em localStorage).
 *
 * Diferenças face à versão anterior (simulada):
 *  - Nada de UIDs inventados — `serialNumber` só é preenchido se o browser
 *    fornecer o identificador físico (Web NFC nem sempre o fornece).
 *  - Nada de gravações/pretenções físicas falsas — os registos da linha
 *    temporal refletem apenas operações que aconteceram de facto.
 *  - Proteção é LÓGICA (no sistema). A Web NFC API não permite bloqueio
 *    físico por hardware — a UI indica-o explicitamente.
 */

const REGISTRY_KEY = 'tapmenu_nfc_registry_v2'
const LEGACY_KEY = 'tapmenu_nfc_tags_store_v1'

const NDEF_URI_TYPE = 'NDEF URI (Well-Known RTD)'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function isStatus(value: unknown): value is NfcTag['status'] {
  return value === 'active' || value === 'protected' || value === 'failed' || value === 'unassigned'
}

export interface EnsureNfcRecordParams {
  tenantId: string
  restaurantId: string
  restaurantName: string
  tableId: string
  tableNumber: string
  tableArea?: string
  url: string
  actor?: string
}

export interface RegisterWriteParams {
  record: NfcTag
  outcome: NFCWriteOutcome
  /**
   * Resultado real da verificação:
   *  - 'verified': etiqueta relida e URL igual ao esperado;
   *  - 'different' | 'no_url' | 'unreadable' | 'cancelled': gravação real
   *    aconteceu mas o conteúdo gravado não foi confirmado/aprovado.
   */
  verification: 'verified' | 'different' | 'no_url' | 'unreadable' | 'cancelled'
  foundUrl?: string | null
  actor?: string
}

export const useNfcStore = defineStore('nfc', () => {
  const authStore = useAuthStore()
  const toastStore = useToastStore()

  const records = ref<NfcTag[]>([])
  const isLoaded = ref(false)

  const currentActor = (): string => authStore.currentUser?.name || 'Operador TapMenu'

  // ---------- Persistência local ----------
  const persist = () => {
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(records.value))
    } catch (e) {
      console.error('Erro ao guardar o registo NFC', e)
    }
  }

  const loadRegistry = () => {
    try {
      // Limpa dados da versão simulada anterior (UIDs/timelines fictícios)
      localStorage.removeItem(LEGACY_KEY)

      const raw = localStorage.getItem(REGISTRY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          records.value = parsed.filter(
            (r): r is NfcTag =>
              r &&
              typeof r.id === 'string' &&
              typeof r.restaurantId === 'string' &&
              typeof r.tableId === 'string' &&
              typeof r.url === 'string' &&
              isStatus(r.status) &&
              Array.isArray(r.timeline)
          )
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar o registo NFC', e)
      records.value = []
    }
    isLoaded.value = true
  }

  const resetLocalRegistry = () => {
    records.value = []
    persist()
    toastStore.info('Registo limpo', 'Todas as etiquetas e histórico NFC foram removidos deste dispositivo.')
  }

  // ---------- Consultas ----------
  const getRecordById = (id: string): NfcTag | undefined => records.value.find(r => r.id === id)

  const getRecordByTable = (restaurantId: string, tableId: string): NfcTag | undefined =>
    records.value.find(r => r.restaurantId === restaurantId && r.tableId === tableId)

  const getRecordByUrl = (url: string): NfcTag | undefined => {
    const norm = normalizeMenuUrl(url)
    return records.value.find(r => normalizeMenuUrl(r.url) === norm)
  }

  // ---------- Utilitários de timeline ----------
  const pushEvent = (
    record: NfcTag,
    type: NfcTimelineEventType,
    title: string,
    description: string,
    actor?: string
  ) => {
    const evt: NfcTimelineEvent = {
      id: newId('evt'),
      tagId: record.id,
      type,
      title,
      description,
      timestamp: nowIso(),
      actor: actor || currentActor()
    }
    record.timeline.unshift(evt)
    return evt
  }

  const setLastOperation = (record: NfcTag, op: NfcOperationType) => {
    record.lastOperation = op
    record.lastOperationAt = nowIso()
  }

  // ---------- Criação de registos ----------
  /** Garante a existência de um registo local para a mesa (estado virgem). */
  const ensureRecordForTable = (params: EnsureNfcRecordParams): NfcTag => {
    const existing = getRecordByTable(params.restaurantId, params.tableId)
    if (existing) {
      // Atualiza URL de destino (mesa/URL podem ter mudado nos dados mock)
      const wasWritten = !!existing.lastWrittenAt
      if (!wasWritten) existing.url = params.url
      existing.restaurantName = params.restaurantName
      existing.tableNumber = params.tableNumber
      existing.tableArea = params.tableArea
      persist()
      return existing
    }

    const record: NfcTag = {
      id: newId('nfc'),
      tenantId: params.tenantId,
      restaurantId: params.restaurantId,
      restaurantName: params.restaurantName,
      tableId: params.tableId,
      tableNumber: params.tableNumber,
      tableArea: params.tableArea,
      url: params.url,
      ndefType: NDEF_URI_TYPE,
      status: 'unassigned',
      serialNumber: null,
      hardwareName: null, // a Web NFC não fornece o modelo do chip
      protection: 'none',
      writeCount: 0,
      createdAt: nowIso(),
      timeline: []
    }
    pushEvent(
      record,
      'created',
      'Registo criado',
      `Etiqueta registada no sistema para a Mesa ${params.tableNumber}. Aguarda gravação física do URL.`,
      params.actor
    )
    records.value.push(record)
    persist()
    return record
  }

  // ---------- Operações reais ----------
  /**
   * Regista o resultado REAL de uma sessão de gravação.
   * A gravação física só acontece via nfcService.writeNdefUrl — o outcome
   * contém as deteções lidas da etiqueta pelo browser.
   */
  const registerWrite = (params: RegisterWriteParams): NfcTag => {
    const { record, outcome, verification } = params
    const isRewrite = record.writeCount > 0 || !!record.lastWrittenAt

    // Serial físico apenas se o browser o fornecer
    const detectedSerial = outcome.detections.find(d => !!d.serialNumber)?.serialNumber ?? null
    if (detectedSerial) record.serialNumber = detectedSerial

    // Etiqueta protegida nunca deve chegar aqui (bloqueado a montante)
    if (record.protection === 'system' && record.status === 'protected') {
      recordBlockedAttempt(record.id, 'Regravação impedida: etiqueta protegida no sistema.')
      return record
    }

    // 1. Início da sessão física
    pushEvent(
      record,
      'write_started',
      isRewrite ? 'Regravação iniciada' : 'Gravação iniciada',
      'Sessão NFC ativa — aguardar aproximação da etiqueta. Foram detetadas ' +
        `${outcome.detections.length} leitura(s) física(s) durante a sessão.`,
      params.actor
    )

    // 2. Escrita concluída (a promise de write() terminou com sucesso)
    const completedAt = nowIso()
    record.status = 'active'
    record.url = outcome.url
    record.lastWrittenAt = outcome.writtenAt
    record.writeCount += 1
    record.ndefType = NDEF_URI_TYPE
    record.verificationState = 'written_only'
    record.lastVerification = verification
    setLastOperation(record, isRewrite ? 'rewrite' : 'write')

    pushEvent(
      record,
      'write_completed',
      isRewrite ? 'Etiqueta regravada' : 'Gravação concluída',
      `Registo NDEF URL gravado fisicamente: ${outcome.url}`,
      params.actor
    )

    // 3. Verificação real (leitura de retorno — só se o browser permitir)
    if (verification === 'verified') {
      // Leitura efetiva + conteúdo igual ao esperado
      record.lastReadConfirmedAt = completedAt
      record.lastContentValidatedAt = completedAt
      record.lastVerifiedAt = completedAt
      record.verificationState = 'content_validated'
      pushEvent(
        record,
        'verified',
        'Conteúdo verificado',
        `Leitura de retorno confirma o URL gravado: ${outcome.url}`,
        params.actor
      )
      toastStore.success('Gravação concluída!', `Etiqueta verificada — Mesa ${record.tableNumber}.`)
    } else {
      // A leitura pode ter acontecido (conteúdo diferente/sem URL) ou não.
      if (verification === 'different' || verification === 'no_url') {
        record.lastReadConfirmedAt = completedAt
        record.verificationState = 'read_confirmed'
      }
      pushEvent(
        record,
        'verify_failed',
        'Verificação não confirmada',
        verification === 'unreadable' || verification === 'cancelled'
          ? 'A escrita física foi concluída, mas a verificação independente não foi possível. A etiqueta não é marcada como validada.'
          : 'O conteúdo lido não corresponde ao endereço esperado. A etiqueta não é marcada como validada.',
        params.actor
      )
      toastStore.warning(
        'Gravação sem validação',
        verification === 'unreadable' || verification === 'cancelled'
          ? 'Gravação concluída, mas a verificação independente não foi possível.'
          : 'A escrita terminou, mas o conteúdo não corresponde ao esperado.'
      )
    }

    persist()
    return record
  }

  /**
   * Regista a falha REAL de uma tentativa de gravação.
   * Nunca marca como gravada — a etiqueta permanece sem confirmação.
   */
  const registerWriteFailure = (record: NfcTag, reason: string, actor?: string) => {
    pushEvent(record, 'write_failed', 'Gravação falhou', reason, actor)
    setLastOperation(record, 'error')
    // Só marca 'failed' quando nunca existiu gravação comprovada
    if (record.status === 'unassigned') {
      record.status = 'failed'
    }
    persist()
    return record
  }

  /** Sessão cancelada antes de qualquer escrita física confirmada. */
  const registerCancellation = (record: NfcTag, reason?: string) => {
    pushEvent(
      record,
      'cancelled',
      'Gravação cancelada',
      reason || 'A sessão de gravação foi cancelada antes de o navegador confirmar qualquer escrita física.'
    )
    setLastOperation(record, 'cancelled')
    persist()
    return record
  }

  /**
   * Registra uma leitura real de etiqueta cujo URL corresponde a um registo.
   * (Etiquetas com URLs desconhecidos não são associadas a nenhuma mesa.)
   */
  const registerRead = (record: NfcTag, read: ParsedNfcRead) => {
    record.lastReadConfirmedAt = nowIso()
    if (record.verificationState !== 'content_validated') {
      record.verificationState = 'read_confirmed'
    }
    const found = read.url ? normalizeMenuUrl(read.url) : null
    const expected = normalizeMenuUrl(record.url)
    if (found === expected) {
      pushEvent(record, 'read', 'Etiqueta lida', `Conteúdo lido corresponde ao URL registado (${record.url}).`)
    } else {
      pushEvent(
        record,
        'read',
        'Leitura com divergência',
        `URL lido (${found ?? 'sem URL'}) difere do registado (${record.url}). Verifique a etiqueta.`
      )
    }
    setLastOperation(record, 'read')
    persist()
    return record
  }

  /** Resultado real do verificador (detalhes/após-verificação). */
  const registerVerify = (record: NfcTag, status: 'verified' | 'different' | 'no_url', foundUrl?: string | null) => {
    setLastOperation(record, 'verify')
    const verifiedAt = nowIso()
    if (status === 'verified') {
      record.lastReadConfirmedAt = verifiedAt
      record.lastContentValidatedAt = verifiedAt
      record.lastVerifiedAt = verifiedAt
      record.verificationState = 'content_validated'
      record.lastVerification = status
      pushEvent(record, 'verified', 'Conteúdo verificado', `Leitura confirma o URL gravado: ${record.url}.`)
      toastStore.success('Verificação concluída', 'Etiqueta verificada com sucesso.')
    } else if (status === 'different') {
      record.lastReadConfirmedAt = verifiedAt
      record.verificationState = 'read_confirmed'
      record.lastVerification = status
      pushEvent(
        record,
        'verify_failed',
        'Verificação divergente',
        `URL encontrado (${foundUrl}) difere do esperado (${record.url}). A etiqueta não é marcada como validada.`
      )
      toastStore.warning('Verificação divergente', 'Conteúdo físico não corresponde ao endereço esperado.')
    } else {
      record.lastReadConfirmedAt = verifiedAt
      record.verificationState = 'read_confirmed'
      record.lastVerification = status
      pushEvent(
        record,
        'verify_failed',
        'Verificação sem registo URL',
        'A etiqueta foi lida mas não contém um registo NDEF URL confirmável.'
      )
      toastStore.warning('Verificação inconclusiva', 'A etiqueta não contém um registo URL.')
    }
    persist()
    return record
  }

  // ---------- Proteção (SISTEMA — nunca física) ----------
  const protectRecord = (tagId: string, reason?: string, actor?: string) => {
    const record = getRecordById(tagId)
    if (!record) return { success: false, record, message: 'Etiqueta não encontrada no registo local.' }
    if (record.protection === 'system' && record.status === 'protected') {
      return { success: true, record, message: 'A etiqueta já está protegida no sistema.' }
    }

    record.protection = 'system'
    record.status = 'protected'
    setLastOperation(record, 'protect')
    pushEvent(
      record,
      'protected',
      'Etiqueta protegida',
      reason ||
        'Proteção ATIVADA NO SISTEMA: o TapMenu impede a regravação desta etiqueta pela aplicação. Bloqueio físico por hardware não é possível via Web NFC.',
      actor
    )
    persist()
    toastStore.success('Etiqueta protegida', `Mesa ${record.tableNumber} não pode ser regravada pelo sistema.`)
    return { success: true, record, message: 'Etiqueta protegida no sistema.' }
  }

  const unprotectRecord = (tagId: string, actor?: string) => {
    const record = getRecordById(tagId)
    if (!record) return { success: false, record, message: 'Etiqueta não encontrada no registo local.' }
    if (record.protection !== 'system' || record.status !== 'protected') {
      return { success: true, record, message: 'A etiqueta já não está protegida.' }
    }

    record.protection = 'none'
    record.status = record.lastWrittenAt ? 'active' : 'unassigned'
    setLastOperation(record, 'unprotect')
    pushEvent(
      record,
      'unprotected',
      'Proteção removida (sistema)',
      'A proteção LÓGICA do TapMenu foi retirada. Se a etiqueta foi bloqueada fisicamente por outra ferramenta externa, a gravação continua impossível — verifique com o "Testar NFC".',
      actor
    )
    persist()
    toastStore.success('Proteção removida', `Mesa ${record.tableNumber} pode ser regravada pelo sistema.`)
    return { success: true, record, message: 'Proteção removida.' }
  }

  /** Tentativa bloqueada de regravação numa etiqueta protegida. */
  const recordBlockedAttempt = (tagId: string, reason?: string, actor?: string) => {
    const record = getRecordById(tagId)
    if (!record) return
    pushEvent(
      record,
      'write_rejected',
      'Tentativa bloqueada',
      reason || 'Tentativa de regravação recusada — a etiqueta está protegida no sistema.',
      actor
    )
    setLastOperation(record, 'blocked_attempt')
    persist()
  }

  // ---------- Histórico global ----------
  const allTimelineEvents = computed(() => {
    const events: Array<NfcTimelineEvent & { recordId: string; serial: string | null; tableNumber: string; restaurantName: string; url: string }> = []
    records.value.forEach(record => {
      record.timeline.forEach(evt => {
        events.push({
          ...evt,
          recordId: record.id,
          serial: record.serialNumber,
          tableNumber: record.tableNumber,
          restaurantName: record.restaurantName,
          url: record.url
        })
      })
    })
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  })

  /** Histórico "plano" pedido pela gestão (data, operador, restaurante, mesa, URL, operação, resultado). */
  const historyEntries = computed(() => {
    return allTimelineEvents.value.map(evt => ({
      id: evt.id,
      timestamp: evt.timestamp,
      actor: evt.actor ?? '—',
      restaurantName: evt.restaurantName,
      tableNumber: evt.tableNumber,
      url: evt.url,
      operation: evt.type,
      result: evt.description
    }))
  })

  const metrics = computed(() => {
    const total = records.value.length
    const active = records.value.filter(r => r.status === 'active').length
    const protectedCount = records.value.filter(r => r.status === 'protected').length
    const unassigned = records.value.filter(r => r.status === 'unassigned').length
    const failed = records.value.filter(r => r.status === 'failed').length
    const verified = records.value.filter(r => !!r.lastVerifiedAt).length
    const writeTotal = records.value.reduce((acc, r) => acc + (r.writeCount || 0), 0)
    return { total, active, protected: protectedCount, unassigned, failed, verified, writeTotal }
  })

  return {
    records,
    isLoaded,
    loadRegistry,
    resetLocalRegistry,
    getRecordById,
    getRecordByTable,
    getRecordByUrl,
    ensureRecordForTable,
    registerWrite,
    registerWriteFailure,
    registerCancellation,
    registerRead,
    registerVerify,
    protectRecord,
    unprotectRecord,
    recordBlockedAttempt,
    allTimelineEvents,
    historyEntries,
    metrics
  }
})

/** Mensagem honesta sobre proteção — usada pelos modais. */
export const HARDWARE_LOCK_NOTE =
  'Bloqueio físico por hardware (read-only permanente) não é suportado pela Web NFC API neste dispositivo/navegador.'
