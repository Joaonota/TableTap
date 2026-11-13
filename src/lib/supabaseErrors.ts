import { DomainError } from '@/domain/errors'

/**
 * Converte erros do Supabase (PostgREST / funções SQL / Auth / Storage)
 * em DomainError com mensagem pronta para o utilizador.
 *
 * As regras de negócio na base de dados usam
 *   raise exception '<mensagem>' using hint = '<codigo>'
 * e chegam aqui com `hint` = código e `message` = texto em português.
 */
interface SupabaseLikeError {
  message?: string
  code?: string
  hint?: string | null
  details?: string | null
  status?: number
  name?: string
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou palavra-passe incorretos.',
  email_not_confirmed: 'Confirme o seu email antes de entrar. Verifique a sua caixa de correio.',
  user_already_exists: 'Já existe uma conta com este email.',
  weak_password: 'A palavra-passe é demasiado fraca. Use pelo menos 8 caracteres.',
  over_email_send_rate_limit: 'Foram enviados demasiados emails. Aguarde alguns minutos e tente novamente.',
  over_request_rate_limit: 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.',
  same_password: 'A nova palavra-passe tem de ser diferente da anterior.',
  signup_disabled: 'O registo de novas contas está desativado.'
}

export function toDomainError(error: unknown, fallback = 'Ocorreu um erro inesperado.'): DomainError {
  if (error instanceof DomainError) return error
  const e = (error ?? {}) as SupabaseLikeError
  const message = e.message?.trim() || fallback

  // Regras de negócio da base de dados
  if (e.hint && /^[a-z_]+$/.test(e.hint)) return new DomainError(e.hint, message)

  // Supabase Auth
  if (e.code && AUTH_MESSAGES[e.code]) return new DomainError(e.code, AUTH_MESSAGES[e.code])
  if (/Invalid login credentials/i.test(message)) return new DomainError('invalid_credentials', AUTH_MESSAGES.invalid_credentials)
  if (/Email not confirmed/i.test(message)) return new DomainError('email_not_confirmed', AUTH_MESSAGES.email_not_confirmed)

  switch (e.code) {
    case '23505':
      return new DomainError('duplicate', 'Já existe um registo com estes dados.')
    case '23503':
      return new DomainError('in_use', 'Este registo está a ser usado noutro lado e não pode ser removido.')
    case '23514':
      return new DomainError('validation', 'Alguns dados não são válidos. Reveja o formulário.')
    case '42501':
      return new DomainError('forbidden', /permission denied|row-level security/i.test(message)
        ? 'Não tem permissão para esta operação.'
        : message)
    case 'PGRST116':
      return new DomainError('not_found', 'Registo não encontrado.')
    case 'PGRST301':
    case 'PGRST303':
      return new DomainError('session_expired', 'A sua sessão expirou. Inicie sessão novamente.')
  }
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return new DomainError('network', 'Sem ligação ao servidor. Verifique a sua internet e tente novamente.')
  }
  return new DomainError(e.code || 'unknown', message)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Devolve `data` ou lança DomainError. As linhas chegam sem tipo (o projeto
 * não gera tipos da base de dados) e são convertidas pelos mappers.
 */
export function unwrap<T = any>(result: { data: unknown; error: unknown }, fallback?: string): T {
  if (result.error) throw toDomainError(result.error, fallback)
  return result.data as T
}

/** Como `unwrap`, mas falha se não houver dados. */
export function unwrapOne<T = any>(result: { data: unknown; error: unknown }, notFound = 'Registo não encontrado.'): T {
  const data = unwrap<T>(result)
  if (data === null || data === undefined) throw new DomainError('not_found', notFound)
  return data
}
