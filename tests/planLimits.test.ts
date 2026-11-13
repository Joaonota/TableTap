import { describe, expect, it } from 'vitest'
import { evaluateLimit, formatLimit, limitReachedMessage, normalizePlanEntitlements, validatePlanDraft } from '@/domain/planLimits'
import { LIMIT_CATALOG, FEATURE_CATALOG } from '@/types/plan'

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

// A aplicação dos limites ao criar recursos é feita pela base de dados
// (triggers) e testada em supabase/tests/database.test.sql (npm run test:db).
