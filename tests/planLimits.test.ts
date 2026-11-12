import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { evaluateLimit, formatLimit, limitReachedMessage, normalizePlanEntitlements, validatePlanDraft } from '@/domain/planLimits'
import { LIMIT_CATALOG, FEATURE_CATALOG } from '@/types/plan'

// localStorage em memória (ambiente Node)
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

describe('Regras de limites', () => {
  it('ilimitado nunca é atingido', () => {
    const ev = evaluateLimit('TABLES', null, 500, 'Premium')
    expect(ev.unlimited).toBe(true)
    expect(ev.reached).toBe(false)
    expect(ev.remaining).toBeNull()
    expect(formatLimit(null)).toBe('Ilimitado')
  })

  it('atingido quando o consumo iguala ou passa o limite', () => {
    expect(evaluateLimit('TABLES', 3, 2, 'Básico').reached).toBe(false)
    const ev = evaluateLimit('TABLES', 3, 3, 'Básico')
    expect(ev.reached).toBe(true)
    expect(ev.exceeded).toBe(false)
    expect(ev.percentage).toBe(100)
    expect(evaluateLimit('TABLES', 3, 5, 'Básico').exceeded).toBe(true)
    expect(evaluateLimit('TABLES', 0, 0, 'Básico').reached).toBe(true)
  })

  it('mensagem clara com consumo, âmbito e plano', () => {
    const msg = limitReachedMessage(evaluateLimit('TABLES', 3, 3, 'Básico'))
    expect(msg).toContain('Limite do plano atingido')
    expect(msg).toContain('3 de 3 mesas neste restaurante')
    expect(msg).toContain('plano Básico')
  })

  it('validação do plano no editor', () => {
    const ok = validatePlanDraft({ name: 'Novo', slug: 'novo', price: 0, limits: [{ resourceKey: 'TABLES', limit: null }] })
    expect(ok).toEqual({})
    const errors = validatePlanDraft(
      { name: ' ', slug: 'Com Espaço', price: -1, limits: [{ resourceKey: 'TABLES', limit: 2.5 }, { resourceKey: 'PRODUCTS', limit: -1 }] },
      []
    )
    expect(Object.keys(errors).sort()).toEqual(['limit:PRODUCTS', 'limit:TABLES', 'name', 'price', 'slug'])
    expect(validatePlanDraft({ name: 'básico', slug: 'x', price: 1, limits: [] }, [{ id: 'p1', name: 'Básico', slug: 'basico' }]).name).toBeTruthy()
  })

  it('limites novos do catálogo aparecem em planos antigos como ilimitados', () => {
    const normalized = normalizePlanEntitlements({ features: [], limits: [{ resourceKey: 'TABLES', limit: 3 }] })
    expect(normalized.limits).toHaveLength(LIMIT_CATALOG.length)
    expect(normalized.limits.find(l => l.resourceKey === 'TABLES')?.limit).toBe(3)
    expect(normalized.limits.find(l => l.resourceKey === 'PRODUCTS')?.limit).toBeNull()
    expect(normalized.features).toHaveLength(FEATURE_CATALOG.length)
  })
})

