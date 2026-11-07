<script setup lang="ts">
import type { Category, Product, MenuTheme } from '@/types'
import { Plus, Sparkles } from 'lucide-vue-next'

interface Props {
  categories: Category[]
  products: Product[]
  theme: MenuTheme
  activeCategory?: string
  previewMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  previewMode: false
})

const emit = defineEmits<{
  (e: 'add-to-cart', product: Product): void
  (e: 'view-product', product: Product): void
}>()
</script>

<template>
  <div class="menu-elegant-layout">
    <div
      v-for="cat in categories"
      :key="cat.id"
      class="elegant-category-section"
      :id="`category-${cat.id}`"
    >
      <div class="elegant-cat-header">
        <span class="ornament">~ ❖ ~</span>
        <h2 class="cat-title">{{ cat.name }}</h2>
        <span class="cat-subtitle">Especialidades da Casa</span>
      </div>

      <div class="elegant-items-list">
        <div
          v-for="prod in products.filter(p => p.categoryId === cat.id)"
          :key="prod.id"
          class="elegant-item-row"
          :class="{ 'unavailable': !prod.isAvailable }"
          @click="emit('view-product', prod)"
        >
          <div class="item-title-row">
            <span class="item-name">{{ prod.name }}</span>
            <span class="leader-line"></span>
            <span v-if="theme.experience.showPrices" class="item-price">
              {{ prod.price.toLocaleString('pt-MZ') }} MT
            </span>
          </div>

          <div class="item-desc-row">
            <p v-if="theme.experience.showDescriptions && prod.description" class="item-desc">
              {{ prod.description }}
            </p>

            <button
              v-if="theme.experience.showAddToOrder && prod.isAvailable"
              type="button"
              class="elegant-add-btn"
              @click.stop="emit('add-to-cart', prod)"
            >
              <Plus :size="13" />
              <span>Solicitar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-elegant-layout {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  padding: 1.5rem 0.5rem;
  font-family: Georgia, 'Playfair Display', serif;
}

.elegant-category-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.elegant-cat-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.ornament {
  font-size: 0.8125rem;
  color: var(--theme-secondary, #e69d00);
  letter-spacing: 0.2em;
}

.cat-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--theme-text, #111827);
  margin: 0;
  text-transform: uppercase;
}

.cat-subtitle {
  font-size: 0.75rem;
  font-style: italic;
  color: #6b7280;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.elegant-items-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.elegant-item-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
}

.item-title-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.item-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--theme-text, #111827);
}

.leader-line {
  flex: 1;
  border-bottom: 1px dotted rgba(0, 0, 0, 0.25);
  margin-bottom: 4px;
}

.item-price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--theme-primary, #0d7a5f);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.item-desc-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.item-desc {
  font-size: 0.8125rem;
  color: #6b7280;
  line-height: 1.4;
  margin: 0;
  font-style: italic;
}

.elegant-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--theme-primary, #0d7a5f);
  color: var(--theme-primary, #0d7a5f);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.elegant-add-btn:hover {
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
}

.unavailable {
  opacity: 0.55;
}
</style>

