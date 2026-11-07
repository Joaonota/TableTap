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
  <div class="menu-visual-layout">
    <div
      v-for="cat in categories"
      :key="cat.id"
      class="visual-category-section"
      :id="`category-${cat.id}`"
    >
      <div class="visual-cat-title-wrap">
        <h2 class="cat-title">{{ cat.name }}</h2>
        <div class="cat-line"></div>
      </div>

      <div class="visual-gallery-grid">
        <div
          v-for="prod in products.filter(p => p.categoryId === cat.id)"
          :key="prod.id"
          class="visual-hero-card"
          :class="{ 'unavailable': !prod.isAvailable }"
          @click="emit('view-product', prod)"
        >
          <div class="hero-image-box">
            <img
              :src="prod.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'"
              :alt="prod.name"
              class="hero-img"
              loading="lazy"
            />
            <div class="image-gradient-overlay"></div>

            <div class="hero-top-badges">
              <span v-if="prod.isPromotion && theme.experience.showPromotions" class="badge-promo">
                <Sparkles :size="12" /> Destaque
              </span>
              <span v-if="prod.isSpicy" class="badge-spicy">
                <Flame :size="12" />
              </span>
              <span v-if="prod.isVegetarian" class="badge-veg">
                <Leaf :size="12" />
              </span>
            </div>

            <div class="hero-overlay-details">
              <h3 class="hero-title">{{ prod.name }}</h3>
              <p v-if="theme.experience.showDescriptions && prod.description" class="hero-desc">
                {{ prod.description }}
              </p>
            </div>
          </div>

          <div class="hero-card-footer">
            <span v-if="theme.experience.showPrices" class="hero-price font-mono">
              {{ prod.price.toLocaleString('pt-MZ') }} MT
            </span>

            <button
              v-if="theme.experience.showAddToOrder && prod.isAvailable"
              type="button"
              class="visual-add-btn"
              @click.stop="emit('add-to-cart', prod)"
            >
              <Plus :size="16" />
              <span>Pedir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-visual-layout {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  padding: 1rem 0;
}

.visual-category-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.visual-cat-title-wrap {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cat-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--theme-text, #111827);
  margin: 0;
}

.cat-line {
  flex: 1;
  height: 2px;
  background: var(--theme-accent, #10b981);
  border-radius: 2px;
}

.visual-gallery-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

@media (max-width: 600px) {
  .visual-gallery-grid {
    grid-template-columns: 1fr;
  }
}

.visual-hero-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.visual-hero-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.hero-image-box {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.visual-hero-card:hover .hero-img {
  transform: scale(1.05);
}

.image-gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%);
}

.hero-top-badges {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 0.35rem;
  z-index: 2;
}

.badge-promo {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 800;
  background: #f59e0b;
  color: #ffffff;
  padding: 0.2rem 0.55rem;
  border-radius: 20px;
}

.badge-spicy {
  background: #ef4444;
  color: #ffffff;
  padding: 0.2rem 0.4rem;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
}

.badge-veg {
  background: #10b981;
  color: #ffffff;
  padding: 0.2rem 0.4rem;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
}

.hero-overlay-details {
  position: absolute;
  bottom: 10px;
  left: 12px;
  right: 12px;
  z-index: 2;
  color: #ffffff;
}

.hero-title {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0 0 0.2rem;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}

.hero-desc {
  font-size: 0.75rem;
  color: #e2e8f0;
  line-height: 1.35;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}

.hero-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  background: #ffffff;
}

.hero-price {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--theme-primary, #0d7a5f);
}

.visual-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.85rem;
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.visual-add-btn:hover {
  opacity: 0.9;
}

.unavailable {
  opacity: 0.6;
}
</style>

