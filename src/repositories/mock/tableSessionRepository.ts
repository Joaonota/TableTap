import { mockStorage } from './mockStorage'
import type { ITableSessionRepository, StartSessionInput } from '../interfaces'
import type { SessionParticipant, Table, TableSession } from '@/types'
import { DomainError } from '@/domain/errors'
import { canStartSession, sumOrderTotals } from '@/domain/tableRules'

/**
 * Sessões de mesa (mock que imita o backend).
 * Invariante: mesa.status === 'occupied' ⇔ existe uma sessão 'active' para ela,
 * referenciada em mesa.activeSessionId.
 */

const nowIso = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

function findSessionOrThrow(id: string): TableSession {
  const session = mockStorage.getDb().tableSessions.find(s => s.id === id)
  if (!session) throw new DomainError('session_not_found', 'Sessão não encontrada.')
  return session
}

function assertActive(session: TableSession) {
  if (session.status !== 'active') {
    throw new DomainError('session_not_active', 'Esta sessão já foi encerrada.')
  }
}

function newParticipant(name: string, isPrimary: boolean): SessionParticipant {
  const trimmed = name.trim()
  if (!trimmed) throw new DomainError('participant_name_required', 'Indique o seu nome.')
  if (trimmed.length > 60) throw new DomainError('participant_name_too_long', 'O nome deve ter no máximo 60 caracteres.')
  return { id: newId('part'), name: trimmed, joinedAt: nowIso(), isPrimary }
}

/** Recalcula o total a partir dos pedidos da sessão (exclui cancelados). */
export function recalculateSessionTotal(session: TableSession): void {
  const orders = mockStorage.getDb().orders.filter(o => session.orderIds.includes(o.id) || o.tableSessionId === session.id)
  session.total = sumOrderTotals(orders)
}

function finishSession(id: string, status: 'closed' | 'cancelled', actor: string, reason?: string): TableSession {
  const db = mockStorage.getDb()
  const session = findSessionOrThrow(id)
  assertActive(session)
  recalculateSessionTotal(session)
  session.status = status
  session.closedAt = nowIso()
  session.closedBy = actor
  if (status === 'cancelled') session.cancelReason = reason?.trim() || undefined

  const table = db.tables.find(t => t.id === session.tableId)
  if (table && table.activeSessionId === session.id) {
    table.status = 'free'
    table.activeSessionId = undefined
    table.updatedAt = session.closedAt
  }
  mockStorage.commit()
  return { ...session }
}

export class MockTableSessionRepository implements ITableSessionRepository {
  async getByRestaurant(restaurantId: string): Promise<TableSession[]> {
    return mockStorage
      .getDb()
      .tableSessions.filter(s => s.restaurantId === restaurantId)
      .map(s => ({ ...s }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async getByTable(tableId: string): Promise<TableSession[]> {
    return mockStorage
      .getDb()
      .tableSessions.filter(s => s.tableId === tableId)
      .map(s => ({ ...s }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async getActiveByTable(tableId: string): Promise<TableSession | null> {
    const session = mockStorage.getDb().tableSessions.find(s => s.tableId === tableId && s.status === 'active')
    return session ? { ...session } : null
  }

  async getById(id: string): Promise<TableSession | null> {
    const session = mockStorage.getDb().tableSessions.find(s => s.id === id)
    return session ? { ...session } : null
  }

  async start(input: StartSessionInput): Promise<{ session: TableSession; participant: SessionParticipant | null }> {
    const db = mockStorage.getDb()
    const table: Table | undefined = db.tables.find(t => t.id === input.tableId)
    if (!table) throw new DomainError('table_not_found', 'Mesa não encontrada.')

    const existing = db.tableSessions.find(s => s.tableId === table.id && s.status === 'active')
    if (existing) {
      throw new DomainError('table_already_occupied', `A Mesa ${table.number} já tem uma sessão ativa.`)
    }
    if (!canStartSession(table)) {
      throw new DomainError('table_unavailable', `A Mesa ${table.number} está indisponível.`)
    }
    if (input.partySize !== undefined && (!Number.isInteger(input.partySize) || input.partySize < 1)) {
      throw new DomainError('party_size_invalid', 'O número de pessoas deve ser pelo menos 1.')
    }

    const participant = input.primaryCustomerName?.trim() ? newParticipant(input.primaryCustomerName, true) : null
    const startedAt = nowIso()
    const session: TableSession = {
      id: newId('sess'),
      tenantId: table.tenantId,
      restaurantId: table.restaurantId,
      tableId: table.id,
      status: 'active',
      startedAt,
      primaryCustomerName: participant?.name,
      participants: participant ? [participant] : [],
      partySize: input.partySize,
      notes: input.notes?.trim() || undefined,
      orderIds: [],
      total: 0
    }
    db.tableSessions.unshift(session)

    table.status = 'occupied'
    table.activeSessionId = session.id
    table.updatedAt = startedAt
    mockStorage.commit()
    return { session: { ...session }, participant }
  }

  async join(sessionId: string, name: string): Promise<{ session: TableSession; participant: SessionParticipant }> {
    const session = findSessionOrThrow(sessionId)
    assertActive(session)
    const participant = newParticipant(name, session.participants.length === 0)
    session.participants.push(participant)
    if (!session.primaryCustomerName) session.primaryCustomerName = participant.name
    mockStorage.commit()
    return { session: { ...session }, participant }
  }

  async addOrder(sessionId: string, orderId: string): Promise<TableSession> {
    const session = findSessionOrThrow(sessionId)
    assertActive(session)
    if (!session.orderIds.includes(orderId)) session.orderIds.push(orderId)
    recalculateSessionTotal(session)
    mockStorage.commit()
    return { ...session }
  }

  async requestBill(sessionId: string): Promise<TableSession> {
    const session = findSessionOrThrow(sessionId)
    assertActive(session)
    session.billRequestedAt = nowIso()
    mockStorage.commit()
    return { ...session }
  }

  async close(sessionId: string, actor: string): Promise<TableSession> {
    return finishSession(sessionId, 'closed', actor)
  }

  async cancel(sessionId: string, actor: string, reason?: string): Promise<TableSession> {
    return finishSession(sessionId, 'cancelled', actor, reason)
  }
}