describe('Aplicação dos limites ao criar recursos', () => {
  let repos: typeof import('@/repositories')['repositories']
  let storage: typeof import('@/repositories/mock/mockStorage')['mockStorage']
  let planAccessService: typeof import('@/services/planAccessService')['planAccessService']

  beforeAll(async () => {
    ;({ repositories: repos } = await import('@/repositories'))
    ;({ mockStorage: storage } = await import('@/repositories/mock/mockStorage'))
    ;({ planAccessService } = await import('@/services/planAccessService'))
  })
  beforeEach(() => storage.reset())

  /** Coloca a empresa tenant-1 num plano e ajusta limites para o teste. */
  const usePlan = async (planId: string, limits: Record<string, number | null> = {}) => {
    const sub = await repos.subscriptions.getByTenant('tenant-1')
    await repos.subscriptions.updateSubscription(sub!.id, { planId })
    const plan = await repos.plans.getById(planId)
    await repos.plans.update(planId, {
      limits: plan!.limits.map(l => (l.resourceKey in limits ? { ...l, limit: limits[l.resourceKey] } : l))
    })
  }

  it('mesas: bloqueia ao atingir o limite do plano (por restaurante)', async () => {
    await usePlan('plan-basic', { TABLES: 9 }) // rest-1 já tem 8 mesas
    await repos.tables.create('rest-1', { number: '30', area: 'Bar', capacity: 2 })
    await expect(repos.tables.create('rest-1', { number: '31', area: 'Bar', capacity: 2 })).rejects.toMatchObject({
      code: 'plan_limit_reached',
      message: expect.stringContaining('9 de 9 mesas neste restaurante')
    })
    // Outro restaurante tem o seu próprio limite
    await expect(repos.tables.create('rest-2', { number: 'M9', area: 'Bar', capacity: 2 })).resolves.toBeTruthy()
  })

  it('ilimitado permite criar sem restrição', async () => {
    await usePlan('plan-enterprise')
    for (let i = 0; i < 25; i++) await repos.tables.create('rest-1', { number: `X${i}`, area: 'Bar', capacity: 2 })
    const ev = await planAccessService.checkLimit('tenant-1', 'TABLES', 'rest-1')
    expect(ev.unlimited).toBe(true)
    expect(ev.current).toBe(33)
  })

  it('produtos e categorias respeitam o limite', async () => {
    const products = await repos.products.getByRestaurant('rest-1')
    const categories = await repos.categories.getByRestaurant('rest-1')
    await usePlan('plan-basic', { PRODUCTS: products.length, CATEGORIES: categories.length })
    const base = { ...products[0] }
    delete (base as Partial<typeof base>).id
    await expect(repos.products.create(base)).rejects.toMatchObject({ code: 'plan_limit_reached' })
    await expect(
      repos.categories.create({ tenantId: 'tenant-1', restaurantId: 'rest-1', name: 'Nova', sortOrder: 99, isActive: true })
    ).rejects.toMatchObject({ code: 'plan_limit_reached' })
  })

  it('utilizadores: limite conta só os ativos, incluindo reativações', async () => {
    const staff = await repos.staff.getByTenant('tenant-1')
    const active = staff.filter(s => s.isActive).length
    await usePlan('plan-basic', { STAFF: active })
    const newMember = { tenantId: 'tenant-1', name: 'Novo', email: 'n@x.co', phone: '', role: 'waiter' as const, assignedRestaurantIds: ['rest-1'], hireDate: '2026-11-01' }
    await expect(repos.staff.create({ ...newMember, isActive: true })).rejects.toMatchObject({ code: 'plan_limit_reached' })
    // Inativo não conta; reativar acima do limite é recusado
    const inactive = await repos.staff.create({ ...newMember, isActive: false })
    await expect(repos.staff.update(inactive.id, { isActive: true })).rejects.toMatchObject({ code: 'plan_limit_reached' })
  })

  it('alterar o plano pelo Super Admin tem efeito imediato', async () => {
    await usePlan('plan-basic', { TABLES: 8 })
    expect((await planAccessService.checkLimit('tenant-1', 'TABLES', 'rest-1')).reached).toBe(true)
    await usePlan('plan-basic', { TABLES: null })
    expect((await planAccessService.checkLimit('tenant-1', 'TABLES', 'rest-1')).reached).toBe(false)
  })

  it('não elimina um plano atribuído a empresas', async () => {
    await expect(repos.plans.delete('plan-pro')).rejects.toMatchObject({ code: 'plan_in_use' })
    const created = await repos.plans.create({ name: 'Teste', slug: 'teste', description: '', price: 0, currency: 'MT', billingPeriod: 'monthly', active: true, features: [], limits: [] })
    expect(created.limits).toHaveLength(LIMIT_CATALOG.length)
    expect(await repos.plans.delete(created.id)).toBe(true)
  })
})
