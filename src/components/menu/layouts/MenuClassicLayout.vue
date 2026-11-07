<script setup lang="ts">
import type { Category, Product, MenuTheme } from '@/types'
import { Plus, Sparkles, Flame, Leaf } from 'lucide-vue-next'

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
  <div class="menu-classic-layout">
    <div
      v-for="cat in categories"
      :key="cat.id"
      class="classic-category-section"
      :id="`category-${cat.id}`"
    >
      <div class="category-header">
        <h2 class="cat-title">{{ cat.name }}</h2>
        <div class="cat-divider"></div>
      </div>

      <div class="classic-items-list">
        <div
          v-for="prod in products.filter(p => p.categoryId === cat.id)"
          :key="prod.id"
          class="classic-item-card"
          :class="{ 'unavailable': !prod.isAvailable }"
          @click="emit('view-product', prod)"
        >
          <div class="item-main">
            <div class="item-head">
              <span class="item-name">{{ prod.name }}</span>
              <span class="leader-dots"></span>
              <span v-if="theme.experience.showPrices" class="item-price font-mono">
                {{ prod.price.toLocaleString('pt-MZ') }} MT
              </span>
            </div>

            <p v-if="theme.experience.showDescriptions && prod.description" class="item-desc">
              {{ prod.description }}
            </p>

            <div class="badges-row">
              <span v-if="prod.isPromotion && theme.experience.showPromotions" class="badge-promo">
                <Sparkles :size="11" /> Especial
              </span>
              <span v-if="prod.isSpicy" class="badge-spicy">
                <Flame :size="11" /> Picante
              </span>
              <span v-if="prod.isVegetarian" class="badge-veg">
                <Leaf :size="11" /> Vegetariano
              </span>
            </div>
          </div>

          <div v-if="theme.experience.showImages && prod.imageUrl" class="item-thumb-wrap">
            <img :src="prod.imageUrl" :alt="prod.name" class="item-thumb" loading="lazy" />
          </div>

          <button
            v-if="theme.experience.showAddToOrder && prod.isAvailable"
            type="button"
            class="classic-add-btn"
            title="Adicionar ao Pedido"
            @click.stop="emit('add-to-cart', prod)"
          >
            <Plus :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-classic-layout {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1rem 0;
}

.classic-category-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cat-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--theme-text, #111827);
  white-space: nowrap;
  margin: 0;
}

.cat-divider {
  flex: 1;
  height: 2px;
  background: var(--theme-primary, #0d7a5f);
  opacity: 0.25;
}

.classic-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.classic-item-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.classic-item-card:hover {
  border-color: var(--theme-primary, #0d7a5f);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.item-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--theme-text, #111827);
}

.leader-dots {
  flex: 1;
  border-bottom: 1px dotted rgba(0, 0, 0, 0.2);
  margin-bottom: 3px;
}

.item-price {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--theme-primary, #0d7a5f);
}

.item-desc {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0.25rem 0 0.35rem;
  line-height: 1.35;
}

.badges-row {
  display: flex;
  gap: 0.35rem;
}

.badge-promo {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #d97706;
  background: #fef3c7;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.badge-spicy {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #dc2626;
  background: #fee2e2;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.badge-veg {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #16a34a;
  background: #dcfce7;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.item-thumb-wrap {
  width: 68px;
  height: 68px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.item-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.classic-add-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.1s;
}

.classic-add-btn:hover {
  transform: scale(1.05);
}

.unavailable {
  opacity: 0.55;
}
</style>

