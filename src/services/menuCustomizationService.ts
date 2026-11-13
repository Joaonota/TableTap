// src/services/menuCustomizationService.ts
import { repositories } from '@/repositories'
import type { MenuCustomization, MenuFontOption, MenuTheme } from '@/types'

export const FONT_OPTIONS: MenuFontOption[] = [
  {
    key: 'inter',
    name: 'Inter (Moderno & Neutro)',
    cssStack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  {
    key: 'system',
    name: 'Sistema Nativo (Rápido)',
    cssStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  },
  {
    key: 'playfair',
    name: 'Playfair Serif (Elegante & Bistro)',
    cssStack: "'Playfair Display', Georgia, Cambria, 'Times New Roman', serif"
  },
  {
    key: 'poppins',
    name: 'Poppins (Arredondado & Amigável)',
    cssStack: "'Poppins', 'Segoe UI', Roboto, sans-serif"
  },
  {
    key: 'mono',
    name: 'Mono Clean (Minimalista)',
    cssStack: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  }
]

export const getDefaultTheme = (): MenuTheme => ({
  layout: 'modern',
  primaryColor: '#0D7A5F',
  secondaryColor: '#E69D00',
  accentColor: '#10B981',
  backgroundColor: '#FFFFFF',
  textColor: '#111827',
  fontFamilyKey: 'inter',
  logoUrl: '',
  coverImage: '',
  experience: {
    showSearch: true,
    showCategories: true,
    showImages: true,
    showDescriptions: true,
    showPrices: true,
    showAddToOrder: true,
    showPromotions: true,
    showFeaturedProducts: true,
    showWaiterCall: true,
    showOrders: true,
    showRestaurantInfo: true
  }
})

export const menuCustomizationService = {
  getFontOptions(): MenuFontOption[] {
    return FONT_OPTIONS
  },

  getDefaultTheme(): MenuTheme {
    return getDefaultTheme()
  },

  /**
   * Personalização guardada do restaurante. Sem registo, devolve o tema
   * padrão do TapMenu (sem gravar — só é gravado quando o restaurante publica).
   */
  async getCustomization(restaurantId: string, tenantId: string): Promise<MenuCustomization> {
    const found = await repositories.menuCustomizations.getByRestaurant(restaurantId)
    const defaults = getDefaultTheme()
    if (found) {
      return { ...found, theme: { ...defaults, ...found.theme, experience: { ...defaults.experience, ...found.theme.experience } } }
    }
    return { id: '', tenantId, restaurantId, theme: defaults, updatedAt: '', updatedBy: '' }
  },

  async saveCustomization(params: {
    restaurantId: string
    tenantId: string
    theme: MenuTheme
    updatedBy?: string
  }): Promise<MenuCustomization> {
    return repositories.menuCustomizations.save({
      tenantId: params.tenantId,
      restaurantId: params.restaurantId,
      theme: JSON.parse(JSON.stringify(params.theme)),
      updatedBy: params.updatedBy || 'Administrador'
    })
  },

  async resetToDefault(
    restaurantId: string,
    tenantId: string,
    updatedBy: string = 'Administrador'
  ): Promise<MenuCustomization> {
    return this.saveCustomization({
      restaurantId,
      tenantId,
      theme: getDefaultTheme(),
      updatedBy: `${updatedBy} (Reset Padrão)`
    })
  },

  applyThemeCssVars(theme: MenuTheme, targetElement?: HTMLElement): void {
    const el = targetElement || (typeof document !== 'undefined' ? document.documentElement : null)
    if (!el) return

    const fontOption = FONT_OPTIONS.find(f => f.key === theme.fontFamilyKey) || FONT_OPTIONS[0]

    el.style.setProperty('--theme-primary', theme.primaryColor)
    el.style.setProperty('--theme-secondary', theme.secondaryColor)
    el.style.setProperty('--theme-accent', theme.accentColor)
    el.style.setProperty('--theme-bg', theme.backgroundColor)
    el.style.setProperty('--theme-text', theme.textColor)
    el.style.setProperty('--theme-font', fontOption.cssStack)
  }
}

