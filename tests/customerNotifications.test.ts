import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  describeCustomerEvent,
  orderProgressSteps,
  orderStatusEventId,
  parseCustomerEvent,
  type CustomerEvent
} from '@/domain/customerNotifications'
import type { Order } from '@/types'

// Ambiente de testes é Node: window e localStorage mínimos para a store.
const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear()
  }
})
Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis })

// O canal Realtime e o áudio não existem nos testes: substituídos por dublês.
const channel = vi.hoisted(() => ({ onEvent: null as null | ((p: unknown) => void), topics: [] as string[] }))
vi.mock('@/services', () => ({
  subscribeToCustomerChannel: (token: string, onEvent: (p: unknown) => void) => {
    channel.topics.push(`customer:${token}`)
    channel.onEvent = onEvent
    return () => {
      channel.onEvent = null
    }
  }
}))
const alerts = vi.hoisted(() => ({ count: 0 }))
vi.mock('@/services/customerNotifications', () => ({
  customerNotificationService: {
    getPermission: () => 'default',
    isBrowserNotificationSupported: () => true,
    requestPermission: async () => 'granted',
    playSound: () => true,
    notify: async () => {
      alerts.count++
    }
  }
}))

const { useCustomerNotificationStore } = await import('@/stores/customerNotifications')

const event = (over: Partial<CustomerEvent> = {}): CustomerEvent => ({
  eventId: 'o1:status:preparing',
  type: 'order.status_changed',
  sessionId: 's1',
  occurredAt: new Date().toISOString(),
  orderId: 'o1',
  orderCode: '#1042',
  status: 'preparing',
  previousStatus: 'received',
  ...over
})

describe('Mensagens das notificações', () => {
  it.each([
    ['confirmed', 'Pedido recebido', 'O seu pedido foi recebido e está a ser processado.'],
    ['preparing', 'Pedido em preparação', 'O seu pedido está a ser preparado.'],
    ['ready', 'Pedido pronto', 'O seu pedido está pronto. Aguarde pelo atendimento.'],
    ['delivered', 'Pedido entregue', 'O seu pedido foi entregue.'],
    ['cancelled', 'Pedido cancelado', 'O seu pedido foi cancelado. Consulte os detalhes para mais informações.']
  ])('%s → %s', (status, title, message) => {
    const c = describeCustomerEvent(event({ status, orderCode: undefined }))
    expect(c).toMatchObject({ title, message, alert: true })
  })

  it('inclui o código do pedido no título', () => {
    expect(describeCustomerEvent(event())?.title).toBe('Pedido em preparação · #1042')
  })

  it('o fim da sessão não gera notificação (tem o seu próprio ecrã)', () => {
    expect(describeCustomerEvent(event({ type: 'session.closed', status: 'closed' }))).toBeNull()
  })

  it('recusa payloads inválidos', () => {
    expect(parseCustomerEvent(null)).toBeNull()
    expect(parseCustomerEvent({ type: 'order.status_changed' })).toBeNull()
    expect(parseCustomerEvent({ eventId: 'x', type: 'order.status_changed', sessionId: 's1', status: 5 })?.status).toBeUndefined()
  })
})

describe('Área do pedido (linha do tempo)', () => {
  it('Pronto: recebido e preparação concluídos, pronto em curso, entregue por fazer', () => {
    expect(orderProgressSteps('ready').map(s => s.state)).toEqual(['done', 'done', 'current', 'todo'])
  })
  it('Confirmado conta como Recebido', () => {
    expect(orderProgressSteps('confirmed').map(s => s.state)).toEqual(['current', 'todo', 'todo', 'todo'])
  })
  it('Entregue: todos concluídos', () => {
    expect(orderProgressSteps('delivered').every(s => s.state === 'done')).toBe(true)
  })
})

describe('Store de notificações do cliente', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    alerts.count = 0
    channel.topics = []
  })

  it('subscreve só o canal privado deste dispositivo', () => {
    const store = useCustomerNotificationStore()
    store.start({ sessionId: 's1', participantToken: 'tok-ana' })
    expect(channel.topics).toEqual(['customer:tok-ana'])
  })

  it('o mesmo evento entregue duas vezes gera UMA notificação e UM som', () => {
    const store = useCustomerNotificationStore()
    store.start({ sessionId: 's1', participantToken: 'tok' })
    channel.onEvent?.(event())
    channel.onEvent?.(event())
    expect(store.items).toHaveLength(1)
    expect(alerts.count).toBe(1)
  })

  it('ignora eventos de outra sessão', () => {
    const store = useCustomerNotificationStore()
    store.start({ sessionId: 's1', participantToken: 'tok' })
    channel.onEvent?.(event({ sessionId: 's2', eventId: 'x:status:ready' }))
    expect(store.items).toHaveLength(0)
    expect(alerts.count).toBe(0)
  })

  it('recarregar a página não repete notificações já mostradas', () => {
    const first = useCustomerNotificationStore()
    first.start({ sessionId: 's1', participantToken: 'tok' })
    channel.onEvent?.(event())
    first.stop()
    setActivePinia(createPinia())
    const second = useCustomerNotificationStore()
    second.start({ sessionId: 's1', participantToken: 'tok' })
    channel.onEvent?.(event())
    expect(second.items).toHaveLength(0)
    expect(alerts.count).toBe(1)
  })

  it('reconciliação: pedido novo não notifica; alteração perdida notifica uma vez', () => {
    const store = useCustomerNotificationStore()
    store.start({ sessionId: 's1', participantToken: 'tok' })
    const order = { id: 'o9', orderCode: '#9', status: 'received', updatedAt: '' } as Order
    store.reconcile([order])
    expect(store.items).toHaveLength(0)
    store.reconcile([{ ...order, status: 'ready' }])
    store.reconcile([{ ...order, status: 'ready' }])
    expect(store.items).toHaveLength(1)
    expect(store.items[0].title).toContain('Pedido pronto')
    // O mesmo estado a chegar depois pelo Realtime não repete.
    channel.onEvent?.(event({ eventId: orderStatusEventId('o9', 'ready'), orderId: 'o9', status: 'ready' }))
    expect(alerts.count).toBe(1)
  })

  it('estados do mesmo pedido substituem-se (não empilham)', () => {
    const store = useCustomerNotificationStore()
    store.start({ sessionId: 's1', participantToken: 'tok' })
    channel.onEvent?.(event())
    channel.onEvent?.(event({ eventId: 'o1:status:ready', status: 'ready' }))
    expect(store.items).toHaveLength(1)
    expect(store.items[0].status).toBe('ready')
  })

  it('pagamento de vários pedidos (mesmo eventId) → um só aviso', () => {
    const store = useCustomerNotificationStore()
    store.start({ sessionId: 's1', participantToken: 'tok' })
    const pay = { eventId: 's1:payment:confirmed', type: 'payment.confirmed' as const, status: 'paid' }
    channel.onEvent?.(event({ ...pay, orderId: 'o1' }))
    channel.onEvent?.(event({ ...pay, orderId: 'o2' }))
    expect(store.items).toHaveLength(1)
    expect(alerts.count).toBe(1)
  })
})
