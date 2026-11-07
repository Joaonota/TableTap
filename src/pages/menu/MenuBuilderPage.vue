<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { useMenuCustomizationStore } from '@/stores/menuCustomization'
import { useSubscriptionStore } from '@/stores/subscription'
import { categoryService, productService } from '@/services'
import type { Category, Product, Restaurant } from '@/types'
import LayoutSelector from '@/components/menu/LayoutSelector.vue'
import ThemeEditor from '@/components/menu/ThemeEditor.vue'
import MenuSettings from '@/components/menu/MenuSettings.vue'
import MenuPreview from '@/components/menu/MenuPreview.vue'
import UpgradeModal from '@/components/super-admin/UpgradeModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  Palette,
  Layout,
  Sliders,
  RotateCcw,
  Save,
  Sparkles,
  Lock,
  ArrowRight
} from 'lucide-vue-next'

const tenantStore = useTenantStore()
const customizationStore = useMenuCustomizationStore()
const subscriptionStore = useSubscriptionStore()

const activeTab = ref<'layout' | 'theme' | 'experience'>('layout')
const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const isLoadingContent = ref(true)
const isUpgradeModalOpen = ref(false)

const currentRestaurant = computed(() => tenantStore.currentRestaurant)

const restaurantOptions = computed(() => {
  return tenantStore.availableRestaurants.map((r: Restaurant) => ({
    label: r.name,
    value: r.id
  }))
})

const hasCustomizationFeature = computed(() => {
  return subscriptionStore.hasFeature('MENU_CUSTOMIZATION')
})

const loadRestaurantData = async () => {
  if (!currentRestaurant.value) return
  isLoadingContent.value = true
  try {
    const [cats, prods] = await Promise.all([
      categoryService.getCategories(currentRestaurant.value.id),
      productService.getProducts(currentRestaurant.value.id),
      customizationStore.fetchCustomization(currentRestaurant.value.id, currentRestaurant.value.tenantId),
      subscriptionStore.fetchSubscriptionData()
    ])
    categories.value = cats
    products.value = prods
  } finally {
    isLoadingContent.value = false
  }
}

onMounted(() => {
  loadRestaurantData()
})

watch(
  () => tenantStore.currentRestaurant?.id,
  () => {
    loadRestaurantData()
  }
)

const handleRestaurantChange = (val: string | number) => {
  tenantStore.setRestaurant(String(val))
}

const handleSave = async () => {
  await customizationStore.save(tenantStore.currentCompany?.name || 'Administrador')
}

const handleReset = async () => {
  if (confirm('Tem a certeza de que pretende repor o tema e layout padrão do TapMenu?')) {
    await customizationStore.resetToDefault(tenantStore.currentCompany?.name || 'Administrador')
  }
}
</script>

