/** Página inicial de cada papel depois de iniciar sessão. */
export function homePathFor(auth: { isSuperAdmin: boolean; isKitchenStaff: boolean }): string {
  if (auth.isSuperAdmin) return '/super-admin/dashboard'
  if (auth.isKitchenStaff) return '/app/cozinha'
  return '/app/dashboard'
}

export const ACCEPT_INVITE_PATH = '/convite'
export const NO_ESTABLISHMENT_PATH = '/sem-estabelecimento'
export const ESTABLISHMENT_SETUP_PATH = '/app/configuracao-inicial'

/**
 * Passo obrigatório pendente da conta, por ordem:
 *  1. definir a palavra-passe do primeiro acesso;
 *  2. conta sem estabelecimento associado;
 *  3. conta desativada;
 *  4. assistente de configuração inicial do estabelecimento.
 * Devolve null quando a conta pode usar a aplicação normalmente.
 */
export function pendingStepPath(auth: {
  hasSession: boolean
  mustSetPassword: boolean
  needsOnboarding: boolean
  currentUser: unknown
  setupRestaurantId: string | null
}): string | null {
  if (!auth.hasSession) return null
  if (auth.mustSetPassword) return ACCEPT_INVITE_PATH
  if (auth.needsOnboarding) return NO_ESTABLISHMENT_PATH
  if (!auth.currentUser) return '/403'
  if (auth.setupRestaurantId) return ESTABLISHMENT_SETUP_PATH
  return null
}
