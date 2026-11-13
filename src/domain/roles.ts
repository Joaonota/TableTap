import type { UserRole } from '@/types'

/** Nomes dos papéis apresentados na interface. */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  company_owner: 'Dono da empresa',
  restaurant_admin: 'Administrador do restaurante',
  manager: 'Gerente',
  receptionist: 'Recepcionista',
  waiter: 'Empregado de mesa',
  kitchen_staff: 'Cozinha'
}

/** Iniciais para avatares sem fotografia ("Ana Maria Silva" → "AS"). */
export function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