<template>
  <div class="menu-builder-page">
    <!-- Header -->
    <div class="builder-header">
      <div class="builder-title-block">
        <h1 class="page-title">Personalização Visual do Menu Digital</h1>
        <p class="page-subtitle">Configure o modelo visual, as cores da sua marca e a experiência dos seus clientes</p>
      </div>

      <div class="builder-actions">
        <!-- Restaurant Selector if multiple -->
        <div v-if="restaurantOptions.length > 1" class="rest-selector-wrap">
          <AppSelect
            id="builder-rest-select"
            :model-value="currentRestaurant?.id || ''"
            :options="restaurantOptions"
            @update:model-value="handleRestaurantChange"
          />
        </div>

        <AppButton
          variant="outline"
          :disabled="customizationStore.isSaving"
          @click="handleReset"
        >
          <RotateCcw :size="15" />
          <span>Restaurar Padrão</span>
        </AppButton>

        <AppButton
          variant="primary"
          :disabled="!customizationStore.isDirty || customizationStore.isSaving"
          @click="handleSave"
        >
          <Save :size="15" />
          <span>{{ customizationStore.isSaving ? 'A Guardar...' : 'Publicar Alterações' }}</span>
        </AppButton>
      </div>
    </div>

    <!-- Feature Locked Banner if basic plan -->
    <div v-if="!hasCustomizationFeature && !subscriptionStore.isLoading" class="locked-feature-banner">
      <div class="lock-icon-wrap">
        <Lock :size="20" />
      </div>
      <div class="lock-banner-text">
        <strong>Funcionalidade Exclusiva dos Planos Pro, Business & Enterprise</strong>
        <p>O seu plano atual ({{ subscriptionStore.currentPlan?.name || 'Básico' }}) utiliza o layout clássico padrão. Atualize para personalizar cores, fontes, e escolher entre 5 layouts exclusivos.</p>
      </div>
      <AppButton variant="primary" size="sm" @click="isUpgradeModalOpen = true">
        <Sparkles :size="14" />
        <span>Fazer Upgrade</span>
      </AppButton>
    </div>

    <!-- Main Builder Split View -->
    <div class="builder-split-grid" :class="{ 'is-locked-view': !hasCustomizationFeature }">
      <!-- Left Controls Panel -->
      <div class="builder-controls-panel">
        <!-- Tabs -->
        <div class="builder-tabs-nav">
          <button
            type="button"
            class="b-tab-btn"
            :class="{ 'active': activeTab === 'layout' }"
            @click="activeTab = 'layout'"
          >
            <Layout :size="16" />
            <span>1. Layout do Menu</span>
          </button>

          <button
            type="button"
            class="b-tab-btn"
            :class="{ 'active': activeTab === 'theme' }"
            @click="activeTab = 'theme'"
          >
            <Palette :size="16" />
            <span>2. Cores & Tipografia</span>
          </button>

          <button
            type="button"
            class="b-tab-btn"
            :class="{ 'active': activeTab === 'experience' }"
            @click="activeTab = 'experience'"
          >
            <Sliders :size="16" />
            <span>3. Experiência & Toggles</span>
          </button>
        </div>

        <!-- Tab Body -->
        <div class="builder-controls-body">
          <div v-show="activeTab === 'layout'" class="controls-pane">
            <LayoutSelector
              :model-value="customizationStore.draftTheme.layout"
              @update:model-value="customizationStore.setLayout"
            />
          </div>

          <div v-show="activeTab === 'theme'" class="controls-pane">
            <ThemeEditor
              :theme="customizationStore.draftTheme"
              @update:colors="customizationStore.setColors"
              @update:font="customizationStore.setFont"
            />
          </div>

          <div v-show="activeTab === 'experience'" class="controls-pane">
            <MenuSettings
              :experience="customizationStore.draftTheme.experience"
              @update:experience="customizationStore.setExperienceToggle"
            />
          </div>
        </div>
      </div>

      <!-- Right Live Preview Panel -->
      <div class="builder-preview-panel">
        <MenuPreview
          v-if="currentRestaurant"
          :restaurant="currentRestaurant"
          :categories="categories"
          :products="products"
          :theme="customizationStore.draftTheme"
        />
      </div>
    </div>

    <!-- Upgrade Modal -->
    <UpgradeModal
      :is-open="isUpgradeModalOpen"
      trigger-reason="Desbloqueie a Personalização Completa de Menus e Layouts no plano Pro."
      required-plan-name="Pro"
      @close="isUpgradeModalOpen = false"
      @upgraded="loadRestaurantData"
    />
  </div>
</template>

<style scoped>
.menu-builder-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.builder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-text, #111827);
  margin: 0;
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted, #6b7280);
  margin: 0.2rem 0 0;
}

.builder-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rest-selector-wrap {
  width: 200px;
}

.locked-feature-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.lock-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #f59e0b;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lock-banner-text {
  flex: 1;
}

.lock-banner-text strong {
  display: block;
  font-size: 0.9375rem;
  color: #92400e;
}

.lock-banner-text p {
  font-size: 0.8125rem;
  color: #78350f;
  margin: 0.15rem 0 0;
}

.builder-split-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .builder-split-grid {
    grid-template-columns: 1fr;
  }
}

.builder-controls-panel {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.builder-tabs-nav {
  display: flex;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-background, #f9fafb);
}

.b-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted, #6b7280);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
}

.b-tab-btn:hover {
  color: var(--color-text, #111827);
}

.b-tab-btn.active {
  background: #ffffff;
  color: var(--color-primary, #0d7a5f);
  border-bottom-color: var(--color-primary, #0d7a5f);
}

.builder-controls-body {
  padding: 1.25rem;
  max-height: 680px;
  overflow-y: auto;
}

.builder-preview-panel {
  position: sticky;
  top: 1.5rem;
  height: calc(100vh - 120px);
  min-height: 600px;
}
</style>

