// src/stores/menuCustomization.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuCustomization, MenuLayout, MenuTheme, MenuThemeExperience } from '@/types'
import { menuCustomizationService, FONT_OPTIONS, getDefaultTheme } from '@/services/menuCustomizationService'
import { useToastStore } from './toast'

export const useMenuCustomizationStore = defineStore('menuCustomization', () => {
  const toastStore = useToastStore()

  const currentCustomization = ref<MenuCustomization | null>(null)
  const draftTheme = ref<MenuTheme>(getDefaultTheme())
  const activeRestaurantId = ref<string>('')
  const activeTenantId = ref<string>('')
  const isLoading = ref(false)
  const isSaving = ref(false)

  const isDirty = computed(() => {
    if (!currentCustomization.value) return false
    return JSON.stringify(draftTheme.value) !== JSON.stringify(currentCustomization.value.theme)
  })

  const fetchCustomization = async (restaurantId: string, tenantId: string) => {
    if (!restaurantId) return
    activeRestaurantId.value = restaurantId
    activeTenantId.value = tenantId
    isLoading.value = true

    try {
      const mc = await menuCustomizationService.getCustomization(restaurantId, tenantId)
      currentCustomization.value = mc
      draftTheme.value = JSON.parse(JSON.stringify(mc.theme))
    } catch (e: any) {
      toastStore.error('Erro ao carregar personalização do menu', e.message)
    } finally {
      isLoading.value = false
    }
  }

  const setLayout = (layout: MenuLayout) => {
    draftTheme.value.layout = layout
  }

  const setFont = (fontFamilyKey: string) => {
    draftTheme.value.fontFamilyKey = fontFamilyKey
  }

  const setColors = (colors: {
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    backgroundColor?: string
    textColor?: string
  }) => {
    if (colors.primaryColor !== undefined) draftTheme.value.primaryColor = colors.primaryColor
    if (colors.secondaryColor !== undefined) draftTheme.value.secondaryColor = colors.secondaryColor
    if (colors.accentColor !== undefined) draftTheme.value.accentColor = colors.accentColor
    if (colors.backgroundColor !== undefined) draftTheme.value.backgroundColor = colors.backgroundColor
    if (colors.textColor !== undefined) draftTheme.value.textColor = colors.textColor
  }

  const setExperienceToggle = (key: keyof MenuThemeExperience, value: boolean) => {
    draftTheme.value.experience[key] = value
  }

  const save = async (updatedBy: string = 'Administrador'): Promise<boolean> => {
    if (!activeRestaurantId.value || !activeTenantId.value) return false
    isSaving.value = true
    try {
      const saved = await menuCustomizationService.saveCustomization({
        restaurantId: activeRestaurantId.value,
        tenantId: activeTenantId.value,
        theme: draftTheme.value,
        updatedBy
      })
      currentCustomization.value = saved
      draftTheme.value = JSON.parse(JSON.stringify(saved.theme))
      toastStore.success('Personalização Guardada!', 'O novo tema e layout foram aplicados ao menu digital dos clientes.')
      return true
    } catch (e: any) {
      toastStore.error('Erro ao guardar personalização', e.message)
      return false
    } finally {
      isSaving.value = false
    }
  }

  const resetToDefault = async (updatedBy: string = 'Administrador'): Promise<boolean> => {
    if (!activeRestaurantId.value || !activeTenantId.value) return false
    isSaving.value = true
    try {
      const reset = await menuCustomizationService.resetToDefault(
        activeRestaurantId.value,
        activeTenantId.value,
        updatedBy
      )
      currentCustomization.value = reset
      draftTheme.value = JSON.parse(JSON.stringify(reset.theme))
      toastStore.success('Tema Restaurado', 'O menu voltou aos padrões oficiais do TapMenu.')
      return true
    } catch (e: any) {
      toastStore.error('Erro ao restaurar tema padrão', e.message)
      return false
    } finally {
      isSaving.value = false
    }
  }

  return {
    currentCustomization,
    draftTheme,
    activeRestaurantId,
    activeTenantId,
    isLoading,
    isSaving,
    isDirty,
    fontOptions: FONT_OPTIONS,
    fetchCustomization,
    setLayout,
    setFont,
    setColors,
    setExperienceToggle,
    save,
    resetToDefault
  }
})

