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
  <div class="menu-modern-layout">
    <div
      v-for="cat in categories"
      :key="cat.id"
      class="modern-category-section"
      :id="`category-${cat.id}`"
    >
      <div class="category-header">
        <h2 class="cat-title">{{ cat.name }}</h2>
        <span class="cat-count">
          {{ products.filter(p => p.categoryId === cat.id).length }} opções
        </span>
      </div>

      <div class="modern-cards-grid">
        <div
          v-for="prod in products.filter(p => p.categoryId === cat.id)"
          :key="prod.id"
          class="modern-card"
          :class="{ 'unavailable': !prod.isAvailable }"
          @click="emit('view-product', prod)"
        >
          <div v-if="theme.experience.showImages && prod.imageUrl" class="card-image-wrap">
            <img :src="prod.imageUrl" :alt="prod.name" class="card-img" loading="lazy" />
            <div class="image-badges">
              <span v-if="prod.isPromotion && theme.experience.showPromotions" class="badge-promo">
                <Sparkles :size="10" /> Promo
              </span>
              <span v-if="prod.isSpicy" class="badge-spicy">
                <Flame :size="10" />
              </span>
              <span v-if="prod.isVegetarian" class="badge-veg">
                <Leaf :size="10" />
              </span>
            </div>
          </div>

          <div class="card-body">
            <h3 class="card-name">{{ prod.name }}</h3>
            <p v-if="theme.experience.showDescriptions && prod.description" class="card-desc">
              {{ prod.description }}
            </p>

            <div class="card-bottom">
              <span v-if="theme.experience.showPrices" class="card-price font-mono">
                {{ prod.price.toLocaleString('pt-MZ') }} MT
              </span>

              <button
                v-if="theme.experience.showAddToOrder && prod.isAvailable"
                type="button"
                class="modern-add-btn"
                @click.stop="emit('add-to-cart', prod)"
              >
                <Plus :size="16" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-modern-layout {
  display: flex;
  flex-direction: column;
  gap: 2.25rem;
  padding: 1rem 0;
}

.modern-category-section {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.category-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  border-bottom: 2px solid var(--theme-primary, #0d7a5f);
  padding-bottom: 0.4rem;
}

.cat-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--theme-text, #111827);
  margin: 0;
}

.cat-count {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
}

.modern-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 600px) {
  .modern-cards-grid {
    grid-template-columns: 1fr;
  }
}

.modern-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.modern-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: var(--theme-primary, #0d7a5f);
}

.card-image-wrap {
  position: relative;
  width: 100%;
  height: 140px;
  background: #f3f4f6;
  overflow: hidden;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.modern-card:hover .card-img {
  transform: scale(1.04);
}

.image-badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 0.3rem;
}

.badge-promo {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #ffffff;
  background: #d97706;
  padding: 0.15rem 0.45rem;
  border-radius: 20px;
}

.badge-spicy {
  display: inline-flex;
  align-items: center;
  color: #ffffff;
  background: #dc2626;
  padding: 0.15rem 0.35rem;
  border-radius: 20px;
}

.badge-veg {
  display: inline-flex;
  align-items: center;
  color: #ffffff;
  background: #16a34a;
  padding: 0.15rem 0.35rem;
  border-radius: 20px;
}

.card-body {
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--theme-text, #111827);
  margin: 0;
}

.card-desc {
  font-size: 0.7813rem;
  color: #6b7280;
  line-height: 1.35;
  margin: 0.35rem 0 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-price {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--theme-primary, #0d7a5f);
}

.modern-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.modern-add-btn:hover {
  opacity: 0.9;
}

.unavailable {
  opacity: 0.6;
}
</style>

