import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PaymentMethod, Restaurant, SessionParticipant, Table, TableSession } from '@/types'
import { publicTableService, tableSessionService } from '@/services'
import { DomainError, errorMessage } from '@/domain/errors'
import { effectiveTableStatus } from '@/domain/tableRules'
import { useToastStore } from './toast'

/**
 * Experiência do cliente ao abrir a URL da mesa (NFC ou QR Code).
 *
 * Fluxo: URL → restaurante + mesa → estado atual → experiência.
 * Vários telemóveis participam da MESMA sessão ativa da mesa; cada dispositivo
 * guarda localmente apenas a referência à sua participação.
 */

interface DeviceParticipation {
  sessionId: string
  participantId: string
  name: string
  /** Segredo devolvido pelo servidor; autoriza pedidos nesta sessão. */
  token?: string
}

const storageKey = (tableId: string) => `tapmenu_device_participation_${tableId}`

function readParticipation(tableId: string): DeviceParticipation | null {
  try {
    const raw = localStorage.getItem(storageKey(tableId))
    return raw ? (JSON.parse(raw) as DeviceParticipation) : null
  } catch {
    return null
  }
}

function writeParticipation(tableId: string, value: DeviceParticipation | null) {
  try {
    if (value) localStorage.setItem(storageKey(tableId), JSON.stringify(value))
    else localStorage.removeItem(storageKey(tableId))
  } catch {
    // Sem armazenamento local: a participação dura apenas esta visita.
  }
}

export type TableAccessState = 'not_found' | 'unavailable' | 'free' | 'occupied'

export const useTableSessionStore = defineStore('tableSession', () => {
  const toastStore = useToastStore()

  const restaurant = ref<Restaurant | null>(null)
  const table = ref<Table | null>(null)
  const currentSession = ref<TableSession | null>(null)
  const participation = ref<DeviceParticipation | null>(null)
  const isLoading = ref(false)
  const isSubmitting = ref(false)

  const accessState = computed<TableAccessState>(() => {
    if (!restaurant.value || !table.value) return 'not_found'
    if (!restaurant.value.isActive) return 'unavailable'
    const status = effectiveTableStatus(table.value)
    if (status === 'unavailable') return 'unavailable'
    return currentSession.value ? 'occupied' : 'free'
  })

  /** Este dispositivo participa na sessão ativa da mesa. */
  const isParticipant = computed(
    () => !!currentSession.value && !!participation.value && participation.value.sessionId === currentSession.value.id
  )

  const participantName = computed(() => (isParticipant.value ? participation.value?.name ?? '' : ''))
  const participantToken = computed(() => (isParticipant.value ? participation.value?.token : undefined))

  const applyContext = (ctx: { restaurant: Restaurant; table: Table; activeSession: TableSession | null } | null) => {
    restaurant.value = ctx?.restaurant ?? null
    table.value = ctx?.table ?? null
    currentSession.value = ctx?.activeSession ?? null
    if (!ctx) {
      participation.value = null
      return
    }
    const stored = readParticipation(ctx.table.id)
    const session = ctx.activeSession
    const valid = !!stored && !!session && stored.sessionId === session.id && session.participants.some(p => p.id === stored.participantId)
    participation.value = valid ? stored : null
    // Participação de uma sessão já encerrada: descartar.
    if (stored && !valid) writeParticipation(ctx.table.id, null)
  }

  /** Consulta o estado atual da mesa a partir da URL pública. */
  const loadTable = async (restaurantSlug: string, tableKey: string) => {
    isLoading.value = true
    try {
      applyContext(await publicTableService.resolve(restaurantSlug, tableKey))
    } finally {
      isLoading.value = false
    }
  }

  const refresh = async () => {
    if (!restaurant.value || !table.value) return
    applyContext(await publicTableService.resolve(restaurant.value.slug, table.value.slug))
  }

  const rememberParticipant = (session: TableSession, participant: SessionParticipant) => {
    currentSession.value = session
    participation.value = { sessionId: session.id, participantId: participant.id, name: participant.name, token: participant.token }
    writeParticipation(session.tableId, participation.value)
  }

  /** Mesa livre → inicia a sessão (mesa passa a Ocupada). */
  const startSession = async (input: { name: string; partySize?: number; notes?: string }) => {
    if (!restaurant.value || !table.value) return null
    isSubmitting.value = true
    try {
      const { session, participant } = await tableSessionService.startSession({
        tableId: table.value.id,
        primaryCustomerName: input.name,
        partySize: input.partySize,
        notes: input.notes
      })
      if (!participant) throw new DomainError('participant_name_required', 'Indique o seu nome.')
      rememberParticipant(session, participant)
      table.value = { ...table.value, status: 'occupied', activeSessionId: session.id }
      toastStore.success('Sessão iniciada', `Bem-vindo(a), ${participant.name}.`)
      return session
    } catch (e) {
      // Outra pessoa iniciou a sessão no mesmo instante: juntar-se a ela.
      if (e instanceof DomainError && e.code === 'table_already_occupied') {
        await refresh()
        if (currentSession.value) return joinSession(input.name)
      }
      toastStore.error('Não foi possível iniciar a sessão', errorMessage(e))
      return null
    } finally {
      isSubmitting.value = false
    }
  }

  /** Mesa ocupada → este dispositivo junta-se à sessão existente. */
  const joinSession = async (name: string) => {
    if (!currentSession.value) return null
    isSubmitting.value = true
    try {
      const { session, participant } = await tableSessionService.joinSession(currentSession.value.id, name)
      rememberParticipant(session, participant)
      toastStore.success('Juntou-se à mesa', `Os seus pedidos ficam na sessão da Mesa ${table.value?.number}.`)
      return session
    } catch (e) {
      toastStore.error('Não foi possível juntar-se à mesa', errorMessage(e))
      await refresh()
      return null
    } finally {
      isSubmitting.value = false
    }
  }

  /** O cliente pede a conta e indica como vai pagar (a equipa confirma o recebimento). */
  const requestBill = async (paymentMethod?: PaymentMethod, notes?: string) => {
    if (!restaurant.value || !table.value || !currentSession.value) return null
    try {
      const updated = await publicTableService.requestBill(currentSession.value.id, participantToken.value, paymentMethod, notes)
      currentSession.value = updated
      toastStore.success('Conta pedida', 'A equipa foi notificada e trará a conta à mesa.')
      return updated
    } catch (e) {
      toastStore.error('Erro ao pedir a conta', errorMessage(e))
      return null
    }
  }

  return {
    restaurant,
    table,
    currentSession,
    participation,
    isLoading,
    isSubmitting,
    accessState,
    isParticipant,
    participantName,
    participantToken,
    loadTable,
    refresh,
    startSession,
    joinSession,
    requestBill
  }
})
