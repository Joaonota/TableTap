import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { tableOperationsService, serviceRequestService, subscribeToRealtime, type RealtimeTable } from '@/services'
import { useTenantStore } from './tenant'
import { useToastStore } from './toast'
import { errorMessage } from '@/domain/errors'
import type {
  AssignmentRole,
  DutyStatus,
  OpsMe,
  OpsStaff,
  ServiceAction,
  TableOperation
} from '@/domain/tableOperations'

/**
 * Operação de sala (migração 2000): mesas com responsável, chamadas,
 * pedidos e total. O servidor decide o que cada pessoa vê (o garçom só as
 * suas mesas); este store só guarda e actualiza em tempo real.
 */
export const useTableOperationsStore = defineStore('tableOperations', () => {
  const tenantStore = useTenantStore()
  const toast = useToastStore()

  const tables = ref<TableOperation[]>([])
  const staff = ref<OpsStaff[]>([])
  const me = ref<OpsMe | null>(null)
  const isLoading = ref(false)
  const loadError = ref('')
  /** Diferença entre o relógio do servidor e o do aparelho (para os tempos de espera). */
  const clockSkewMs = ref(0)
  let loadedFor = ''

  const restaurantId = () => tenantStore.currentRestaurant?.id ?? ''

  const load = async (silent = false) => {
    const id = restaurantId()
    if (!id) {
      tables.value = []
      staff.value = []
      me.value = null
      return
    }
    if (!silent) isLoading.value = true
    try {
      const snap = await tableOperationsService.getSnapshot(id)
      if (restaurantId() !== id) return
      tables.value = snap.tables
      staff.value = snap.staff
      me.value = snap.me
      clockSkewMs.value = snap.serverTime ? new Date(snap.serverTime).getTime() - Date.now() : 0
      loadError.value = ''
      loadedFor = id
    } catch (e) {
      loadError.value = errorMessage(e)
      if (loadedFor !== id) {
        tables.value = []
        staff.value = []
        me.value = null
      }
    } finally {
      isLoading.value = false
    }
  }

  /** Mesas, sessões, pedidos, chamadas e atribuições chegam em tempo real. */
  const subscribeRealtime = () => {
    const id = restaurantId()
    if (!id) return () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (restaurantId() === id) void load(true)
      }, 300)
    }
    const sources: RealtimeTable[] = ['dining_tables', 'table_sessions', 'orders', 'service_requests', 'table_staff_assignments']
    const stops = sources.map(t => subscribeToRealtime(t, id, refresh))
    return () => {
      clearTimeout(timer)
      stops.forEach(stop => stop())
    }
  }

  const run = async <T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    try {
      const result = await fn()
      if (success) toast.success(success)
      await load(true)
      return result
    } catch (e) {
      toast.error('Não foi possível concluir', errorMessage(e))
      return undefined
    }
  }

  const assign = (tableIds: string[], staffId: string, role: AssignmentRole, expiresAt?: Date | null, reason?: string) =>
    run(
      () => tableOperationsService.assign(tableIds, staffId, role, expiresAt, reason),
      tableIds.length > 1 ? `${tableIds.length} mesas atribuídas` : 'Mesa atribuída'
    )

  const remove = (assignmentId: string, reason?: string) =>
    run(() => tableOperationsService.remove(assignmentId, reason), 'Atribuição removida')

  const transferTable = (tableId: string, toStaffId: string, reason?: string, fromStaffId?: string) =>
    run(async () => {
      await tableOperationsService.transferTable(tableId, toStaffId, reason, fromStaffId)
      return true
    }, 'Mesa transferida')

  const transferStaffTables = async (toStaffId: string, reason?: string, fromStaffId?: string) => {
    const n = await run(() => tableOperationsService.transferStaffTables(restaurantId(), toStaffId, reason, fromStaffId))
    if (n !== undefined) toast.success(n ? `${n} ${n === 1 ? 'mesa transferida' : 'mesas transferidas'}` : 'Não havia mesas para transferir')
    return n
  }

  const setDutyStatus = (status: DutyStatus, staffId?: string) =>
    run(() => tableOperationsService.setDutyStatus(status, staffId))

  const handleRequest = (requestId: string, action: ServiceAction, onBehalfOfStaffId?: string) => {
    const text: Record<ServiceAction, string> = {
      acknowledge: 'Chamada recebida',
      start: 'Em atendimento',
      complete: 'Atendimento concluído',
      cancel: 'Chamada cancelada',
      take_over: 'Chamada assumida'
    }
    return run(() => serviceRequestService.handle(requestId, action, onBehalfOfStaffId), text[action])
  }

  const myTables = computed(() =>
    me.value?.staffId ? tables.value.filter(t => t.assignments.some(a => a.staffId === me.value!.staffId)) : []
  )

  return {
    tables,
    staff,
    me,
    myTables,
    isLoading,
    loadError,
    clockSkewMs,
    load,
    subscribeRealtime,
    assign,
    remove,
    transferTable,
    transferStaffTables,
    setDutyStatus,
    handleRequest
  }
})
