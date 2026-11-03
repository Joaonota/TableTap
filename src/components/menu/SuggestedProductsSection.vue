<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types'
import { Sparkles, Plus } from 'lucide-vue-next'

const props = defineProps<{
  products: Product[]
}>()

const emit = defineEmits<{
  (e: 'select-product', product: Product): void
}>()

// Filter relevant suggestions (drinks, desserts, sides, or featured items)
const suggestions = computed(() => {
  return props.products
    .filter(p => p.isAvailable && (p.isFeatured || p.station === 'bar' || p.categoryName?.toLowerCase().includes('bebida') || p.categoryName?.toLowerCase().includes('sobremesa')))
    .slice(0, 6)
})
</script>

<template>
  <div v-if="suggestions.length > 0" class="suggestions-wrapper">
    <div class="suggestions-header">
      <div class="header-badge">
        <Sparkles :size="16" class="sparkle-icon" />
        <span class="badge-title">Sugestões do Chefe</span>
      </div>
      <h3 class="suggestions-title">Quer pedir mais alguma coisa?</h3>
      <p class="suggestions-sub">
        Bebidas refrescantes, acompanhamentos e sobremesas que combinam perfeitamente com a sua refeição.
      </p>
    </div>

    <div class="suggestions-grid">
      <div
        v-for="product in suggestions"
        :key="product.id"
        class="suggestion-card"
        @click="emit('select-product', product)"
      >
        <div class="suggestion-img-box">
          <img :src="product.imageUrl" :alt="product.name" class="suggestion-thumb" loading="lazy" />
          <span v-if="product.promotionalPrice" class="promo-tag">Promo</span>
        </div>

        <div class="suggestion-content">
          <div class="suggestion-name" :title="product.name">{{ product.name }}</div>
          <div class="suggestion-price">
            <span v-if="product.promotionalPrice" class="old-price">
              {{ product.price.toLocaleString('pt-MZ') }} MT
            </span>
            <span class="actual-price">
              {{ (product.promotionalPrice ?? product.price).toLocaleString('pt-MZ') }} MT
            </span>
          </div>
        </div>

        <button
          type="button"
          class="suggestion-add-btn"
          aria-label="Adicionar sugestão"
          @click.stop="emit('select-product', product)"
        >
          <Plus :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.suggestions-wrapper {
  margin: 1.5rem 0;
  padding: 1.25rem;
  background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
  border: 1.5px solid #dbeafe;
  border-radius: var(--radius-xl);
}

.suggestions-header {
  margin-bottom: 1rem;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary-800);
  background-color: #dbeafe;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  margin-bottom: 0.35rem;
}

.sparkle-icon {
  color: var(--color-primary-600);
}

.suggestions-title {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.01em;
}

.suggestions-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
  gap: 0.75rem;
}

@media (max-width: 480px) {
  .suggestions-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .suggestion-card {
    min-width: 0;
  }
}

.suggestion-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  background-color: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.suggestion-card:hover {
  border-color: var(--color-primary-400);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.suggestion-img-box {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  background-color: var(--color-slate-100);
}

.suggestion-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.promo-tag {
  position: absolute;
  top: 2px;
  left: 2px;
  background-color: var(--color-danger-500);
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: var(--radius-sm);
}

.suggestion-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.suggestion-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-price {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.old-price {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-decoration: line-through;
}

.actual-price {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--color-primary-800);
}

.suggestion-add-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  border: 1px solid var(--color-primary-200);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.suggestion-add-btn:hover {
  background-color: var(--color-primary-600);
  color: #ffffff;
  border-color: var(--color-primary-600);
}
</style>
