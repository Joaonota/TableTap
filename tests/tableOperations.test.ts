import { describe, it, expect } from 'vitest'
import {
  eventText,
  pendingOrders,
  sessionDuration,
  tableAlerts,
  tableLabel,
  tableState,
  type TableOperation
} from '../src/domain/tableOperations'
import type { ServiceRequest } from '../src/types'

const NOW = new Date('2026-11-20T19:00:00Z')
const ago = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString()

const orders = (o: Partial<TableOperation['orders']> = {}): TableOperation['orders'] => ({
  count: 0, received: 0, confirmed: 0, preparing: 0, ready: 0, delivered: 0, unpaid: 0, total: 0, ...o
})
const table = (o: Partial<TableOperation> = {}): TableOperation => ({
  id: 't1', number: '7', name: '', area: 'Sala', capacity: 4, status: 'occupied',
  session: { id: 's1', startedAt: ago(40), participants: 3 },
  orders: orders(), requests: [], assignments: [
    { id: 'a1', tableId: 't1', staffId: 'carlos', staffName: 'Carlos', role: 'primary', dutyStatus: 'on_duty', hasAccount: true, assignedAt: ago(60) }
  ],
  ...o
})
const request = (o: Partial<ServiceRequest> = {}): ServiceRequest => ({
  id: 'r1', tenantId: 'c', restaurantId: 'r', tableId: 't1', tableNumber: '7', type: 'waiter_call', status: 'new',
  createdAt: ago(1), responsibleStaffId: 'carlos', responsibleName: 'Carlos', ...o
})

describe('Sala — estado da mesa', () => {
  it('livre sem sessão; indisponível se marcada assim', () => {
    expect(tableState(table({ session: undefined, status: 'free' }), NOW)).toBe('free')
    expect(tableState(table({ session: undefined, status: 'unavailable' }), NOW)).toBe('unavailable')
  })

  it('a chamada pendente é o mais urgente', () => {
    const t = table({ requests: [request()], orders: orders({ count: 1, ready: 1, oldestReadyAt: ago(1) }) })
    expect(tableState(t, NOW)).toBe('request_pending')
  })

  it('pedido pronto há 5+ min → aguardando entrega; antes disso → pedido pronto', () => {
    expect(tableState(table({ orders: orders({ count: 1, ready: 1, oldestReadyAt: ago(6) }) }), NOW)).toBe('awaiting_delivery')
    expect(tableState(table({ orders: orders({ count: 1, ready: 1, oldestReadyAt: ago(2) }) }), NOW)).toBe('ready')
  })

  it('conta solicitada, aguardando atendimento, em preparação, finalizada, ocupada', () => {
    expect(tableState(table({ session: { id: 's', startedAt: ago(5), participants: 1, billRequestedAt: ago(1) } }), NOW)).toBe('bill_requested')
    expect(tableState(table({ orders: orders({ count: 1, received: 1 }) }), NOW)).toBe('awaiting_service')
    expect(tableState(table({ orders: orders({ count: 2, preparing: 1, delivered: 1 }) }), NOW)).toBe('preparing')
    expect(tableState(table({ orders: orders({ count: 2, delivered: 2, unpaid: 0 }) }), NOW)).toBe('finished')
    expect(tableState(table({ orders: orders({ count: 2, delivered: 2, unpaid: 1 }) }), NOW)).toBe('occupied')
  })

  it('pedidos por entregar somam recebidos, confirmados, em preparação e prontos', () => {
    expect(pendingOrders(table({ orders: orders({ received: 1, confirmed: 1, preparing: 2, ready: 1, delivered: 4 }) }))).toBe(5)
  })
})

describe('Sala — alertas', () => {
  it('chamada sem "recebido" há 2+ min', () => {
    const a = tableAlerts(table({ requests: [request({ createdAt: ago(3) })] }), NOW)
    expect(a.map(x => x.kind)).toContain('request_waiting')
    const ok = tableAlerts(table({ requests: [request({ createdAt: ago(3), acknowledgedAt: ago(2) })] }), NOW)
    expect(ok.map(x => x.kind)).not.toContain('request_waiting')
  })

  it('mesa ocupada sem responsável; responsável fora de serviço', () => {
    expect(tableAlerts(table({ assignments: [] }), NOW)[0]?.kind).toBe('no_responsible')
    const away = table()
    away.assignments[0]!.dutyStatus = 'on_break'
    const alert = tableAlerts(away, NOW).find(x => x.kind === 'responsible_away')
    expect(alert?.text).toBe('Carlos está em pausa')
    expect(alert?.severity).toBe('high')
  })

  it('mesa livre sem responsável não gera alerta', () => {
    expect(tableAlerts(table({ session: undefined, assignments: [] }), NOW)).toEqual([])
  })
})

describe('Sala — textos', () => {
  it('histórico legível', () => {
    const base = { id: 'e', actorName: 'Gerente', createdAt: ago(0) }
    expect(eventText({ ...base, event: 'assigned', staffName: 'João' }, 'Mesa 12')).toBe('João assumiu Mesa 12')
    expect(eventText({ ...base, event: 'transferred', staffName: 'Carlos', fromStaffName: 'João' }, 'Mesa 12')).toBe(
      'Mesa 12 transferida de João para Carlos'
    )
    expect(eventText({ ...base, event: 'request_completed', staffName: 'Carlos' }, 'Mesa 12')).toBe('Carlos concluiu atendimento')
  })

  it('duração da sessão e nome da mesa', () => {
    expect(sessionDuration(ago(40), NOW)).toBe('40 min')
    expect(sessionDuration(ago(95), NOW)).toBe('1 h 35')
    expect(tableLabel({ number: '5', name: '' })).toBe('Mesa 5')
    expect(tableLabel({ number: '5', name: 'Varanda' })).toBe('Mesa 5 · Varanda')
  })
})
