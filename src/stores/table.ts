import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Table, TableStatus, DigitalAccess, NfcSimulationRecord } from '@/types'
import { tableService, digitalAccessService } from '@/services'
import { useTenantStore } from './tenant'
import { useToastStore } from './toast'
import QRCode from 'qrcode'

export const useTableStore = defineStore('table', () => {
  const tenantStore = useTenantStore()
  const toastStore = useToastStore()

  const tables = ref<Table[]>([])
  const accessList = ref<DigitalAccess[]>([])
  const nfcHistory = ref<NfcSimulationRecord[]>([])
  const isLoading = ref(false)

  const loadTables = async () => {
    if (!tenantStore.currentRestaurant) {
      tables.value = []
      accessList.value = []
      return
    }
    isLoading.value = true
    try {
      const restId = tenantStore.currentRestaurant.id
      const [tbls, accesses] = await Promise.all([
        tableService.getTables(restId),
        digitalAccessService.getAccessList(restId)
      ])
      tables.value = tbls
      accessList.value = accesses
    } finally {
      isLoading.value = false
    }
  }

  const generateQrCode = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, {
        width: 320,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        }
      })
    } catch (e) {
      console.error('Erro ao gerar QR Code localmente', e)
      return ''
    }
  }

  const updateTableStatus = async (tableId: string, status: TableStatus) => {
    try {
      const updated = await tableService.updateTable(tableId, { status })
      const index = tables.value.findIndex(t => t.id === tableId)
      if (index !== -1) {
        tables.value[index] = updated
      }
      toastStore.success(`Mesa ${updated.number} atualizada`, `Estado: ${status}`)
      return updated
    } catch (e) {
      toastStore.error('Erro ao atualizar mesa', (e as Error).message)
    }
  }

  const saveTable = async (tableData: Partial<Table> & { number: string; capacity: number; area: any }) => {
    if (!tenantStore.currentRestaurant) return
    try {
      const rest = tenantStore.currentRestaurant
      const publicUrl = `/menu/${rest.slug}/${tableData.number}`

      if (tableData.id) {
        const updated = await tableService.updateTable(tableData.id, tableData)
        const index = tables.value.findIndex(t => t.id === tableData.id)
        if (index !== -1) tables.value[index] = updated
        toastStore.success('Mesa atualizada com sucesso')
        return updated
      } else {
        const created = await tableService.createTable({
          tenantId: rest.tenantId,
          restaurantId: rest.id,
          number: tableData.number,
          name: tableData.name || `Mesa ${tableData.number}`,
          area: tableData.area || 'Sala Principal',
          capacity: tableData.capacity || 4,
          status: 'free',
          publicUrl,
          nfcTagId: `NFC-${rest.slug.substring(0, 3).toUpperCase()}-${tableData.number}`,
          isActive: true
        })
        tables.value.push(created)

        // Create initial digital access
        const access = await digitalAccessService.createAccess({
          tenantId: rest.tenantId,
          restaurantId: rest.id,
          tableId: created.id,
          tableNumber: created.number,
          url: publicUrl,
          nfcTagUid: created.nfcTagId,
          nfcStatus: 'simulated',
          scanCount: 0
        })
        accessList.value.push(access)

        toastStore.success('Nova mesa criada!')
        return created
      }
    } catch (e) {
      toastStore.error('Erro ao salvar mesa', (e as Error).message)
      throw e
    }
  }

  const deleteTable = async (id: string) => {
    try {
      await tableService.deleteTable(id)
      tables.value = tables.value.filter(t => t.id !== id)
      toastStore.success('Mesa removida')
    } catch (e) {
      toastStore.error('Erro ao remover mesa', (e as Error).message)
    }
  }

  // NFC Simulation
  const simulateNfcWrite = (digitalAccess: DigitalAccess): NfcSimulationRecord => {
    const record: NfcSimulationRecord = {
      id: `nfc-sim-${Date.now()}`,
      digitalAccessId: digitalAccess.id,
      tableNumber: digitalAccess.tableNumber,
      restaurantName: tenantStore.currentRestaurant?.name || 'Restaurante',
      urlPayload: `${window.location.origin}${digitalAccess.url}`,
      tagUid: digitalAccess.nfcTagUid || `NFC-TAG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      success: true,
      statusMessage: 'Sucesso: URL codificada e gravada na tag NFC simulada (NDEF URI Record).'
    }

    nfcHistory.value.unshift(record)
    toastStore.success('Simulação de Escrita NFC Concluída', `URL gravada para Mesa ${digitalAccess.tableNumber}`)
    return record
  }

  return {
    tables,
    accessList,
    nfcHistory,
    isLoading,
    loadTables,
    generateQrCode,
    updateTableStatus,
    saveTable,
    deleteTable,
    simulateNfcWrite
  }
})
