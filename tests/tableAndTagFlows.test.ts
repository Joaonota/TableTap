import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

/**
 * Fluxos completos sobre os repositórios mock (a mesma camada que a UI usa):
 *  - Mesa → URL → resolução pública
 *  - Livre → Ocupada → Encerrada → Livre (com vários participantes)
 *  - Associação Tag → Mesa, configuração e reatribuição
 */

// localStorage em memória (o ambiente de teste é Node)
const memory = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size
  }
} as Storage

type Modules = {
  repos: typeof import('@/repositories')['repositories']
  storage: typeof import('@/repositories/mock/mockStorage')['mockStorage']
}
let m: Modules

beforeAll(async () => {
  const [{ repositories }, { mockStorage }] = await Promise.all([import('@/repositories'), import('@/repositories/mock/mockStorage')])
  m = { repos: repositories, storage: mockStorage }
})

beforeEach(() => m.storage.reset())

const ACTOR = 'Teste'

describe('Mesa → URL → resolução', () => {
  it('cria mesa com slug permanente que não muda ao editar', async () => {
    const created = await m.repos.tables.create('rest-1', { number: '09', area: 'Bar', capacity: 2 })
    expect(created.slug).toBe('mesa-09')
    expect(created.status).toBe('free')

    const edited = await m.repos.tables.update(created.id, { number: '19', name: 'Balcão' })
    expect(edited.number).toBe('19')
    expect(edited.slug).toBe('mesa-09')

    expect((await m.repos.tables.getBySlug('rest-1', 'mesa-09'))?.id).toBe(created.id)
  })

  it('a URL resolve restaurante, mesa e estado atual (e a URL antiga pelo número)', async () => {
    const { publicTableService } = await import('@/services')
    const free = await publicTableService.resolve('sabores-maputo', 'mesa-05')
    expect(free?.table.id).toBe('tbl-5')
    expect(free?.activeSession).toBeNull()

    const occupied = await publicTableService.resolve('sabores-maputo', 'mesa-01')
    expect(occupied?.activeSession?.id).toBe('sess-101')

    const legacy = await publicTableService.resolve('sabores-maputo', '05')
    expect(legacy?.table.slug).toBe('mesa-05')

    expect(await publicTableService.resolve('sabores-maputo', 'mesa-99')).toBeNull()
    expect(await publicTableService.resolve('nao-existe', 'mesa-01')).toBeNull()
  })

  it('recusa número duplicado e capacidade inválida', async () => {
    await expect(m.repos.tables.create('rest-1', { number: '01', area: 'Bar', capacity: 2 })).rejects.toThrow(/Já existe/)
    await expect(m.repos.tables.create('rest-1', { number: '99', area: 'Bar', capacity: 0 })).rejects.toThrow(/capacidade/)
  })
})

describe('Sessão: Livre → Ocupada → Encerrada → Livre', () => {
  it('ciclo completo com vários participantes e pedidos', async () => {
    const table = (await m.repos.tables.getBySlug('rest-1', 'mesa-05'))!
    expect(table.status).toBe('free')

    const { session, participant } = await m.repos.tableSessions.start({ tableId: table.id, primaryCustomerName: 'Carlos', partySize: 3 })
    expect(participant?.isPrimary).toBe(true)
    expect((await m.repos.tables.getById(table.id))?.status).toBe('occupied')
    expect((await m.repos.tables.getById(table.id))?.activeSessionId).toBe(session.id)

    // Segundo telemóvel não cria outra sessão nem outra mesa
    await expect(m.repos.tableSessions.start({ tableId: table.id, primaryCustomerName: 'Ana' })).rejects.toMatchObject({ code: 'table_already_occupied' })
    const joined = await m.repos.tableSessions.join(session.id, 'Ana')
    expect(joined.session.participants.map(p => p.name)).toEqual(['Carlos', 'Ana'])
    expect(m.storage.getDb().tables.filter(t => t.restaurantId === 'rest-1')).toHaveLength(8)

    // Pedidos de ambos entram na mesma sessão
    const base = { tenantId: 'tenant-1', restaurantId: 'rest-1', tableId: table.id, tableNumber: table.number, tableSessionId: session.id, type: 'dine_in' as const, paymentStatus: 'pending' as const, items: [], subtotal: 0, taxAmount: 0, serviceFee: 0 }
    const o1 = await m.repos.orders.create({ ...base, status: 'received', total: 500, customerName: 'Carlos' })
    const o2 = await m.repos.orders.create({ ...base, status: 'received', total: 250, customerName: 'Ana' })
    await m.repos.tableSessions.addOrder(session.id, o1.id)
    const afterOrders = await m.repos.tableSessions.addOrder(session.id, o2.id)
    expect(afterOrders.total).toBe(750)

    // Pedido cancelado deixa de contar
    await m.repos.orders.updateStatus(o2.id, 'cancelled', ACTOR)
    expect((await m.repos.tableSessions.getById(session.id))?.total).toBe(500)

    // Pedidos não alteram o estado da mesa
    expect((await m.repos.tables.getById(table.id))?.status).toBe('occupied')

    // Não se pode libertar manualmente uma mesa com sessão
    await expect(m.repos.tables.setStatus(table.id, 'free')).rejects.toMatchObject({ code: 'table_has_session' })

    const closed = await m.repos.tableSessions.close(session.id, ACTOR)
    expect(closed.status).toBe('closed')
    expect(closed.closedAt).toBeTruthy()
    expect(closed.total).toBe(500)
    const freed = await m.repos.tables.getById(table.id)
    expect(freed?.status).toBe('free')
    expect(freed?.activeSessionId).toBeUndefined()

    // Sessão encerrada não aceita mais participantes/pedidos
    await expect(m.repos.tableSessions.join(session.id, 'Rui')).rejects.toMatchObject({ code: 'session_not_active' })

    // Histórico da mesa inclui a sessão
    const history = await m.repos.tableSessions.getByTable(table.id)
    expect(history[0].id).toBe(session.id)

    // Nova sessão volta a ocupar
    await m.repos.tableSessions.start({ tableId: table.id })
    expect((await m.repos.tables.getById(table.id))?.status).toBe('occupied')
  })

  it('cancelar sessão liberta a mesa e guarda o motivo', async () => {
    const { session } = await m.repos.tableSessions.start({ tableId: 'tbl-6' })
    const cancelled = await m.repos.tableSessions.cancel(session.id, ACTOR, 'Aberta por engano')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.cancelReason).toBe('Aberta por engano')
    expect((await m.repos.tables.getById('tbl-6'))?.status).toBe('free')
  })

  it('mesa indisponível ou desativada não inicia sessão', async () => {
    await expect(m.repos.tableSessions.start({ tableId: 'tbl-8' })).rejects.toMatchObject({ code: 'table_unavailable' })
    await m.repos.tables.setActive('tbl-7', false)
    await expect(m.repos.tableSessions.start({ tableId: 'tbl-7' })).rejects.toMatchObject({ code: 'table_unavailable' })
  })
})

