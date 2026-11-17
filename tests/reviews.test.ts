import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildGoogleReviewUrlFromPlaceId, checkGoogleReviewInput, detectDeviceType } from '@/domain/reviews'

describe('Link de avaliação Google', () => {
  it('aceita vazio (pedido de avaliação desligado)', () => {
    expect(checkGoogleReviewInput('')).toEqual({ ok: true, url: '' })
    expect(checkGoogleReviewInput('   ')).toEqual({ ok: true, url: '' })
  })

  it.each([
    'https://g.page/r/CbYzQ1x2abcdEAE/review',
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    'https://www.google.com/maps/place/Sabores+Maputo/@-25.96,32.58,17z',
    'https://maps.app.goo.gl/AbCdEf123',
    'https://goo.gl/maps/AbCdEf123',
    'https://www.google.co.mz/maps/place/Sabores',
    'https://g.co/kgs/AbC123',
    'https://share.google/AbCdEf12345',
    'https://maps.app.goo.gl/Xy7AbCdEfGh?g_st=ic'
  ])('aceita o link oficial %s', url => {
    const r = checkGoogleReviewInput(url)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.url).toBe(url)
  })

  it('identifica links que abrem diretamente o formulário de avaliação', () => {
    const r = checkGoogleReviewInput('https://g.page/r/CbYzQ1x2abcdEAE/review')
    expect(r.ok && 'kind' in r && r.kind).toBe('direct_review')
    const m = checkGoogleReviewInput('https://maps.app.goo.gl/AbCdEf123')
    expect(m.ok && 'kind' in m && m.kind).toBe('maps')
  })

  it('converte um Place ID no link direto do formulário de avaliação', () => {
    const r = checkGoogleReviewInput('ChIJN1t_tDeuEmsRUsoyG83frY4')
    expect(r).toMatchObject({ ok: true, url: buildGoogleReviewUrlFromPlaceId('ChIJN1t_tDeuEmsRUsoyG83frY4'), kind: 'direct_review' })
  })

  it('completa https:// e converte http:// em https://', () => {
    expect(checkGoogleReviewInput('g.page/r/abc/review')).toMatchObject({ ok: true, url: 'https://g.page/r/abc/review' })
    expect(checkGoogleReviewInput('http://g.page/r/abc/review')).toMatchObject({ ok: true, url: 'https://g.page/r/abc/review' })
  })

  it.each([
    'https://example.com/review',
    'https://g.page.evil.com/r/abc',
    'https://evil.com/?u=https://g.page/r/abc',
    'https://google.com.evil.io/maps',
    'https://www.facebook.com/sabores/reviews',
    'https://share.google.evil.com/abc',
    'https://g.page/r/abc review',
    'javascript:alert(1)'
  ])('recusa %s', url => {
    expect(checkGoogleReviewInput(url).ok).toBe(false)
  })

  it('usa os mesmos domínios que a validação da base de dados (migração 1200)', () => {
    const sql = readFileSync('supabase/migrations/20261117001200_review_url_share_google.sql', 'utf8')
    for (const fragment of [
      "g\\.page/",
      'search\\.google\\.com/local/writereview\\?',
      'maps\\.app\\.goo\\.gl/',
      'goo\\.gl/maps/',
      'g\\.co/kgs/',
      'share\\.google/'
    ]) {
      expect(sql).toContain(fragment)
    }
  })
})

describe('Categoria do dispositivo', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', 'mobile'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/120 Mobile Safari/537.36', 'mobile'],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'tablet'],
    ['Mozilla/5.0 (Linux; Android 13; SM-X700) Chrome/120 Safari/537.36', 'tablet'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36', 'desktop']
  ])('%s → %s', (ua, expected) => {
    expect(detectDeviceType(ua)).toBe(expected)
  })
})
