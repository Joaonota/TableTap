/**
 * URL pública e permanente de cada mesa.
 *
 * Formato: {BASE}/m/{restaurantSlug}/{tableSlug}
 * Ex.:     https://tapmenu.app/m/sabores/mesa-08
 *
 * É esta URL — e só ela — que a equipa TapMenu grava na etiqueta NFC com a
 * aplicação externa, e é a mesma que o QR Code contém. O estado da mesa
 * (livre/ocupada) é consultado no momento do acesso, por isso a etiqueta
 * nunca precisa de ser alterada quando a mesa muda de estado.
 */

const ENV_BASE = ((import.meta.env?.VITE_PUBLIC_BASE_URL as string | undefined) ?? '').trim().replace(/\/+$/, '')

export const PUBLIC_TABLE_PREFIX = '/m'

/** Base pública: VITE_PUBLIC_BASE_URL (produção) ou o origin atual. */
export function getPublicBaseUrl(): string {
  if (ENV_BASE) return ENV_BASE
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'https://tapmenu.app'
}

/** Caminho relativo da mesa (o que fica guardado no registo da etiqueta). */
export function buildTablePath(restaurantSlug: string, tableSlug: string): string {
  return `${PUBLIC_TABLE_PREFIX}/${restaurantSlug}/${tableSlug}`
}

/** Converte um caminho público em URL absoluta. */
export function toAbsoluteUrl(path: string): string {
  return `${getPublicBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

/** URL absoluta da mesa — a que é gravada na etiqueta e no QR Code. */
export function buildTableUrl(restaurant: { slug: string }, table: { slug: string }): string {
  return toAbsoluteUrl(buildTablePath(restaurant.slug, table.slug))
}

/** Normaliza texto para um slug de URL (sem acentos, minúsculas, hífens). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Gera o slug permanente de uma nova mesa a partir do número.
 * "08" → "mesa-08"; "M1" → "mesa-m1". Garante unicidade no restaurante.
 */
export function generateTableSlug(tableNumber: string, existingSlugs: Iterable<string>): string {
  const taken = new Set(existingSlugs)
  const base = `mesa-${slugify(tableNumber) || 'sem-numero'}`
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
