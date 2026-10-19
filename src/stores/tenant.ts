import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Company, Restaurant } from '@/types'
import { tenantService, restaurantService } from '@/services'
import { useAuthStore } from './auth'

export const useTenantStore = defineStore('tenant', () => {
  const authStore = useAuthStore()

  const allCompanies = ref<Company[]>([])
  const allRestaurants = ref<Restaurant[]>([])
  const currentCompany = ref<Company | null>(null)
  const currentRestaurant = ref<Restaurant | null>(null)
  const isLoading = ref(false)

  // Companies accessible by current user
  const availableCompanies = computed<Company[]>(() => {
    if (!authStore.currentUser) return []
    if (authStore.isSuperAdmin) return allCompanies.value

    if (authStore.currentUser.tenantId) {
      return allCompanies.value.filter(c => c.id === authStore.currentUser?.tenantId)
    }
    return []
  })

  // Restaurants accessible for currently selected company
  const availableRestaurants = computed<Restaurant[]>(() => {
    if (!currentCompany.value || !authStore.currentUser) return []

    const companyRestaurants = allRestaurants.value.filter(
      r => r.tenantId === currentCompany.value?.id
    )

    if (authStore.isSuperAdmin || authStore.currentUser.role === 'company_owner') {
      return companyRestaurants
    }

    // Filter by assignedRestaurantIds
    return companyRestaurants.filter(r =>
      authStore.currentUser?.assignedRestaurantIds.includes(r.id)
    )
  })

  const loadContext = async () => {
    isLoading.value = true
    try {
      allCompanies.value = await tenantService.getAllCompanies()
      allRestaurants.value = await restaurantService.getAllRestaurants()

      // Set initial company
      if (availableCompanies.value.length > 0) {
        const savedCompanyId = localStorage.getItem('tapmenu_selected_tenant_id')
        const foundCompany = availableCompanies.value.find(c => c.id === savedCompanyId)
        currentCompany.value = foundCompany || availableCompanies.value[0]
      } else {
        currentCompany.value = null
      }

      // Set initial restaurant
      syncSelectedRestaurant()
    } finally {
      isLoading.value = false
    }
  }

  const syncSelectedRestaurant = () => {
    if (availableRestaurants.value.length > 0) {
      const savedRestId = localStorage.getItem('tapmenu_selected_restaurant_id')
      const foundRest = availableRestaurants.value.find(r => r.id === savedRestId)
      currentRestaurant.value = foundRest || availableRestaurants.value[0]
      if (currentRestaurant.value) {
        localStorage.setItem('tapmenu_selected_restaurant_id', currentRestaurant.value.id)
      }
    } else {
      currentRestaurant.value = null
      localStorage.removeItem('tapmenu_selected_restaurant_id')
    }
  }

  const setCompany = (companyId: string) => {
    const comp = availableCompanies.value.find(c => c.id === companyId)
    if (comp) {
      currentCompany.value = comp
      localStorage.setItem('tapmenu_selected_tenant_id', comp.id)
      syncSelectedRestaurant()
    }
  }

  const setRestaurant = (restaurantId: string) => {
    const rest = availableRestaurants.value.find(r => r.id === restaurantId)
    if (rest) {
      currentRestaurant.value = rest
      localStorage.setItem('tapmenu_selected_restaurant_id', rest.id)
    }
  }

  return {
    allCompanies,
    allRestaurants,
    currentCompany,
    currentRestaurant,
    availableCompanies,
    availableRestaurants,
    isLoading,
    loadContext,
    setCompany,
    setRestaurant,
    syncSelectedRestaurant
  }
})
