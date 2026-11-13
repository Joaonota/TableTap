import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
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
  /** Contexto já carregado para o utilizador atual. */
  const hasLoaded = ref(false)

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

  /** Empresas e restaurantes visíveis (o RLS só devolve os do utilizador). */
  const loadContext = async () => {
    if (!authStore.currentUser) return
    isLoading.value = true
    try {
      const [companies, restaurants] = await Promise.all([
        tenantService.getAllCompanies(),
        restaurantService.getAllRestaurants()
      ])
      allCompanies.value = companies
      allRestaurants.value = restaurants
      hasLoaded.value = true

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

  /** Outro utilizador iniciou sessão (ou terminou): limpar o contexto. */
  watch(
    () => authStore.currentUser?.id,
    (id, previous) => {
      if (id === previous) return
      hasLoaded.value = false
      allCompanies.value = []
      allRestaurants.value = []
      currentCompany.value = null
      currentRestaurant.value = null
    }
  )

  return {
    hasLoaded,
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
