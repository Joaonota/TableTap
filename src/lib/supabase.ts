import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase único da aplicação.
 *
 * Só usa a chave PÚBLICA (anon / publishable). A segurança dos dados é
 * garantida pelo RLS e pelas funções da base de dados
 * (supabase/migrations), nunca por esta chave.
 * A chave `service_role` / secreta NUNCA pode estar no frontend.
 */

const url = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').trim()
const publicKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  ''
).trim()

/** Deteta chaves secretas coladas por engano no .env do frontend. */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

export type SupabaseConfigProblem = 'missing_url' | 'missing_key' | 'secret_key' | null

export const supabaseConfigProblem: SupabaseConfigProblem = !url
  ? 'missing_url'
  : !publicKey
    ? 'missing_key'
    : isSecretKey(publicKey)
      ? 'secret_key'
      : null

export const isSupabaseConfigured = supabaseConfigProblem === null

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? url : 'https://configuracao-em-falta.invalid',
  isSupabaseConfigured ? publicKey : 'configuracao-em-falta',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
)

/** Bucket público de imagens (logótipos, produtos, categorias, capas). */
export const MEDIA_BUCKET = 'media'
