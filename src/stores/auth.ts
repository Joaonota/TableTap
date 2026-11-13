import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'
import { authService } from '@/services'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * Sessão real (Supabase Auth). O papel e os restaurantes vêm da ligação do
 * utilizador à empresa (staff_members); as permissões efetivas são
 * aplicadas pelo RLS — estas verificações servem apenas para a interface.
 */
export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  /** Há sessão iniciada (mesmo que ainda sem empresa). */
  const hasSession = ref(false)
  /** Conta autenticada sem empresa: tem de concluir o registo. */
  const needsOnboarding = ref(false)
  /** Primeiro acesso: tem de definir a palavra-passe antes de usar a aplicação. */
  const mustSetPassword = ref(false)
  /** Restaurante cuja configuração inicial (assistente) está por concluir. */
  const setupRestaurantId = ref<string | null>(null)
  const accountEmail = ref('')
  const accountName = ref('')
  const isLoading = ref(false)
  const isReady = ref(false)
  let initPromise: Promise<void> | null = null
  let unsubscribe: (() => void) | null = null

  const isAuthenticated = computed(() => !!currentUser.value)
  const currentRole = computed<UserRole | undefined>(() => currentUser.value?.role)

  const isSuperAdmin = computed(() => currentUser.value?.role === 'super_admin')
  const isCompanyOwner = computed(() => currentUser.value?.role === 'company_owner' || isSuperAdmin.value)
  const isRestaurantAdmin = computed(() => currentUser.value?.role === 'restaurant_admin' || isCompanyOwner.value)
  const isManager = computed(() => currentUser.value?.role === 'manager' || isRestaurantAdmin.value)
  const isKitchenStaff = computed(() => currentUser.value?.role === 'kitchen_staff')
  const isWaiter = computed(() => currentUser.value?.role === 'waiter')

  const canAccessRestaurant = (restaurantId: string): boolean => {
    if (!currentUser.value) return false
    if (isCompanyOwner.value) return true
    return currentUser.value.assignedRestaurantIds.includes(restaurantId)
  }

  const can = (action: string): boolean => {
    if (!currentUser.value) return false
    if (isSuperAdmin.value) return true

    switch (action) {
      case 'manage_company':
        return isCompanyOwner.value
      case 'manage_restaurants':
        return isRestaurantAdmin.value
      case 'manage_catalog':
      case 'manage_tables':
      case 'manage_digital_access':
        return isManager.value
      case 'manage_staff':
        return isRestaurantAdmin.value
      case 'view_reports':
        return isManager.value
      case 'manage_orders':
        return isManager.value || isWaiter.value || currentUser.value.role === 'receptionist'
      case 'kitchen_display':
        return isKitchenStaff.value || isManager.value
      case 'service_requests':
        return isWaiter.value || isManager.value || currentUser.value.role === 'receptionist'
      default:
        return false
    }
  }

  /** Recarrega a conta a partir da sessão atual. */
  const refresh = async () => {
    if (!isSupabaseConfigured) {
      currentUser.value = null
      hasSession.value = false
      return
    }
    isLoading.value = true
    try {
      let account = await authService.getAccount()
      // Convite de equipa pendente para este email? Ligar agora.
      if (account?.needsOnboarding && (await authService.claimInvitations()) > 0) {
        account = await authService.getAccount()
      }
      hasSession.value = !!account
      currentUser.value = account?.user ?? null
      needsOnboarding.value = !!account?.needsOnboarding
      mustSetPassword.value = !!account?.mustSetPassword
      setupRestaurantId.value = account?.setupRestaurantId ?? null
      accountEmail.value = account?.email ?? ''
      accountName.value = account?.fullName ?? ''
    } finally {
      isLoading.value = false
    }
  }

  /** Carrega a sessão uma vez e acompanha login/logout (incl. noutros separadores). */
  const init = () => {
    if (!initPromise) {
      initPromise = refresh().finally(() => {
        isReady.value = true
      })
      if (isSupabaseConfigured && !unsubscribe) {
        unsubscribe = authService.onAuthChange(event => {
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            // Fora do callback do Supabase (evita bloqueios do cliente).
            setTimeout(() => void refresh(), 0)
          }
        })
      }
    }
    return initPromise
  }

  const signIn = async (email: string, password: string) => {
    await authService.signIn(email, password)
    await refresh()
  }

  const sendPasswordReset = (email: string) =>
    authService.sendPasswordReset(email, `${window.location.origin}/redefinir-palavra-passe`)

  const updatePassword = (password: string) => authService.updatePassword(password)

  /** Define a palavra-passe do primeiro acesso e liga a conta ao estabelecimento. */
  const completeFirstAccess = async (password: string) => {
    await authService.updatePassword(password)
    await authService.completeFirstAccess()
    await refresh()
  }

  const logout = async () => {
    try {
      await authService.signOut()
    } finally {
      currentUser.value = null
      hasSession.value = false
      needsOnboarding.value = false
      mustSetPassword.value = false
      setupRestaurantId.value = null
      try {
        localStorage.removeItem('tapmenu_selected_tenant_id')
        localStorage.removeItem('tapmenu_selected_restaurant_id')
      } catch {
        // armazenamento local indisponível
      }
    }
  }

  return {
    currentUser,
    hasSession,
    needsOnboarding,
    mustSetPassword,
    setupRestaurantId,
    accountEmail,
    accountName,
    isLoading,
    isReady,
    isAuthenticated,
    currentRole,
    isSuperAdmin,
    isCompanyOwner,
    isRestaurantAdmin,
    isManager,
    isKitchenStaff,
    isWaiter,
    canAccessRestaurant,
    can,
    init,
    refresh,
    signIn,
    sendPasswordReset,
    updatePassword,
    completeFirstAccess,
    logout
  }
})
