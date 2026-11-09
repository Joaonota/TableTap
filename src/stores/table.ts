import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Table, TableSession } from '@/types'
import { tableService, tableSessionService, type TableInput } from '@/services'
import { countTables } from '@/domain/tableRules'
import { buildTableUrl } from '@/domain/publicUrl'
import { errorMessage } from '@/domain/errors'
import { useTenantStore } from './tenant'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'
import { useNfcTagStore } from './nfcTag'
import { useNotificationStore } from './notification'

/**
 * Mesas do restaurante atual + sessões ativas (painel do restaurante).
 * O estado "Ocupada" é consequência da sessão: startSession/closeSession/
 * cancelSession são as únicas formas de entrar/sair desse estado.
 */
export const useTableStore = defineStore('table', () => {
  const tenantStore = useTenantStore()
  const authStore = useAuthStore()
  const toastStore = useToastStore()
  const nfcTagStore = useNfcTagStore()
  const notificationStore = useNotificationStore()

  const tables = ref<Table[]>([])
  const activeSessions = ref<TableSession[]>([])
  const isLoading = ref(false)
  const hasLoaded = ref(false)

  const actor = () => authStore.currentUser?.name || 'Equipa do restaurante'

  const counts = computed(() => countTables(tables.value))

  const activeSessionByTableId = computed(() => new Map(activeSessions.value.map(s => [s.tableId, s])))

  const tableUrl = (table: Table): string => {
    const restaurant = tenantStore.currentRestaurant
    return restaurant ? buildTableUrl(restaurant, table) : ''
  }

  const loadTables = async () => {
    const restaurant = tenantStore.currentRestaurant
    if (!restaurant) {
      tables.value = []
      activeSessions.value = []
      return
    }
    isLoading.value = true
    try {
      const [tbls, sessions] = await Promise.all([
        tableService.getTables(restaurant.id),
        tableSessionService.getSessions(restaurant.id),
        nfcTagStore.load([restaurant.id])
      ])
      tables.value = tbls
      activeSessions.value = sessions.filter(s => s.status === 'active')
      hasLoaded.value = true
    } catch (e) {
      toastStore.error('Erro ao carregar mesas', errorMessage(e))
    } finally {
      isLoading.value = false
    }
  }

  const replaceTable = (updated: Table) => {
    const index = tables.value.findIndex(t => t.id === updated.id)
    if (index === -1) tables.value.push(updated)
    else tables.value[index] = updated
  }

  const refreshTable = async (tableId: string) => {
    const [table, session] = await Promise.all([
      tableService.getTableById(tableId),
      tableSessionService.getActiveSessionByTable(tableId)
    ])
    if (table) replaceTable(table)
    activeSessions.value = activeSessions.value.filter(s => s.tableId !== tableId)
    if (session) activeSessions.value.push(session)
  }

  const createTable = async (input: TableInput) => {
    const restaurant = tenantStore.currentRestaurant
    if (!restaurant) return null
    try {
      const created = await tableService.createTable(restaurant.id, input)
      replaceTable(created)
      nfcTagStore.tables.push(created)
      toastStore.success('Mesa criada', `Mesa ${created.number} — URL ${tableUrl(created)}`)
      return created
    } catch (e) {
      toastStore.error('Não foi possível criar a mesa', errorMessage(e))
      return null
    }
  }

  const updateTable = async (id: string, input: Partial<TableInput>) => {
    try {
      const updated = await tableService.updateTable(id, input)
      replaceTable(updated)
      toastStore.success('Mesa atualizada', 'A URL da mesa não mudou.')
      return updated
    } catch (e) {
      toastStore.error('Não foi possível guardar', errorMessage(e))
      return null
    }
  }

  const setStatus = async (id: string, status: 'free' | 'unavailable') => {
    try {
      const updated = await tableService.setTableStatus(id, status)
      replaceTable(updated)
      toastStore.success(`Mesa ${updated.number}`, status === 'free' ? 'Marcada como livre.' : 'Marcada como indisponível.')
      return updated
    } catch (e) {
      toastStore.error('Não foi possível alterar o estado', errorMessage(e))
      return null
    }
  }

  const setActive = async (id: string, isActive: boolean) => {
    try {
      const updated = await tableService.setTableActive(id, isActive)
      replaceTable(updated)
      toastStore.success(`Mesa ${updated.number}`, isActive ? 'Mesa ativada.' : 'Mesa desativada. A URL pública mostra a mesa como indisponível.')
      return updated
    } catch (e) {
      toastStore.error('Não foi possível alterar a mesa', errorMessage(e))
      return null
    }
  }

  const deleteTable = async (id: string) => {
    const table = tables.value.find(t => t.id === id)
    try {
      await tableService.deleteTable(id, actor())
      tables.value = tables.value.filter(t => t.id !== id)
      await nfcTagStore.reload()
      toastStore.success('Mesa removida', table ? `Mesa ${table.number} removida.` : undefined)
      return true
    } catch (e) {
      toastStore.error('Não foi possível remover', errorMessage(e))
      return false
    }
  }

  /** Abertura de sessão pela equipa (ex.: clientes sentados pelo empregado). */
  const startSession = async (tableId: string, input: { primaryCustomerName?: string; partySize?: number; notes?: string }) => {
    const restaurant = tenantStore.currentRestaurant
    try {
      const { session } = await tableSessionService.startSession({ tableId, ...input })
      await refreshTable(tableId)
      const table = tables.value.find(t => t.id === tableId)
      if (restaurant && table) {
        await notificationStore.createNotification({
          tenantId: restaurant.tenantId,
          restaurantId: restaurant.id,
          type: 'table_occupied',
          title: 'Sessão iniciada',
          message: `Mesa ${table.number} ocupada${session.primaryCustomerName ? ` por ${session.primaryCustomerName}` : ''} (aberta por ${actor()}).`,
          tableId,
          tableNumber: table.number,
          tableSessionId: session.id
        })
      }
      toastStore.success('Sessão iniciada', `Mesa ${table?.number ?? ''} está agora ocupada.`)
      return session
    } catch (e) {
      toastStore.error('Não foi possível iniciar a sessão', errorMessage(e))
      return null
    }
  }

  const closeSession = async (sessionId: string) => {
    try {
      const session = await tableSessionService.closeSession(sessionId, actor())
      await refreshTable(session.tableId)
      const table = tables.value.find(t => t.id === session.tableId)
      toastStore.success('Sessão encerrada', `Mesa ${table?.number ?? ''} está livre. Total: ${session.total.toLocaleString('pt-MZ')} MT.`)
      return session
    } catch (e) {
      toastStore.error('Não foi possível encerrar', errorMessage(e))
      return null
    }
  }

  const cancelSession = async (sessionId: string, reason?: string) => {
    try {
      const session = await tableSessionService.cancelSession(sessionId, actor(), reason)
      await refreshTable(session.tableId)
      toastStore.success('Sessão cancelada', 'A mesa está livre.')
      return session
    } catch (e) {
      toastStore.error('Não foi possível cancelar', errorMessage(e))
      return null
    }
  }

  return {
    tables,
    activeSessions,
    isLoading,
    hasLoaded,
    counts,
    activeSessionByTableId,
    tableUrl,
    loadTables,
    refreshTable,
    createTable,
    updateTable,
    setStatus,
    setActive,
    deleteTable,
    startSession,
    closeSession,
    cancelSession
  }
})
