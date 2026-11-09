import { mockStorage } from './mockStorage'
import type { INfcTagRepository, RegisterNfcTagsInput } from '../interfaces'
import type { NfcTag, NfcTagEvent, NfcTagStatus, Table } from '@/types'
import { buildTablePath } from '@/domain/publicUrl'
import { DomainError } from '@/domain/errors'
import {
  NFC_TAG_CODE_PATTERN,
  NFC_TAG_STATUS_LABELS,
  canPerform,
  nextTagCode,
  statusAfterAssociation
} from '@/domain/nfcTagRules'

/**
 * Registo administrativo de etiquetas NFC (mock que imita o backend).
 * Nenhum método comunica com hardware — o TapMenu não grava etiquetas.
 */

const nowIso = () => new Date().toISOString()
const tableLabel = (table: Pick<Table, 'number'>) => `Mesa ${table.number}`

function findTagOrThrow(id: string): NfcTag {
  const tag = mockStorage.getDb().nfcTags.find(t => t.id === id)
  if (!tag) throw new DomainError('tag_not_found', 'Etiqueta não encontrada.')
  return tag
}

function pathForTable(table: Table): string {
  const restaurant = mockStorage.getDb().restaurants.find(r => r.id === table.restaurantId)
  if (!restaurant) throw new DomainError('restaurant_not_found', 'Restaurante da mesa não encontrado.')
  return buildTablePath(restaurant.slug, table.slug)
}