describe('Etiquetas: associação, configuração e reatribuição', () => {
  it('fluxo completo de uma etiqueta nova', async () => {
    const [tag] = await m.repos.nfcTags.register({ restaurantId: 'rest-1', quantity: 1 }, ACTOR)
    expect(tag.code).toBe('TAG-00011')
    expect(tag.status).toBe('pending')

    // Associar (sem impacto físico)
    let t = await m.repos.nfcTags.assign(tag.id, 'tbl-7', ACTOR)
    expect(t.status).toBe('pending')
    expect(t.targetPath).toBe('/m/sabores-maputo/mesa-07')

    // Alterar associação antes de gravar continua pendente
    t = await m.repos.nfcTags.assign(tag.id, 'tbl-8', ACTOR)
    expect(t.status).toBe('pending')
    expect(t.targetPath).toBe('/m/sabores-maputo/mesa-08')

    // Registo administrativo da gravação pela equipa
    t = await m.repos.nfcTags.markConfigured(tag.id, ACTOR)
    expect(t.status).toBe('configured')
    expect(t.configuredPath).toBe('/m/sabores-maputo/mesa-08')
    expect(t.configuredAt).toBeTruthy()

    t = await m.repos.nfcTags.activate(tag.id, ACTOR)
    expect(t.status).toBe('active')

    // Mudar o estado da mesa NÃO altera a etiqueta
    await m.repos.tables.setStatus('tbl-8', 'free')
    await m.repos.tableSessions.start({ tableId: 'tbl-8' })
    expect((await m.repos.nfcTags.getById(tag.id))?.status).toBe('active')
    expect((await m.repos.nfcTags.getById(tag.id))?.configuredPath).toBe('/m/sabores-maputo/mesa-08')

    // Reatribuir uma etiqueta já gravada exige regravação
    t = await m.repos.nfcTags.assign(tag.id, 'tbl-7', ACTOR)
    expect(t.status).toBe('reassignment_pending')
    expect(t.configuredPath).toBe('/m/sabores-maputo/mesa-08')
    expect(t.targetPath).toBe('/m/sabores-maputo/mesa-07')

    // Voltar à mesa original não precisa de regravação
    t = await m.repos.nfcTags.assign(tag.id, 'tbl-8', ACTOR)
    expect(t.status).toBe('configured')

    const history = await m.repos.nfcTags.getHistory(tag.id)
    expect(history.map(e => e.type)).toEqual(
      expect.arrayContaining(['registered', 'associated', 'association_changed', 'configured', 'activated'])
    )
  })

  it('uma mesa só tem uma etiqueta em uso; desativar liberta a mesa', async () => {
    // tbl-1 já tem TAG-00001
    await expect(m.repos.nfcTags.assign('nfc-7', 'tbl-1', ACTOR)).rejects.toMatchObject({ code: 'table_has_tag' })
    await m.repos.nfcTags.disable('nfc-1', ACTOR, 'Danificada')
    const assigned = await m.repos.nfcTags.assign('nfc-7', 'tbl-1', ACTOR)
    expect(assigned.tableId).toBe('tbl-1')
    expect((await m.repos.nfcTags.getByTable('tbl-1'))?.code).toBe('TAG-00007')
  })

  it('não permite marcar como configurada sem mesa nem associar a mesa de outro restaurante', async () => {
    await expect(m.repos.nfcTags.markConfigured('nfc-7', ACTOR)).rejects.toMatchObject({ code: 'tag_action_not_allowed' })
    await expect(m.repos.nfcTags.assign('nfc-7', 'tbl-201', ACTOR)).rejects.toMatchObject({ code: 'tag_wrong_restaurant' })
  })

  it('remover a mesa desassocia a etiqueta', async () => {
    await m.repos.tables.delete('tbl-5', ACTOR)
    const tag = await m.repos.nfcTags.getById('nfc-5')
    expect(tag?.tableId).toBeUndefined()
    expect(tag?.status).toBe('pending')
  })

  it('códigos duplicados ou inválidos são recusados', async () => {
    await expect(m.repos.nfcTags.register({ restaurantId: 'rest-1', codes: ['TAG-00001'] }, ACTOR)).rejects.toMatchObject({ code: 'tag_code_taken' })
    await expect(m.repos.nfcTags.register({ restaurantId: 'rest-1', codes: ['ABC'] }, ACTOR)).rejects.toMatchObject({ code: 'tag_code_invalid' })
  })
})
