import { mockStorage } from './mockStorage'
import type { ITableRepository, TableInput } from '../interfaces'
import type { Table } from '@/types'
import { generateTableSlug } from '@/domain/publicUrl'
import { canSetManualStatus } from '@/domain/tableRules'
import { DomainError } from '@/domain/errors'
import { detachTagsFromTable } from './nfcTagRepository'

const nowIso = () => new Date().toISOString()

function findOrThrow(id: string): Table {
  const table = mockStorage.getDb().tables.find(t => t.id === id)
  if (!table) throw new DomainError('table_not_found', 'Mesa não encontrada.')
  return table
}

function validateInput(restaurantId: string, input: Partial<TableInput>, ignoreId?: string) {
  if (input.number !== undefined) {
    const number = input.number.trim()
    if (!number) throw new DomainError('table_number_required', 'O número da mesa é obrigatório.')
    const duplicated = mockStorage
      .getDb()
      .tables.some(t => t.restaurantId === restaurantId && t.id !== ignoreId && t.number.toLowerCase() === number.toLowerCase())
    if (duplicated) throw new DomainError('table_number_taken', `Já existe uma mesa com o número ${number}.`)
  }
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 50)) {
    throw new DomainError('table_capacity_invalid', 'A capacidade deve ser um número inteiro entre 1 e 50.')
  }
}

export class MockTableRepository implements ITableRepository {
  async getByRestaurant(restaurantId: string): Promise<Table[]> {
    return mockStorage
      .getDb()
      .tables.filter(t => t.restaurantId === restaurantId)
      .map(t => ({ ...t }))
      .sort((a, b) => a.number.localeCompare(b.number, 'pt', { numeric: true }))
  }

  async getById(id: string): Promise<Table | null> {
    const item = mockStorage.getDb().tables.find(t => t.id === id)
    return item ? { ...item } : null
  }

  async getBySlug(restaurantId: string, slug: string): Promise<Table | null> {
    const item = mockStorage.getDb().tables.find(t => t.restaurantId === restaurantId && t.slug === slug)
    return item ? { ...item } : null
  }

  async getByNumber(restaurantId: string, number: string): Promise<Table | null> {
    const item = mockStorage.getDb().tables.find(t => t.restaurantId === restaurantId && t.number === number)
    return item ? { ...item } : null
  }

  async create(restaurantId: string, input: TableInput): Promise<Table> {
    const db = mockStorage.getDb()
    const restaurant = db.restaurants.find(r => r.id === restaurantId)
    if (!restaurant) throw new DomainError('restaurant_not_found', 'Restaurante não encontrado.')
    validateInput(restaurantId, input)

    const number = input.number.trim()
    const now = nowIso()
    const table: Table = {
      id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId: restaurant.tenantId,
      restaurantId,
      number,
      name: input.name?.trim() || `Mesa ${number}`,
      slug: generateTableSlug(number, db.tables.filter(t => t.restaurantId === restaurantId).map(t => t.slug)),
      area: input.area,
      capacity: input.capacity,
      status: 'free',
      isActive: true,
      createdAt: now,
      updatedAt: now
    }
    db.tables.push(table)
    mockStorage.commit()
    return { ...table }
  }

  async update(id: string, input: Partial<TableInput>): Promise<Table> {
    const table = findOrThrow(id)
    validateInput(table.restaurantId, input, id)
    // O slug nunca muda: a URL gravada na etiqueta continua válida.
    if (input.number !== undefined) table.number = input.number.trim()
    if (input.name !== undefined) table.name = input.name.trim() || `Mesa ${table.number}`
    if (input.area !== undefined) table.area = input.area
    if (input.capacity !== undefined) table.capacity = input.capacity
    table.updatedAt = nowIso()
    mockStorage.commit()
    return { ...table }
  }

  async setStatus(id: string, status: 'free' | 'unavailable'): Promise<Table> {
    const table = findOrThrow(id)
    if (table.status === 'occupied') {
      throw new DomainError('table_has_session', `A Mesa ${table.number} tem uma sessão ativa. Encerre ou cancele a sessão primeiro.`)
    }
    if (!canSetManualStatus(table, status)) return { ...table }
    table.status = status
    table.updatedAt = nowIso()
    mockStorage.commit()
    return { ...table }
  }

  async setActive(id: string, isActive: boolean): Promise<Table> {
    const table = findOrThrow(id)
    if (!isActive && table.status === 'occupied') {
      throw new DomainError('table_has_session', `Não é possível desativar a Mesa ${table.number} com uma sessão ativa.`)
    }
    table.isActive = isActive
    table.updatedAt = nowIso()
    mockStorage.commit()
    return { ...table }
  }

  async delete(id: string, actor: string): Promise<boolean> {
    const db = mockStorage.getDb()
    const index = db.tables.findIndex(t => t.id === id)
    if (index === -1) return false
    const table = db.tables[index]
    if (table.status === 'occupied') {
      throw new DomainError('table_has_session', `Não é possível remover a Mesa ${table.number} com uma sessão ativa.`)
    }
    detachTagsFromTable(table, actor, `Mesa ${table.number} removida.`)
    db.tables.splice(index, 1)
    mockStorage.commit()
    return true
  }
}