function pushEvent(tag: NfcTag, event: Omit<NfcTagEvent, 'id' | 'tagId' | 'createdAt'>, at = nowIso()) {
  mockStorage.getDb().nfcTagEvents.push({
    id: `nfe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tagId: tag.id,
    createdAt: at,
    ...event
  })
  tag.updatedAt = at
}

function setStatus(tag: NfcTag, status: NfcTagStatus): { fromStatus: NfcTagStatus; toStatus: NfcTagStatus } {
  const fromStatus = tag.status
  tag.status = status
  return { fromStatus, toStatus: status }
}

function assertAllowed(tag: NfcTag, ok: boolean, message: string) {
  if (!ok) throw new DomainError('tag_action_not_allowed', `${tag.code}: ${message} (estado atual: ${NFC_TAG_STATUS_LABELS[tag.status]}).`)
}

/**
 * Remove a associação de todas as etiquetas de uma mesa (ex.: mesa removida).
 * Usado também pelo repositório de mesas — não faz commit.
 */
export function detachTagsFromTable(table: Table, actor: string, reason: string): void {
  for (const tag of mockStorage.getDb().nfcTags.filter(t => t.tableId === table.id)) {
    tag.tableId = undefined
    tag.targetPath = undefined
    const transition = tag.status === 'disabled' ? null : setStatus(tag, statusAfterAssociation(tag.configuredPath, undefined))
    pushEvent(tag, {
      type: 'unassigned',
      actor,
      tableId: table.id,
      tableLabel: tableLabel(table),
      description: `${reason} Associação removida.`,
      ...(transition ?? {})
    })
  }
}

export class MockNfcTagRepository implements INfcTagRepository {
  async getAll(): Promise<NfcTag[]> {
    return mockStorage.getDb().nfcTags.map(t => ({ ...t })).sort((a, b) => a.code.localeCompare(b.code))
  }

  async getByRestaurant(restaurantId: string): Promise<NfcTag[]> {
    return (await this.getAll()).filter(t => t.restaurantId === restaurantId)
  }

  async getById(id: string): Promise<NfcTag | null> {
    const tag = mockStorage.getDb().nfcTags.find(t => t.id === id)
    return tag ? { ...tag } : null
  }

  async getByTable(tableId: string): Promise<NfcTag | null> {
    const tag = mockStorage.getDb().nfcTags.find(t => t.tableId === tableId && t.status !== 'disabled')
    return tag ? { ...tag } : null
  }

  async getHistory(tagId: string): Promise<NfcTagEvent[]> {
    return mockStorage
      .getDb()
      .nfcTagEvents.filter(e => e.tagId === tagId)
      .map(e => ({ ...e }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async register(input: RegisterNfcTagsInput, actor: string): Promise<NfcTag[]> {
    const db = mockStorage.getDb()
    const restaurant = db.restaurants.find(r => r.id === input.restaurantId)
    if (!restaurant) throw new DomainError('restaurant_not_found', 'Restaurante não encontrado.')

    const existing = new Set(db.nfcTags.map(t => t.code))
    let codes = (input.codes ?? []).map(c => c.trim().toUpperCase()).filter(Boolean)
    if (codes.length === 0) {
      const quantity = input.quantity ?? 1
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        throw new DomainError('tag_quantity_invalid', 'Indique uma quantidade entre 1 e 100.')
      }
      codes = []
      const taken = new Set(existing)
      for (let i = 0; i < quantity; i++) {
        const code = nextTagCode(taken)
        taken.add(code)
        codes.push(code)
      }
    }

    const invalid = codes.filter(c => !NFC_TAG_CODE_PATTERN.test(c))
    if (invalid.length) throw new DomainError('tag_code_invalid', `Código inválido: ${invalid.join(', ')}. Use o formato TAG-00017.`)
    const duplicated = codes.filter((c, i) => existing.has(c) || codes.indexOf(c) !== i)
    if (duplicated.length) throw new DomainError('tag_code_taken', `Código já registado: ${[...new Set(duplicated)].join(', ')}.`)

    const now = nowIso()
    const created = codes.map((code, i) => {
      const tag: NfcTag = {
        id: `nfc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        code,
        tenantId: restaurant.tenantId,
        restaurantId: restaurant.id,
        status: 'pending',
        notes: input.notes?.trim() || undefined,
        createdAt: now,
        updatedAt: now
      }
      db.nfcTags.push(tag)
      pushEvent(tag, { type: 'registered', actor, toStatus: 'pending', description: `Etiqueta registada para ${restaurant.name}.` }, now)
      return { ...tag }
    })
    mockStorage.commit()
    return created
  }

  async assign(tagId: string, tableId: string, actor: string): Promise<NfcTag> {
    const db = mockStorage.getDb()
    const tag = findTagOrThrow(tagId)
    assertAllowed(tag, tag.status !== 'disabled', 'reative a etiqueta antes de a associar')

    const table = db.tables.find(t => t.id === tableId)
    if (!table) throw new DomainError('table_not_found', 'Mesa não encontrada.')
    if (table.restaurantId !== tag.restaurantId) {
      throw new DomainError('tag_wrong_restaurant', 'A etiqueta e a mesa pertencem a restaurantes diferentes.')
    }
    if (tag.tableId === table.id) return { ...tag }

    const other = db.nfcTags.find(t => t.id !== tag.id && t.tableId === table.id && t.status !== 'disabled')
    if (other) {
      throw new DomainError('table_has_tag', `A ${tableLabel(table)} já tem a etiqueta ${other.code}. Desassocie-a primeiro.`)
    }

    const previousTable = tag.tableId ? db.tables.find(t => t.id === tag.tableId) : undefined
    const path = pathForTable(table)
    tag.tableId = table.id
    tag.targetPath = path
    const transition = setStatus(tag, statusAfterAssociation(tag.configuredPath, path))

    const needsRewrite = transition.toStatus === 'reassignment_pending'
    pushEvent(tag, {
      type: previousTable ? 'association_changed' : 'associated',
      actor,
      tableId: table.id,
      tableLabel: tableLabel(table),
      path,
      ...transition,
      description: previousTable
        ? `Associação alterada da ${tableLabel(previousTable)} para a ${tableLabel(table)}.${needsRewrite ? ' A etiqueta tem de ser regravada pela equipa TapMenu.' : ''}`
        : `Associada à ${tableLabel(table)}.${needsRewrite ? ' A URL gravada é de outra mesa — regravação necessária.' : ''}`
    })
    mockStorage.commit()
    return { ...tag }
  }

  async unassign(tagId: string, actor: string): Promise<NfcTag> {
    const tag = findTagOrThrow(tagId)
    assertAllowed(tag, canPerform(tag, 'unassign'), 'a etiqueta não tem mesa associada')
    const table = mockStorage.getDb().tables.find(t => t.id === tag.tableId)
    tag.tableId = undefined
    tag.targetPath = undefined
    const transition = setStatus(tag, statusAfterAssociation(tag.configuredPath, undefined))
    pushEvent(tag, {
      type: 'unassigned',
      actor,
      tableId: table?.id,
      tableLabel: table ? tableLabel(table) : undefined,
      ...transition,
      description: `Associação à ${table ? tableLabel(table) : 'mesa'} removida.`
    })
    mockStorage.commit()
    return { ...tag }
  }

  async markConfigured(tagId: string, actor: string, notes?: string): Promise<NfcTag> {
    const tag = findTagOrThrow(tagId)
    assertAllowed(tag, canPerform(tag, 'mark_configured'), 'não pode ser marcada como configurada')
    if (!tag.targetPath) throw new DomainError('tag_without_table', 'Associe a etiqueta a uma mesa antes de registar a configuração.')

    const at = nowIso()
    tag.configuredPath = tag.targetPath
    tag.configuredAt = at
    tag.configuredBy = actor
    const transition = setStatus(tag, 'configured')
    pushEvent(
      tag,
      {
        type: 'configured',
        actor,
        tableId: tag.tableId,
        path: tag.targetPath,
        ...transition,
        description: `Configuração física registada: a equipa TapMenu indicou que gravou ${tag.targetPath} com uma aplicação externa.${notes?.trim() ? ` Nota: ${notes.trim()}` : ''}`
      },
      at
    )
    mockStorage.commit()
    return { ...tag }
  }

  async activate(tagId: string, actor: string): Promise<NfcTag> {
    const tag = findTagOrThrow(tagId)
    assertAllowed(tag, canPerform(tag, 'activate'), 'só etiquetas configuradas podem ser ativadas')
    const transition = setStatus(tag, 'active')
    pushEvent(tag, { type: 'activated', actor, tableId: tag.tableId, ...transition, description: 'Instalação na mesa confirmada. Etiqueta em uso.' })
    mockStorage.commit()
    return { ...tag }
  }

  async disable(tagId: string, actor: string, reason?: string): Promise<NfcTag> {
    const tag = findTagOrThrow(tagId)
    assertAllowed(tag, canPerform(tag, 'disable'), 'já está desativada')
    const table = mockStorage.getDb().tables.find(t => t.id === tag.tableId)
    tag.tableId = undefined
    tag.targetPath = undefined
    if (reason?.trim()) tag.notes = reason.trim()
    const transition = setStatus(tag, 'disabled')
    pushEvent(tag, {
      type: 'disabled',
      actor,
      tableId: table?.id,
      tableLabel: table ? tableLabel(table) : undefined,
      ...transition,
      description: `Desativada${reason?.trim() ? `: ${reason.trim()}` : '.'}${table ? ` Deixou de estar associada à ${tableLabel(table)}.` : ''}`
    })
    mockStorage.commit()
    return { ...tag }
  }

  async reactivate(tagId: string, actor: string): Promise<NfcTag> {
    const tag = findTagOrThrow(tagId)
    assertAllowed(tag, canPerform(tag, 'reactivate'), 'não está desativada')
    const transition = setStatus(tag, statusAfterAssociation(tag.configuredPath, undefined))
    pushEvent(tag, {
      type: 'reactivated',
      actor,
      ...transition,
      description: tag.configuredPath
        ? 'Reativada. Contém uma URL antiga — associe-a a uma mesa e solicite a regravação.'
        : 'Reativada. Pronta para ser associada a uma mesa.'
    })
    mockStorage.commit()
    return { ...tag }
  }
}
