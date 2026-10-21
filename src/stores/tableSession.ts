import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TableSession, Table, Restaurant } from '@/types'
import { tableSessionService, tableService } from '@/services'
import { useNotificationStore } from './notification'
import { useToastStore } from './toast'

export interface LocalSessionToken {
  sessionId: string
  customerName: string
  partySize?: number
  isOwner: boolean
}

export const useTableSessionStore = defineStore('tableSession', () => {
  const notificationStore = useNotificationStore()
  const toastStore = useToastStore()

  const currentSession = ref<TableSession | null>(null)
  const isSessionOwner = ref(false)
  const isOccupiedByOther = ref(false)
  const isLoading = ref(false)

  const getStorageKey = (restaurantSlug: string, tableNumber: string) => {
    return `tapmenu_session_${restaurantSlug}_${tableNumber}`
  }

  const getLocalToken = (restaurantSlug: string, tableNumber: string): LocalSessionToken | null => {
    try {
      const data = localStorage.getItem(getStorageKey(restaurantSlug, tableNumber))
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  const setLocalToken = (restaurantSlug: string, tableNumber: string, token: LocalSessionToken) => {
    try {
      localStorage.setItem(getStorageKey(restaurantSlug, tableNumber), JSON.stringify(token))
    } catch (e) {
      console.warn('Erro ao guardar sessão localmente', e)
    }
  }

  const clearLocalToken = (restaurantSlug: string, tableNumber: string) => {
    try {
      localStorage.removeItem(getStorageKey(restaurantSlug, tableNumber))
    } catch (e) {
      console.warn('Erro ao limpar sessão local', e)
    }
  }

  const inspectTableSession = async (
    restaurant: Restaurant,
    table: Table
  ): Promise<{
    session: TableSession | null
    isOwner: boolean
    isOccupiedByOther: boolean
    status: Table['status']
  }> => {
    isLoading.value = true
    try {
      // Fetch latest active session for this table from mock database
      const activeSession = await tableSessionService.getActiveSessionByTable(table.id)
      const token = getLocalToken(restaurant.slug, table.number)

      currentSession.value = activeSession

      if (activeSession) {
        // If local token matches the active session ID, customer is the owner
        if (token && token.sessionId === activeSession.id && token.isOwner) {
          isSessionOwner.value = true
          isOccupiedByOther.value = false
        } else {
          isSessionOwner.value = false
          isOccupiedByOther.value = true
        }
      } else {
        // No active session in database -> table is free (or unavailable)
        isSessionOwner.value = false
        isOccupiedByOther.value = false
        if (token) {
          // Stale token, clear it
          clearLocalToken(restaurant.slug, table.number)
        }
      }

      return {
        session: activeSession,
        isOwner: isSessionOwner.value,
        isOccupiedByOther: isOccupiedByOther.value,
        status: table.status
      }
    } finally {
      isLoading.value = false
    }
  }

  const occupyTable = async (options: {
    restaurant: Restaurant
    table: Table
    customerName: string
    partySize?: number
    notes?: string
  }): Promise<TableSession> => {
    const trimmedName = options.customerName.trim()
    if (!trimmedName) {
      throw new Error('O nome do cliente é obrigatório para ocupar a mesa.')
    }

    // Verify current table state
    const freshTable = await tableService.getTableById(options.table.id)
    if (freshTable && freshTable.status !== 'free') {
      // Check if already occupied
      const existingSession = await tableSessionService.getActiveSessionByTable(options.table.id)
      if (existingSession && existingSession.status !== 'closed') {
        throw new Error(`A Mesa ${options.table.number} já está ocupada por ${existingSession.customerName}.`)
      }
    }

    isLoading.value = true
    try {
      const session = await tableSessionService.startSession({
        tenantId: options.restaurant.tenantId,
        restaurantId: options.restaurant.id,
        tableId: options.table.id,
        customerName: trimmedName,
        partySize: options.partySize,
        notes: options.notes
      })

      currentSession.value = session
      isSessionOwner.value = true
      isOccupiedByOther.value = false

      // Save local device ownership token
      setLocalToken(options.restaurant.slug, options.table.number, {
        sessionId: session.id,
        customerName: trimmedName,
        partySize: options.partySize,
        isOwner: true
      })

      // Dispatch counter notification
      await notificationStore.createNotification({
        tenantId: options.restaurant.tenantId,
        restaurantId: options.restaurant.id,
        type: 'table_occupied',
        title: 'Nova mesa ocupada',
        message: `Mesa ${options.table.number} ocupada por ${trimmedName}${options.partySize ? ` (${options.partySize} pessoas)` : ''}.`,
        tableId: options.table.id,
        tableNumber: options.table.number,
        tableSessionId: session.id
      })

      toastStore.success('Mesa Ocupada!', `Bem-vindo(a), ${trimmedName}. Já pode realizar pedidos diretamente do menu.`)
      return session
    } finally {
      isLoading.value = false
    }
  }

  const requestBill = async (options: {
    restaurant: Restaurant
    table: Table
    session: TableSession
    totalAmount: number
    notes?: string
  }) => {
    try {
      // Update session status to awaiting_bill
      const updated = await tableSessionService.updateSessionStatus(options.session.id, 'awaiting_bill')
      currentSession.value = updated

      // Update table status to waiting_bill
      await tableService.updateTable(options.table.id, { status: 'waiting_bill' })

      // Dispatch counter notification
      await notificationStore.createNotification({
        tenantId: options.restaurant.tenantId,
        restaurantId: options.restaurant.id,
        type: 'bill_requested',
        title: 'Pedido de Conta',
        message: `Mesa ${options.table.number} (${options.session.customerName}) solicitou a conta — Total demonstrativo: ${options.totalAmount.toLocaleString('pt-MZ')} MT`,
        tableId: options.table.id,
        tableNumber: options.table.number,
        tableSessionId: options.session.id
      })

      toastStore.success('Conta Solicitada', 'O balcão foi notificado. Um funcionário trará a conta até à sua mesa.')
      return updated
    } catch (e) {
      toastStore.error('Erro ao pedir conta', (e as Error).message)
      throw e
    }
  }

  const closeSession = async (restaurant: Restaurant, table: Table, sessionId: string) => {
    try {
      const closed = await tableSessionService.closeSession(sessionId)
      if (currentSession.value?.id === sessionId) {
        currentSession.value = closed
      }
      clearLocalToken(restaurant.slug, table.number)
      return closed
    } catch (e) {
      toastStore.error('Erro ao encerrar sessão', (e as Error).message)
      throw e
    }
  }

  return {
    currentSession,
    isSessionOwner,
    isOccupiedByOther,
    isLoading,
    inspectTableSession,
    occupyTable,
    requestBill,
    closeSession,
    clearLocalToken
  }
})
