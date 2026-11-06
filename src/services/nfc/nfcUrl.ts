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
