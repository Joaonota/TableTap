import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'
import { authService } from '@/services'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const availableDemoUsers = ref<User[]>([])
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!currentUser.value)
  const currentRole = computed<UserRole | undefined>(() => currentUser.value?.role)

  const isSuperAdmin = computed(() => currentUser.value?.role === 'super_admin')
  const isCompanyOwner = computed(() => currentUser.value?.role === 'company_owner' || isSuperAdmin.value)
  const isRestaurantAdmin = computed(() =>
    currentUser.value?.role === 'restaurant_admin' || isCompanyOwner.value
  )
  const isManager = computed(() =>
    currentUser.value?.role === 'manager' || isRestaurantAdmin.value
  )
  const isKitchenStaff = computed(() => currentUser.value?.role === 'kitchen_staff')
  const isWaiter = computed(() => currentUser.value?.role === 'waiter')

  const canAccessRestaurant = (restaurantId: string): boolean => {
    if (!currentUser.value) return false
    if (isSuperAdmin.value) return true
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

  const init = async () => {
    isLoading.value = true
    try {
      availableDemoUsers.value = await authService.getDemoUsers()
      const user = await authService.getCurrentUser()
      currentUser.value = user
    } finally {
      isLoading.value = false
    }
  }

  const switchUser = async (userId: string) => {
    isLoading.value = true
    try {
      const user = await authService.loginAs(userId)
      currentUser.value = user
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    await authService.logout()
    currentUser.value = null
  }

  return {
    currentUser,
    availableDemoUsers,
    isLoading,
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
    switchUser,
    logout
  }
})
