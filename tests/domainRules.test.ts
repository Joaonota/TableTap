import { describe, expect, it } from 'vitest'
import { buildTablePath, generateTableSlug, slugify } from '@/domain/publicUrl'
import { allowedTagActions, nextTagCode, statusAfterAssociation } from '@/domain/nfcTagRules'
import { countTables, effectiveTableStatus, canSetManualStatus, sumOrderTotals, formatDuration, formatStartTime } from '@/domain/tableRules'

describe('URL pública da mesa', () => {
  it('usa o formato /m/:restaurante/:mesa', () => {
    expect(buildTablePath('sabores', 'mesa-08')).toBe('/m/sabores/mesa-08')
  })

  it('gera slugs sem acentos nem espaços', () => {
    expect(slugify('  Mesa Ção Nº 3 ')).toBe('mesa-cao-n-3')
  })

  it('gera o slug a partir do número e garante unicidade', () => {
    expect(generateTableSlug('08', [])).toBe('mesa-08')
    expect(generateTableSlug('M1', [])).toBe('mesa-m1')
    expect(generateTableSlug('08', ['mesa-08'])).toBe('mesa-08-2')
    expect(generateTableSlug('08', ['mesa-08', 'mesa-08-2'])).toBe('mesa-08-3')
  })
})

describe('Regras das etiquetas NFC', () => {
  it('próximo código segue a numeração global', () => {
    expect(nextTagCode([])).toBe('TAG-00001')
    expect(nextTagCode(['TAG-00009', 'TAG-00017', 'OUTRO'])).toBe('TAG-00018')
  })

  it('estado após associação depende do que foi gravado', () => {
    expect(statusAfterAssociation(undefined, '/m/r/mesa-01')).toBe('pending')
    expect(statusAfterAssociation('/m/r/mesa-01', '/m/r/mesa-01')).toBe('configured')
    expect(statusAfterAssociation('/m/r/mesa-01', '/m/r/mesa-02')).toBe('reassignment_pending')
    expect(statusAfterAssociation('/m/r/mesa-01', undefined)).toBe('reassignment_pending')
  })

  it('ações permitidas por estado', () => {
    expect(allowedTagActions({ status: 'pending' })).toEqual(['associate', 'disable'])
    expect(allowedTagActions({ status: 'pending', tableId: 't1' })).toEqual(['change_association', 'unassign', 'mark_configured', 'disable'])
    expect(allowedTagActions({ status: 'configured', tableId: 't1' })).toEqual(['reassign', 'unassign', 'activate', 'disable'])
    expect(allowedTagActions({ status: 'active', tableId: 't1' })).toEqual(['reassign', 'unassign', 'disable'])
    expect(allowedTagActions({ status: 'reassignment_pending', tableId: 't1' })).toEqual(['reassign', 'unassign', 'mark_configured', 'disable'])
    expect(allowedTagActions({ status: 'disabled' })).toEqual(['reactivate'])
  })
})

describe('Regras das mesas', () => {
  it('mesa desativada conta como indisponível', () => {
    expect(effectiveTableStatus({ status: 'free', isActive: false })).toBe('unavailable')
    expect(
      countTables([
        { status: 'free', isActive: true },
        { status: 'occupied', isActive: true },
        { status: 'unavailable', isActive: true },
        { status: 'free', isActive: false }
      ])
    ).toEqual({ total: 4, free: 1, occupied: 1, unavailable: 2 })
  })

  it('ocupação não pode ser alterada manualmente', () => {
    expect(canSetManualStatus({ status: 'occupied' }, 'free')).toBe(false)
    expect(canSetManualStatus({ status: 'free' }, 'unavailable')).toBe(true)
  })

  it('formata duração em minutos, horas e dias', () => {
    const from = '2026-11-09T10:00:00Z'
    expect(formatDuration(from, '2026-11-09T10:12:00Z')).toBe('12 min')
    expect(formatDuration(from, '2026-11-09T11:05:00Z')).toBe('1h 05m')
    expect(formatDuration(from, '2026-11-11T14:00:00Z')).toBe('2d 4h')
  })

  it('hora de início inclui a data quando não é hoje', () => {
    const now = new Date('2026-11-09T15:00:00')
    expect(formatStartTime('2026-11-09T13:05:00', now)).not.toMatch(/\//)
    expect(formatStartTime('2026-10-16T13:05:00', now)).toMatch(/16\/10/)
  })

  it('total ignora pedidos cancelados', () => {
    expect(sumOrderTotals([{ status: 'received', total: 100.5 }, { status: 'cancelled', total: 50 }, { status: 'delivered', total: 20.25 }])).toBe(120.75)
  })
})
