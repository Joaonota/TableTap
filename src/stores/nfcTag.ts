import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NfcTag, NfcTagEvent, NfcTagStatus, Table } from '@/types'
import { nfcTagService, tableService, type RegisterNfcTagsInput } from '@/services'
import { errorMessage } from '@/domain/errors'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'

/**
 * Gestão administrativa das etiquetas NFC.
 * Não existe nenhuma operação de gravação física — a equipa TapMenu grava as
 * etiquetas com uma aplicação externa e aqui apenas se regista o estado.
 */
export const useNfcTagStore = defineStore('nfcTag', () => {
  const authStore = useAuthStore()
  const toastStore = useToastStore()

  const tags = ref<NfcTag[]>([])
  /** Mesas dos restaurantes carregados (para rótulos e seleção). */
  const tables = ref<Table[]>([])
  const isLoading = ref(false)
  const loadedRestaurantIds = ref<string[]>([])

  const actor = () => authStore.currentUser?.name || 'Operador TapMenu'

  const tablesById = computed(() => new Map(tables.value.map(t => [t.id, t])))

  /** Etiqueta em uso por mesa (exclui desativadas). */
  const tagByTableId = computed(() => {
    const map = new Map<string, NfcTag>()
    for (const tag of tags.value) {
      if (tag.tableId && tag.status !== 'disabled') map.set(tag.tableId, tag)
    }
    return map
  })

  const countsByStatus = computed(() => {
    const counts: Record<NfcTagStatus, number> = { pending: 0, configured: 0, active: 0, disabled: 0, reassignment_pending: 0 }
    tags.value.forEach(t => counts[t.status]++)
    return counts
  })

  /** Carrega etiquetas e mesas dos restaurantes indicados. */
  const load = async (restaurantIds: string[]) => {
    isLoading.value = true
    try {
      const [tagLists, tableLists] = await Promise.all([
        Promise.all(restaurantIds.map(id => nfcTagService.getTags(id))),
        Promise.all(restaurantIds.map(id => tableService.getTables(id)))
      ])
      tags.value = tagLists.flat()
      tables.value = tableLists.flat()
      loadedRestaurantIds.value = [...restaurantIds]
    } catch (e) {
      toastStore.error('Erro ao carregar etiquetas', errorMessage(e))
    } finally {
      isLoading.value = false
    }
  }

  const reload = () => load(loadedRestaurantIds.value)

  const replaceTag = (updated: NfcTag) => {
    const index = tags.value.findIndex(t => t.id === updated.id)
    if (index === -1) tags.value.push(updated)
    else tags.value[index] = updated
  }

  /** Executa uma operação, atualiza a lista e mostra o resultado. */
  const run = async (operation: () => Promise<NfcTag>, successTitle: string, successMessage?: (tag: NfcTag) => string) => {
    try {
      const tag = await operation()
      replaceTag(tag)
      toastStore.success(successTitle, successMessage?.(tag))
      return tag
    } catch (e) {
      toastStore.error('Operação não concluída', errorMessage(e))
      return null
    }
  }

  const tableLabel = (tableId?: string) => {
    const table = tableId ? tablesById.value.get(tableId) : undefined
    return table ? `Mesa ${table.number}` : '—'
  }

  const register = async (input: RegisterNfcTagsInput) => {
    try {
      const created = await nfcTagService.registerTags(input, actor())
      tags.value.push(...created)
      toastStore.success(
        created.length === 1 ? 'Etiqueta registada' : `${created.length} etiquetas registadas`,
        created.map(t => t.code).join(', ')
      )
      return created
    } catch (e) {
      toastStore.error('Não foi possível registar', errorMessage(e))
      return null
    }
  }

  const assign = (tagId: string, tableId: string) =>
    run(() => nfcTagService.assignToTable(tagId, tableId, actor()), 'Associação guardada', tag =>
      tag.status === 'reassignment_pending'
        ? `${tag.code} → ${tableLabel(tag.tableId)}. A equipa TapMenu tem de regravar a etiqueta.`
        : `${tag.code} → ${tableLabel(tag.tableId)}.`
    )

  const unassign = (tagId: string) =>
    run(() => nfcTagService.unassign(tagId, actor()), 'Associação removida', tag => `${tag.code} já não está associada a nenhuma mesa.`)

  const markConfigured = (tagId: string, notes?: string) =>
    run(() => nfcTagService.markConfigured(tagId, actor(), notes), 'Configuração registada', tag => `${tag.code} marcada como configurada (registo administrativo).`)

  const activate = (tagId: string) =>
    run(() => nfcTagService.activate(tagId, actor()), 'Etiqueta ativa', tag => `${tag.code} está instalada e em uso.`)

  const disable = (tagId: string, reason?: string) =>
    run(() => nfcTagService.disable(tagId, actor(), reason), 'Etiqueta desativada', tag => `${tag.code} foi retirada de uso.`)

  const reactivate = (tagId: string) =>
    run(() => nfcTagService.reactivate(tagId, actor()), 'Etiqueta reativada', tag => `${tag.code} pode voltar a ser associada.`)

  const getHistory = async (tagId: string): Promise<NfcTagEvent[]> => {
    try {
      return await nfcTagService.getHistory(tagId)
    } catch (e) {
      toastStore.error('Erro ao carregar histórico', errorMessage(e))
      return []
    }
  }

  return {
    tags,
    tables,
    isLoading,
    tablesById,
    tagByTableId,
    countsByStatus,
    load,
    reload,
    tableLabel,
    register,
    assign,
    unassign,
    markConfigured,
    activate,
    disable,
    reactivate,
    getHistory
  }
})
