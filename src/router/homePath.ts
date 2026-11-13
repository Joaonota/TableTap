/** Página inicial de cada papel depois de iniciar sessão. */
export function homePathFor(auth: { isSuperAdmin: boolean; isKitchenStaff: boolean }): string {
  if (auth.isSuperAdmin) return '/super-admin/dashboard'
  if (auth.isKitchenStaff) return '/app/cozinha'
  return '/app/dashboard'
}
