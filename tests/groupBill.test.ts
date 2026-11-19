import { describe, it, expect } from 'vitest'
import { avatarColor, AVATAR_COLORS, initials, previewAmount, selectionAmount, type SessionBill } from '../src/domain/groupBill'
import { describeCustomerEvent, type CustomerEvent } from '../src/domain/customerNotifications'

const bill: SessionBill = {
  sessionId: 's1',
  status: 'active',
  meParticipantId: 'joao',
  totals: { total: 1650, paid: 500, reserved: 0, outstanding: 1150, pending: 1150 },
  equalShare: 383.33,
  equalPayers: 3,
  participants: [
    { id: 'joao', name: 'João', isPrimary: true, active: true, isMe: true, consumption: 550, paid: 0, reserved: 0, pending: 550, outstanding: 550 },
    { id: 'maria', name: 'Maria', isPrimary: false, active: true, isMe: false, consumption: 500, paid: 500, reserved: 0, pending: 0, outstanding: 0 }
  ],
  lines: [
    { itemId: 'i1', orderId: 'o1', orderCode: '#1', orderStatus: 'delivered', participantId: 'joao', productName: 'Hambúrguer', quantity: 1, unitPrice: 450, itemTotal: 450, due: 450, paid: 0, reserved: 0, outstanding: 450 },
    { itemId: 'i2', orderId: 'o1', orderCode: '#1', orderStatus: 'delivered', participantId: 'joao', productName: 'Coca-Cola', quantity: 3, unitPrice: 100, itemTotal: 300, due: 300, paid: 0, reserved: 0, outstanding: 300 },
    { itemId: 'i3', orderId: 'o2', orderCode: '#2', orderStatus: 'delivered', participantId: 'maria', productName: 'Pizza', quantity: 1, unitPrice: 400, itemTotal: 400, due: 400, paid: 400, reserved: 0, outstanding: 0 }
  ],
  payments: []
}

describe('Modo Grupo — pré-visualização da conta', () => {
  it('o meu consumo, parte igual e conta toda vêm dos valores do servidor', () => {
    expect(previewAmount(bill, 'own')).toBe(550)
    expect(previewAmount(bill, 'equal')).toBe(383.33)
    expect(previewAmount(bill, 'all')).toBe(1150)
  })

  it('escolher produtos: quantidade parcial paga a parte proporcional; item pago não conta', () => {
    expect(selectionAmount(bill, [{ itemId: 'i2', quantity: 1 }])).toBe(100)
    expect(selectionAmount(bill, [{ itemId: 'i2', quantity: 3 }, { itemId: 'i1', quantity: 1 }])).toBe(750)
    expect(selectionAmount(bill, [{ itemId: 'i3', quantity: 1 }])).toBe(0)
    expect(selectionAmount(bill, [{ itemId: 'desconhecido', quantity: 1 }])).toBe(0)
  })

  it('avatar: cor escolhida ou uma cor estável derivada do id; iniciais do nome', () => {
    expect(avatarColor({ id: 'x', avatar: 'rose' })).toBe(AVATAR_COLORS.rose)
    expect(avatarColor({ id: 'abc' })).toBe(avatarColor({ id: 'abc' }))
    expect(Object.values(AVATAR_COLORS)).toContain(avatarColor({ id: 'abc' }))
    expect(initials('Maria José Silva')).toBe('MS')
    expect(initials('Ana')).toBe('A')
  })
})

describe('Modo Grupo — avisos por participante', () => {
  const ev = (over: Partial<CustomerEvent>): CustomerEvent => ({
    eventId: 'e1',
    type: 'order.status_changed',
    sessionId: 's1',
    occurredAt: new Date().toISOString(),
    orderId: 'o1',
    orderCode: '#1042',
    status: 'preparing',
    ...over
  })

  it('o meu pedido: aviso completo com som', () => {
    const c = describeCustomerEvent(ev({ participantId: 'joao' }), 'joao')
    expect(c?.title).toBe('Pedido em preparação · #1042')
    expect(c?.alert).toBe(true)
  })

  it('pedido de outra pessoa: só "pedido da mesa pronto", sem som', () => {
    expect(describeCustomerEvent(ev({ participantId: 'maria' }), 'joao')).toBeNull()
    const ready = describeCustomerEvent(ev({ participantId: 'maria', status: 'ready' }), 'joao')
    expect(ready?.title).toBe('Pedido da mesa pronto · #1042')
    expect(ready?.alert).toBe(false)
  })

  it('pagamento confirmado: com som para quem pagou; discreto para os outros', () => {
    const mine = describeCustomerEvent(ev({ type: 'payment.confirmed', participantId: 'joao' }), 'joao')
    expect(mine?.message).toContain('O seu pagamento')
    expect(mine?.alert).toBe(true)
    const others = describeCustomerEvent(ev({ type: 'payment.confirmed', participantId: 'maria' }), 'joao')
    expect(others?.title).toBe('Conta da mesa atualizada')
    expect(others?.alert).toBe(false)
  })

  it('conta atualizada não mostra aviso (só recarrega a conta)', () => {
    expect(describeCustomerEvent(ev({ type: 'bill.updated' }), 'joao')).toBeNull()
  })
})
