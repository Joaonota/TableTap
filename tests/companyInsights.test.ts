import { describe, it, expect } from 'vitest'
import { ALERT_TEXT, growth, periodRange, type CompanyAlert } from '../src/domain/companyInsights'

describe('Empresa — comparação e alertas', () => {
  it('variação face ao período anterior (sem base = null)', () => {
    expect(growth(1500, 1000)).toBe(50)
    expect(growth(800, 1000)).toBe(-20)
    expect(growth(500, 0)).toBeNull()
  })

  it('período: começa à meia-noite de há N-1 dias', () => {
    const now = new Date(2026, 10, 20, 15, 30)
    const { from, to } = periodRange(7, now)
    expect(from.getDate()).toBe(14)
    expect(from.getHours()).toBe(0)
    expect(to).toBe(now)
    expect(periodRange(1, now).from.getDate()).toBe(20)
  })

  it('cada tipo de alerta tem título, descrição com os números e acção sugerida', () => {
    const a: CompanyAlert = { kind: 'cancellations_by_staff', severity: 'high', restaurantId: 'r1', actor: 'João', count: 7, rate: 18.5 }
    expect(ALERT_TEXT[a.kind].describe(a)).toBe('João cancelou 7 pedidos (18.5% dos pedidos do estabelecimento).')
    const m: CompanyAlert = { kind: 'payment_mismatch', severity: 'medium', restaurantId: 'r1', count: 2, orderCodes: ['#1', '#2'] }
    expect(ALERT_TEXT[m.kind].describe(m)).toContain('#1, #2')
    for (const t of Object.values(ALERT_TEXT)) {
      expect(t.title.length).toBeGreaterThan(5)
      expect(t.action.length).toBeGreaterThan(5)
    }
  })
})
