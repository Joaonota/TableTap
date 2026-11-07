<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Category, Product, Restaurant, MenuTheme } from '@/types'
import { FONT_OPTIONS } from '@/services/menuCustomizationService'
import MenuClassicLayout from './layouts/MenuClassicLayout.vue'
import MenuModernLayout from './layouts/MenuModernLayout.vue'
import MenuElegantLayout from './layouts/MenuElegantLayout.vue'
import MenuCompactLayout from './layouts/MenuCompactLayout.vue'
import MenuVisualLayout from './layouts/MenuVisualLayout.vue'
import { Smartphone, Monitor, Search, Bell, ShoppingBag } from 'lucide-vue-next'

interface Props {
  restaurant: Restaurant
  categories: Category[]
  products: Product[]
  theme: MenuTheme
}

const props = defineProps<Props>()

const deviceMode = ref<'mobile' | 'desktop'>('mobile')
const activeCatId = ref<string>('')
const searchQuery = ref('')

const currentFontStack = computed(() => {
  const opt = FONT_OPTIONS.find(f => f.key === props.theme.fontFamilyKey)
  return opt ? opt.cssStack : FONT_OPTIONS[0].cssStack
})

const filteredProducts = computed(() => {
  let list = props.products
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)))
  }
  return list
})

const activeCategories = computed(() => {
  if (activeCatId.value) {
    return props.categories.filter(c => c.id === activeCatId.value)
  }
  return props.categories
})
</script>

<template>
  <div class="menu-preview-wrapper">
    <!-- Device Mode Toolbar -->
    <div class="preview-toolbar">
      <span class="preview-title">Pré-visualização em Tempo Real</span>

      <div class="device-toggles">
        <button
          type="button"
          class="device-btn"
          :class="{ 'active': deviceMode === 'mobile' }"
          @click="deviceMode = 'mobile'"
          title="Modo Telemóvel"
        >
          <Smartphone :size="16" />
          <span>Mobile</span>
        </button>
        <button
          type="button"
          class="device-btn"
          :class="{ 'active': deviceMode === 'desktop' }"
          @click="deviceMode = 'desktop'"
          title="Modo Tablet/Desktop"
        >
          <Monitor :size="16" />
          <span>Desktop</span>
        </button>
      </div>
    </div>

    <!-- Canvas Frame -->
    <div class="preview-canvas-viewport" :class="`mode-${deviceMode}`">
      <div
        class="preview-screen"
        :style="{
          '--theme-primary': theme.primaryColor,
          '--theme-secondary': theme.secondaryColor,
          '--theme-accent': theme.accentColor,
          '--theme-bg': theme.backgroundColor,
          '--theme-text': theme.textColor,
          '--theme-font': currentFontStack,
          fontFamily: currentFontStack,
          backgroundColor: theme.backgroundColor,
          color: theme.textColor
        }"
      >
        <!-- Restaurant Header -->
        <header class="preview-menu-header">
          <div class="header-content">
            <div class="header-brand">
              <img
                v-if="restaurant.logoUrl"
                :src="restaurant.logoUrl"
                :alt="restaurant.name"
                class="restaurant-logo"
              />
              <div>
                <h1 class="restaurant-name">{{ restaurant.name }}</h1>
                <span class="table-pill">Mesa 01 • Sala Principal</span>
              </div>
            </div>

            <div v-if="theme.experience.showOrders" class="header-cart-icon">
              <ShoppingBag :size="18" />
              <span class="cart-badge">2</span>
            </div>
          </div>

          <!-- Search Bar -->
          <div v-if="theme.experience.showSearch" class="search-bar-wrap">
            <Search :size="15" class="search-icon" />
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Pesquisar no menu digital..."
              class="search-input"
            />
          </div>

          <!-- Category Nav Tabs -->
          <div v-if="theme.experience.showCategories" class="category-tabs-scroll">
            <button
              type="button"
              class="cat-tab-btn"
              :class="{ 'active': activeCatId === '' }"
              @click="activeCatId = ''"
            >
              Todos
            </button>
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              class="cat-tab-btn"
              :class="{ 'active': activeCatId === cat.id }"
              @click="activeCatId = cat.id"
            >
              {{ cat.name }}
            </button>
          </div>
        </header>

        <!-- Dynamic Menu Layout Component -->
        <main class="preview-menu-body">
          <component
            :is="
              theme.layout === 'classic' ? MenuClassicLayout :
              theme.layout === 'elegant' ? MenuElegantLayout :
              theme.layout === 'compact' ? MenuCompactLayout :
              theme.layout === 'visual' ? MenuVisualLayout :
              MenuModernLayout
            "
            :categories="activeCategories"
            :products="filteredProducts"
            :theme="theme"
            :preview-mode="true"
          />
        </main>

        <!-- Floating Waiter Call Button -->
        <div v-if="theme.experience.showWaiterCall" class="floating-waiter-btn">
          <Bell :size="18" />
          <span>Chamar Empregado</span>
        </div>

        <!-- Restaurant Footer Info -->
        <footer v-if="theme.experience.showRestaurantInfo" class="preview-menu-footer">
          <p>{{ restaurant.name }} • {{ restaurant.address?.city || 'Moçambique' }}</p>
          <span class="powered-by">Powered by TapMenu</span>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-preview-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  height: 100%;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
}

.preview-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text, #111827);
}

.device-toggles {
  display: flex;
  gap: 0.35rem;
}

.device-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7188rem;
  font-weight: 600;
  padding: 0.3rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--color-border, #d1d5db);
  background: #ffffff;
  color: var(--color-text-muted, #4b5563);
  cursor: pointer;
  transition: all 0.15s;
}

.device-btn.active {
  background: var(--color-primary, #0d7a5f);
  border-color: var(--color-primary, #0d7a5f);
  color: #ffffff;
}

.preview-canvas-viewport {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 1.5rem 1rem;
  overflow-y: auto;
  min-height: 520px;
}

.preview-canvas-viewport.mode-mobile .preview-screen {
  width: 375px;
  min-height: 640px;
  border-radius: 28px;
  border: 8px solid #1e293b;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
}

.preview-canvas-viewport.mode-desktop .preview-screen {
  width: 100%;
  max-width: 720px;
  min-height: 640px;
  border-radius: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.preview-screen {
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
}

.preview-menu-header {
  padding: 1rem 1rem 0.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: #ffffff;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.restaurant-logo {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.restaurant-name {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0;
  color: var(--theme-text, #111827);
}

.table-pill {
  font-size: 0.6875rem;
  color: #6b7280;
  font-weight: 600;
}

.header-cart-icon {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-primary, #0d7a5f);
}

.cart-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 800;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-bar-wrap {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 0 0.65rem;
  margin-bottom: 0.65rem;
}

.search-icon {
  color: #9ca3af;
  margin-right: 0.4rem;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  outline: none;
  color: #111827;
}

.category-tabs-scroll {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
  scrollbar-width: none;
}

.cat-tab-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: #4b5563;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.cat-tab-btn.active {
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
}

.preview-menu-body {
  flex: 1;
  padding: 0 1rem 4rem;
}

.floating-waiter-btn {
  position: absolute;
  bottom: 20px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border-radius: 30px;
  background: var(--theme-secondary, #e69d00);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.preview-menu-footer {
  padding: 1.5rem 1rem;
  text-align: center;
  font-size: 0.7188rem;
  color: #9ca3af;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.powered-by {
  font-weight: 700;
  color: var(--theme-primary, #0d7a5f);
  display: block;
  margin-top: 0.2rem;
}
</style>

