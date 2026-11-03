import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NfcTag, NfcTimelineEvent, NfcTagStatus } from '@/types'
import { useToastStore } from './toast'

const STORAGE_KEY = 'tapmenu_nfc_tags_store_v1'

export const generateRealisticNfcUid = (): string => {
  // NXP NTAG chips standard 7-byte UID starting with 0x04
  const bytes = [0x04]
  for (let i = 0; i < 6; i++) {
    bytes.push(Math.floor(Math.random() * 256))
  }
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':')
}

export const calculateNdefUriSize = (url: string): number => {
  // NDEF URI Record overhead: 1 byte header, 1 byte type len, 1 byte payload len, 1 byte URI identifier, type (1 byte), URI payload
  return 5 + new TextEncoder().encode(url.replace(/^https?:\/\//, '')).length
}

const initialTags: NfcTag[] = [
  {
    id: 'nfc-tag-1',
    uid: '04:5A:21:8B:10:9C:80',
    tagType: 'NXP NTAG213 (180 Bytes)',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    restaurantName: 'Sabores Maputo',
    tableId: 'tbl-1',
    tableNumber: '01',
    targetUrl: '/menu/sabores-maputo/01',
    status: 'locked',
    isLocked: true,
    createdAt: '2026-10-15T09:00:00Z',
    writtenAt: '2026-10-15T09:05:00Z',
    lockedAt: '2026-10-15T09:12:00Z',
    scanCount: 142,
    lastScannedAt: '2026-10-16T11:15:00Z',
    ndefRecordType: 'URI (Well-Known Type \'U\' - 0x55)',
    ndefPrefix: '0x04 (https://)',
    ndefPayload: 'https://tapmenu.co.mz/menu/sabores-maputo/01',
    ndefSize: 64,
    timeline: [
      {
        id: 'evt-1-1',
        tagId: 'nfc-tag-1',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Etiqueta virgem identificada e associada à Mesa 01.',
        timestamp: '2026-10-15T09:00:00Z',
        actor: 'Admin Rui Mondlane'
      },
      {
        id: 'evt-1-2',
        tagId: 'nfc-tag-1',
        type: 'write_started',
        title: 'Gravação iniciada',
        description: 'Sintonia RF com leitor e alocação de páginas NDEF 04 a 19.',
        timestamp: '2026-10-15T09:04:30Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-1-3',
        tagId: 'nfc-tag-1',
        type: 'write_completed',
        title: 'Gravação concluída',
        description: 'Registo NDEF URI gravado: /menu/sabores-maputo/01 (64 bytes).',
        timestamp: '2026-10-15T09:05:00Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-1-4',
        tagId: 'nfc-tag-1',
        type: 'verified',
        title: 'Conteúdo verificado',
        description: 'Checksum CRC32 validado — Leitura de teste bem-sucedida sem erros de paridade.',
        timestamp: '2026-10-15T09:05:45Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-1-5',
        tagId: 'nfc-tag-1',
        type: 'locked',
        title: 'Etiqueta bloqueada',
        description: 'Lock-bits estáticos e dinâmicos OTP ativados. Tag em modo permanente Read-Only.',
        timestamp: '2026-10-15T09:12:00Z',
        actor: 'Admin Rui Mondlane'
      }
    ]
  },
  {
    id: 'nfc-tag-2',
    uid: '04:8E:9F:3C:44:12:80',
    tagType: 'NXP NTAG213 (180 Bytes)',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    restaurantName: 'Sabores Maputo',
    tableId: 'tbl-2',
    tableNumber: '02',
    targetUrl: '/menu/sabores-maputo/02',
    status: 'programmed',
    isLocked: false,
    createdAt: '2026-10-15T09:30:00Z',
    writtenAt: '2026-10-15T09:35:00Z',
    scanCount: 98,
    lastScannedAt: '2026-10-16T11:32:00Z',
    ndefRecordType: 'URI (Well-Known Type \'U\' - 0x55)',
    ndefPrefix: '0x04 (https://)',
    ndefPayload: 'https://tapmenu.co.mz/menu/sabores-maputo/02',
    ndefSize: 64,
    timeline: [
      {
        id: 'evt-2-1',
        tagId: 'nfc-tag-2',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Etiqueta física registada para a Mesa 02 da Sala Principal.',
        timestamp: '2026-10-15T09:30:00Z',
        actor: 'Admin Rui Mondlane'
      },
      {
        id: 'evt-2-2',
        tagId: 'nfc-tag-2',
        type: 'write_started',
        title: 'Gravação iniciada',
        description: 'Comunicação NFC estabelecida a 106 kbit/s.',
        timestamp: '2026-10-15T09:34:40Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-2-3',
        tagId: 'nfc-tag-2',
        type: 'write_completed',
        title: 'Gravação concluída',
        description: 'URL de mesa gravada no bloco de dados NDEF com 64 bytes.',
        timestamp: '2026-10-15T09:35:00Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-2-4',
        tagId: 'nfc-tag-2',
        type: 'verified',
        title: 'Conteúdo verificado',
        description: 'Leitura de retorno validada com código HTTP 200.',
        timestamp: '2026-10-15T09:35:30Z',
        actor: 'TapMenu NFC Studio'
      }
    ]
  },
  {
    id: 'nfc-tag-3',
    uid: '04:71:A3:D8:52:3B:80',
    tagType: 'NXP NTAG215 (540 Bytes)',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    restaurantName: 'Sabores Maputo',
    tableId: 'tbl-3',
    tableNumber: '03',
    targetUrl: '/menu/sabores-maputo/03',
    status: 'programmed',
    isLocked: false,
    createdAt: '2026-10-15T10:00:00Z',
    writtenAt: '2026-10-15T10:05:00Z',
    scanCount: 115,
    lastScannedAt: '2026-10-16T10:45:00Z',
    ndefRecordType: 'URI (Well-Known Type \'U\' - 0x55)',
    ndefPrefix: '0x04 (https://)',
    ndefPayload: 'https://tapmenu.co.mz/menu/sabores-maputo/03',
    ndefSize: 64,
    timeline: [
      {
        id: 'evt-3-1',
        tagId: 'nfc-tag-3',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Etiqueta NTAG215 associada à Mesa 03.',
        timestamp: '2026-10-15T10:00:00Z',
        actor: 'Admin Rui Mondlane'
      },
      {
        id: 'evt-3-2',
        tagId: 'nfc-tag-3',
        type: 'write_started',
        title: 'Gravação iniciada',
        description: 'Preparação do NDEF Message Container.',
        timestamp: '2026-10-15T10:04:20Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-3-3',
        tagId: 'nfc-tag-3',
        type: 'write_completed',
        title: 'Gravação concluída',
        description: 'URL gravada com sucesso.',
        timestamp: '2026-10-15T10:05:00Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-3-4',
        tagId: 'nfc-tag-3',
        type: 'verified',
        title: 'Conteúdo verificado',
        description: 'Leitura de teste efetuada com sucesso.',
        timestamp: '2026-10-15T10:05:25Z',
        actor: 'TapMenu NFC Studio'
      }
    ]
  },
  {
    id: 'nfc-tag-4',
    uid: '04:1B:64:E0:9F:8A:80',
    tagType: 'NXP NTAG213 (180 Bytes)',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    restaurantName: 'Sabores Maputo',
    tableId: 'tbl-4',
    tableNumber: '04',
    targetUrl: '/menu/sabores-maputo/04',
    status: 'locked',
    isLocked: true,
    createdAt: '2026-10-15T10:15:00Z',
    writtenAt: '2026-10-15T10:18:00Z',
    lockedAt: '2026-10-15T10:20:00Z',
    scanCount: 84,
    lastScannedAt: '2026-10-16T10:15:00Z',
    ndefRecordType: 'URI (Well-Known Type \'U\' - 0x55)',
    ndefPrefix: '0x04 (https://)',
    ndefPayload: 'https://tapmenu.co.mz/menu/sabores-maputo/04',
    ndefSize: 64,
    timeline: [
      {
        id: 'evt-4-1',
        tagId: 'nfc-tag-4',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Etiqueta associada à Mesa 04 da Esplanada.',
        timestamp: '2026-10-15T10:15:00Z',
        actor: 'Admin Rui Mondlane'
      },
      {
        id: 'evt-4-2',
        tagId: 'nfc-tag-4',
        type: 'write_started',
        title: 'Gravação iniciada',
        description: 'Inicialização de gravação NDEF.',
        timestamp: '2026-10-15T10:17:30Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-4-3',
        tagId: 'nfc-tag-4',
        type: 'write_completed',
        title: 'Gravação concluída',
        description: 'URL do menu gravada com sucesso.',
        timestamp: '2026-10-15T10:18:00Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-4-4',
        tagId: 'nfc-tag-4',
        type: 'verified',
        title: 'Conteúdo verificado',
        description: 'Dados validados com leitor de bancada.',
        timestamp: '2026-10-15T10:18:40Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-4-5',
        tagId: 'nfc-tag-4',
        type: 'locked',
        title: 'Etiqueta bloqueada',
        description: 'Proteção permanente ativada contra alterações.',
        timestamp: '2026-10-15T10:20:00Z',
        actor: 'Admin Rui Mondlane'
      },
      {
        id: 'evt-4-6',
        tagId: 'nfc-tag-4',
        type: 'write_rejected',
        title: 'Tentativa de alteração recusada',
        description: 'Tentativa de sobrescrita de URL rejeitada pelo sistema de segurança. A etiqueta está bloqueada e protegida contra escrita.',
        timestamp: '2026-10-16T14:22:10Z',
        actor: 'Terminal Móvel de Serviço'
      }
    ]
  },
  {
    id: 'nfc-tag-5',
    uid: '04:C3:77:1A:60:55:80',
    tagType: 'NXP NTAG213 (180 Bytes)',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    restaurantName: 'Sabores Maputo',
    tableId: 'tbl-5',
    tableNumber: '05',
    targetUrl: '/menu/sabores-maputo/05',
    status: 'unprogrammed',
    isLocked: false,
    createdAt: '2026-10-16T08:00:00Z',
    scanCount: 0,
    timeline: [
      {
        id: 'evt-5-1',
        tagId: 'nfc-tag-5',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Etiqueta virgem alocada para a Mesa 05. Aguarda gravação inicial.',
        timestamp: '2026-10-16T08:00:00Z',
        actor: 'Admin Rui Mondlane'
      }
    ]
  },
  {
    id: 'nfc-tag-6',
    uid: '04:2D:99:EE:31:88:80',
    tagType: 'NXP NTAG213 (180 Bytes)',
    tenantId: 'tenant-1',
    restaurantId: 'rest-1',
    restaurantName: 'Sabores Maputo',
    tableId: 'tbl-6',
    tableNumber: '06',
    targetUrl: '/menu/sabores-maputo/06',
    status: 'unprogrammed',
    isLocked: false,
    createdAt: '2026-10-16T08:15:00Z',
    scanCount: 0,
    timeline: [
      {
        id: 'evt-6-1',
        tagId: 'nfc-tag-6',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Etiqueta virgem alocada para a Mesa 06 (Varanda Lounge).',
        timestamp: '2026-10-16T08:15:00Z',
        actor: 'Admin Rui Mondlane'
      }
    ]
  },
  {
    id: 'nfc-tag-7',
    uid: '04:3F:82:54:D0:6B:80',
    tagType: 'NXP NTAG213 (180 Bytes)',
    tenantId: 'tenant-1',
    restaurantId: 'rest-2',
    restaurantName: 'Sabores Matola',
    tableId: 'tbl-201',
    tableNumber: 'M1',
    targetUrl: '/menu/sabores-matola/M1',
    status: 'locked',
    isLocked: true,
    createdAt: '2026-10-14T11:00:00Z',
    writtenAt: '2026-10-14T11:05:00Z',
    lockedAt: '2026-10-14T11:10:00Z',
    scanCount: 65,
    lastScannedAt: '2026-10-16T09:40:00Z',
    ndefRecordType: 'URI (Well-Known Type \'U\' - 0x55)',
    ndefPrefix: '0x04 (https://)',
    ndefPayload: 'https://tapmenu.co.mz/menu/sabores-matola/M1',
    ndefSize: 62,
    timeline: [
      {
        id: 'evt-7-1',
        tagId: 'nfc-tag-7',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Etiqueta registada na filial Sabores Matola.',
        timestamp: '2026-10-14T11:00:00Z',
        actor: 'Gerente Matola'
      },
      {
        id: 'evt-7-2',
        tagId: 'nfc-tag-7',
        type: 'write_started',
        title: 'Gravação iniciada',
        description: 'Gravação iniciada no ponto de acesso M1.',
        timestamp: '2026-10-14T11:04:30Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-7-3',
        tagId: 'nfc-tag-7',
        type: 'write_completed',
        title: 'Gravação concluída',
        description: 'Registo NDEF gravado com sucesso.',
        timestamp: '2026-10-14T11:05:00Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-7-4',
        tagId: 'nfc-tag-7',
        type: 'verified',
        title: 'Conteúdo verificado',
        description: 'Validação de integridade sem anomalias.',
        timestamp: '2026-10-14T11:05:30Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-7-5',
        tagId: 'nfc-tag-7',
        type: 'locked',
        title: 'Etiqueta bloqueada',
        description: 'Etiqueta bloqueada permanentemente antes da instalação na mesa exterior.',
        timestamp: '2026-10-14T11:10:00Z',
        actor: 'Gerente Matola'
      }
    ]
  },
  {
    id: 'nfc-tag-8',
    uid: '04:90:1C:7B:A8:12:80',
    tagType: 'NXP NTAG216 (924 Bytes)',
    tenantId: 'tenant-2',
    restaurantId: 'rest-4',
    restaurantName: 'Ocean Restaurant & Lounge',
    tableId: 'tbl-401',
    tableNumber: 'O-01',
    targetUrl: '/menu/ocean-restaurant/O-01',
    status: 'programmed',
    isLocked: false,
    createdAt: '2026-10-14T14:00:00Z',
    writtenAt: '2026-10-14T14:06:00Z',
    scanCount: 42,
    lastScannedAt: '2026-10-16T10:10:00Z',
    ndefRecordType: 'URI (Well-Known Type \'U\' - 0x55)',
    ndefPrefix: '0x04 (https://)',
    ndefPayload: 'https://tapmenu.co.mz/menu/ocean-restaurant/O-01',
    ndefSize: 66,
    timeline: [
      {
        id: 'evt-8-1',
        tagId: 'nfc-tag-8',
        type: 'created',
        title: 'Etiqueta criada',
        description: 'Tag de alta capacidade NTAG216 configurada para Deck Baía Mar.',
        timestamp: '2026-10-14T14:00:00Z',
        actor: 'David Matsinhe'
      },
      {
        id: 'evt-8-2',
        tagId: 'nfc-tag-8',
        type: 'write_started',
        title: 'Gravação iniciada',
        description: 'Escrita de payload NDEF URI no chip.',
        timestamp: '2026-10-14T14:05:20Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-8-3',
        tagId: 'nfc-tag-8',
        type: 'write_completed',
        title: 'Gravação concluída',
        description: 'Dados gravados no chip com sucesso.',
        timestamp: '2026-10-14T14:06:00Z',
        actor: 'TapMenu NFC Studio'
      },
      {
        id: 'evt-8-4',
        tagId: 'nfc-tag-8',
        type: 'verified',
        title: 'Conteúdo verificado',
        description: 'Verificação com leitor móvel OK.',
        timestamp: '2026-10-14T14:06:40Z',
        actor: 'TapMenu NFC Studio'
      }
    ]
  }
]

export const useNfcStore = defineStore('nfc', () => {
  const toastStore = useToastStore()
  const tags = ref<NfcTag[]>([])
  const isLoaded = ref(false)

  const loadTags = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          tags.value = parsed
          isLoaded.value = true
          return
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar etiquetas NFC do storage', e)
    }

    tags.value = JSON.parse(JSON.stringify(initialTags))
    saveToStorage()
    isLoaded.value = true
  }

  const saveToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tags.value))
    } catch (e) {
      console.error('Erro ao guardar etiquetas NFC', e)
    }
  }

  const resetToDefault = () => {
    tags.value = JSON.parse(JSON.stringify(initialTags))
    saveToStorage()
    toastStore.success('Demonstração Reiniciada', 'Todas as etiquetas NFC foram repostas aos dados padrão.')
  }

  const getTagById = (id: string): NfcTag | undefined => {
    return tags.value.find(t => t.id === id)
  }

  const getTagByTable = (restaurantId: string, tableId: string): NfcTag | undefined => {
    return tags.value.find(t => t.restaurantId === restaurantId && t.tableId === tableId)
  }

  // Simulation: Write NFC Tag
  const writeTag = (params: {
    tagId?: string
    restaurantId: string
    restaurantName: string
    tenantId: string
    tableId: string
    tableNumber: string
    targetUrl: string
    tagType?: string
    actor?: string
  }): { success: boolean; tag?: NfcTag; message?: string } => {
    const actor = params.actor || 'TapMenu NFC Studio'
    const now = new Date().toISOString()
    const fullPayload = typeof window !== 'undefined'
      ? `${window.location.origin}${params.targetUrl}`
      : `https://tapmenu.co.mz${params.targetUrl}`

    // Check if target tag is existing and locked
    let target = params.tagId ? getTagById(params.tagId) : getTagByTable(params.restaurantId, params.tableId)

    if (target && target.isLocked) {
      // Block! Record rejected attempt in timeline
      recordRefusedModification(target.id, 'Tentativa de alteração de URL rejeitada. A etiqueta está bloqueada permanentemente.')
      return {
        success: false,
        tag: target,
        message: 'Etiqueta protegida — alterações não permitidas. O chip está bloqueado contra escrita por hardware.'
      }
    }

    if (!target) {
      // Create new tag
      const newTag: NfcTag = {
        id: `nfc-tag-${Date.now()}`,
        uid: generateRealisticNfcUid(),
        tagType: params.tagType || 'NXP NTAG213 (180 Bytes)',
        tenantId: params.tenantId,
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        tableId: params.tableId,
        tableNumber: params.tableNumber,
        targetUrl: params.targetUrl,
        status: 'programmed',
        isLocked: false,
        createdAt: now,
        writtenAt: now,
        scanCount: 0,
        ndefRecordType: 'URI (Well-Known Type \'U\' - 0x55)',
        ndefPrefix: '0x04 (https://)',
        ndefPayload: fullPayload,
        ndefSize: calculateNdefUriSize(fullPayload),
        timeline: [
          {
            id: `evt-${Date.now()}-1`,
            tagId: `nfc-tag-${Date.now()}`,
            type: 'created',
            title: 'Etiqueta criada',
            description: `Nova etiqueta NFC alocada para Mesa ${params.tableNumber}.`,
            timestamp: now,
            actor
          },
          {
            id: `evt-${Date.now()}-2`,
            tagId: `nfc-tag-${Date.now()}`,
            type: 'write_started',
            title: 'Gravação iniciada',
            description: 'Transmissão de blocos NDEF TLV iniciada.',
            timestamp: now,
            actor
          },
          {
            id: `evt-${Date.now()}-3`,
            tagId: `nfc-tag-${Date.now()}`,
            type: 'write_completed',
            title: 'Gravação concluída',
            description: `URL gravada: ${params.targetUrl} (${calculateNdefUriSize(fullPayload)} bytes).`,
            timestamp: now,
            actor
          },
          {
            id: `evt-${Date.now()}-4`,
            tagId: `nfc-tag-${Date.now()}`,
            type: 'verified',
            title: 'Conteúdo verificado',
            description: 'Checksum CRC32 validado — Leitura de teste bem-sucedida.',
            timestamp: now,
            actor
          }
        ]
      }
      tags.value.unshift(newTag)
      saveToStorage()
      toastStore.success('Gravação Concluída!', `Etiqueta gravada com sucesso para a Mesa ${params.tableNumber}.`)
      return { success: true, tag: newTag }
    } else {
      // Update existing unlocked tag
      target.targetUrl = params.targetUrl
      target.writtenAt = now
      target.status = 'programmed'
      target.ndefPayload = fullPayload
      target.ndefSize = calculateNdefUriSize(fullPayload)
      target.ndefRecordType = 'URI (Well-Known Type \'U\' - 0x55)'
      target.ndefPrefix = '0x04 (https://)'

      // Add timeline operations
      target.timeline.unshift(
        {
          id: `evt-${Date.now()}-v`,
          tagId: target.id,
          type: 'verified',
          title: 'Conteúdo verificado',
          description: 'Checksum CRC32 validado — Leitura de teste bem-sucedida.',
          timestamp: now,
          actor
        },
        {
          id: `evt-${Date.now()}-wc`,
          tagId: target.id,
          type: 'write_completed',
          title: 'Gravação concluída',
          description: `Novo conteúdo gravado: ${params.targetUrl}.`,
          timestamp: now,
          actor
        },
        {
          id: `evt-${Date.now()}-ws`,
          tagId: target.id,
          type: 'write_started',
          title: 'Gravação iniciada',
          description: 'Regravação de registo NDEF iniciada.',
          timestamp: now,
          actor
        }
      )

      saveToStorage()
      toastStore.success('Gravação Atualizada!', `Etiqueta reprogramada para a Mesa ${target.tableNumber}.`)
      return { success: true, tag: target }
    }
  }

  // Simulation: Lock NFC Tag
  const lockTag = (tagId: string, actor: string = 'Administrador TapMenu'): { success: boolean; tag?: NfcTag; message?: string } => {
    const target = getTagById(tagId)
    if (!target) {
      return { success: false, message: 'Etiqueta não encontrada' }
    }

    if (target.isLocked) {
      return { success: true, tag: target, message: 'A etiqueta já se encontra bloqueada.' }
    }

    const now = new Date().toISOString()
    target.isLocked = true
    target.status = 'locked'
    target.lockedAt = now

    // Add locking event to timeline
    target.timeline.unshift({
      id: `evt-${Date.now()}-lock`,
      tagId: target.id,
      type: 'locked',
      title: 'Etiqueta bloqueada',
      description: 'Lock-bits estáticos e dinâmicos OTP ativados. O chip NTAG foi selado permanentemente em modo apenas leitura.',
      timestamp: now,
      actor
    })

    saveToStorage()
    toastStore.success('Etiqueta Bloqueada!', `A etiqueta da Mesa ${target.tableNumber} está agora protegida permanentemente.`)
    return { success: true, tag: target }
  }

  // Simulation: Unlock/Unprotect NFC Tag for future modifications
  const unlockTag = (tagId: string, actor: string = 'Administrador TapMenu'): { success: boolean; tag?: NfcTag; message?: string } => {
    const target = getTagById(tagId)
    if (!target) {
      return { success: false, message: 'Etiqueta não encontrada' }
    }

    if (!target.isLocked) {
      return { success: true, tag: target, message: 'A etiqueta já se encontra desprotegida.' }
    }

    const now = new Date().toISOString()
    target.isLocked = false
    target.status = target.writtenAt ? 'programmed' : 'unprogrammed'
    target.lockedAt = undefined

    // Add unlocking event to timeline
    target.timeline.unshift({
      id: `evt-${Date.now()}-unlock`,
      tagId: target.id,
      type: 'unlocked',
      title: 'Etiqueta desprotegida',
      description: 'Proteção de escrita removida com autorização de administrador (PWD AUTH). Modo Read/Write reativado para futuras alterações.',
      timestamp: now,
      actor
    })

    saveToStorage()
    toastStore.success('Etiqueta Desprotegida!', `A Mesa ${target.tableNumber} pode agora ser regravada ou editada.`)
    return { success: true, tag: target }
  }

  // Record a refused modification attempt on a locked tag
  const recordRefusedModification = (tagId: string, reason?: string, actor: string = 'Terminal de Serviço'): void => {
    const target = getTagById(tagId)
    if (!target) return

    const now = new Date().toISOString()
    target.timeline.unshift({
      id: `evt-${Date.now()}-rej`,
      tagId: target.id,
      type: 'write_rejected',
      title: 'Tentativa de alteração recusada',
      description: reason || 'Tentativa de alteração recusada: O chip NFC está bloqueado e protegido contra escrita. Alteração impedida pelo sistema.',
      timestamp: now,
      actor
    })

    saveToStorage()
    toastStore.error('Alteração Recusada', 'Etiqueta protegida — alterações não permitidas.')
  }

  // Global Timeline across all tags
  const allTimelineEvents = computed(() => {
    const events: Array<NfcTimelineEvent & { tagUid: string; tableNumber: string; restaurantName: string }> = []
    tags.value.forEach(tag => {
      tag.timeline.forEach(evt => {
        events.push({
          ...evt,
          tagUid: tag.uid,
          tableNumber: tag.tableNumber,
          restaurantName: tag.restaurantName
        })
      })
    })
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  })

  // Summary Metrics
  const metrics = computed(() => {
    const total = tags.value.length
    const programmed = tags.value.filter(t => t.status === 'programmed').length
    const locked = tags.value.filter(t => t.isLocked).length
    const unprogrammed = tags.value.filter(t => t.status === 'unprogrammed').length
    const totalScans = tags.value.reduce((acc, t) => acc + (t.scanCount || 0), 0)

    return {
      total,
      programmed,
      locked,
      unprogrammed,
      totalScans
    }
  })

  return {
    tags,
    isLoaded,
    loadTags,
    saveToStorage,
    resetToDefault,
    getTagById,
    getTagByTable,
    writeTag,
    lockTag,
    unlockTag,
    recordRefusedModification,
    allTimelineEvents,
    metrics
  }
})

