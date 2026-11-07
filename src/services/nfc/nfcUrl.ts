import type { Restaurant, Table } from '@/types'

/**
 * Construção do URL real que será gravado nas etiquetas NFC.
 *
 * Usa a base pública configurada em `.env` (VITE_PUBLIC_BASE_URL) quando
 * existir — útil quando o painel é acedido por um domínio diferente do
 * domínio público do menu — caso contrário usa o origin atual da página.
 * Nenhum domínio fixo espalhado pelo código.
 */

const ENV_BASE = ((import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')

export function getPublicBaseUrl(): string {
  if (ENV_BASE) return ENV_BASE
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'https://tapmenu.app'
}

/** Caminho relativo, no mesmo formato usado por /menu/:restaurantSlug/:tableCode. */
export function getMenuUrlPath(restaurantSlug: string, tableCode: string): string {
  return `/menu/${restaurantSlug}/${tableCode}`
}

/** URL absoluto completo (o que é gravado na tag e no QR Code). */
export function buildMenuUrl(restaurant: Pick<Restaurant, 'slug'>, table: Pick<Table, 'number'>): string {
  return `${getPublicBaseUrl()}${getMenuUrlPath(restaurant.slug, table.number)}`
}

/** Normalização para comparação na verificação (sem espaços/slash final). */
export function normalizeMenuUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export interface NfcUrlValidation {
  valid: boolean
  reason?: string
}

/**
 * Validação do URL antes de iniciar uma escrita NDEF.
 * A Web NFC grava URI records; apenas HTTP(S) absolutos fazem sentido aqui.
 */
export function validateNfcUrl(url: string): NfcUrlValidation {
  const value = (url ?? '').trim()
  if (!value) return { valid: false, reason: 'O URL a gravar está vazio.' }
  if (/\s/.test(value)) return { valid: false, reason: 'O URL contém espaços ou caracteres inválidos.' }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { valid: false, reason: 'O URL não é absoluto ou está mal formado.' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Apenas endereços HTTP(S) podem ser gravados como URL NDEF.' }
  }
  if (!parsed.hostname) {
    return { valid: false, reason: 'O URL não contém um domínio válido.' }
  }
  return { valid: true }
}
