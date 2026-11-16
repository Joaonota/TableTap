/** Página inicial de cada papel depois de iniciar sessão. */
export function homePathFor(auth: { isSuperAdmin: boolean; isKitchenStaff: boolean }): string {
  if (auth.isSuperAdmin) return '/super-admin/dashboard'
  if (auth.isKitchenStaff) return '/app/cozinha'
  return '/app/dashboard'
}

export const ACCEPT_INVITE_PATH = '/convite'
export const NO_ESTABLISHMENT_PATH = '/sem-estabelecimento'
export const COMPANY_SETUP_PATH = '/app/perfil-empresa'
export const COMPANY_SUSPENDED_PATH = '/empresa-suspensa'

/**
 * Passo obrigatório pendente da conta, por ordem:
 *  1. definir a palavra-passe do primeiro acesso;
 *  2. conta sem estabelecimento associado;
 *  3. empresa suspensa pelo Super Admin do Sistema;
 *  4. conta desativada;
 *  5. perfil da empresa por completar (primeiro acesso do responsável).
 * Devolve null quando a conta pode usar a aplicação normalmente.
 */
export function pendingStepPath(auth: {
  hasSession: boolean
  mustSetPassword: boolean
  needsOnboarding: boolean
  currentUser: unknown
  setupCompanyId: string | null
  companySuspended?: boolean
}): string | null {
  if (!auth.hasSession) return null
  if (auth.mustSetPassword) return ACCEPT_INVITE_PATH
  if (auth.needsOnboarding) return NO_ESTABLISHMENT_PATH
  if (auth.companySuspended) return COMPANY_SUSPENDED_PATH
  if (!auth.currentUser) return '/403'
  if (auth.setupCompanyId) return COMPANY_SETUP_PATH
  return null
}
