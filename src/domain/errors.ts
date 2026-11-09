/**
 * Erro de regra de negócio com mensagem pronta para o utilizador.
 * Os repositórios (mock hoje, API amanhã) lançam-no; a UI mostra `message`.
 */
export class DomainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
