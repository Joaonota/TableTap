<script setup lang="ts">
import type { Category, Product, MenuTheme } from '@/types'
import { Plus } from 'lucide-vue-next'

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
  <div class="menu-compact-layout">
    <div
      v-for="cat in categories"
      :key="cat.id"
      class="compact-category-section"
      :id="`category-${cat.id}`"
    >
      <div class="compact-cat-bar">
        <span class="cat-name">{{ cat.name }}</span>
      </div>

      <div class="compact-items-table">
        <div
          v-for="prod in products.filter(p => p.categoryId === cat.id)"
          :key="prod.id"
          class="compact-row"
          :class="{ 'unavailable': !prod.isAvailable }"
          @click="emit('view-product', prod)"
        >
          <div class="compact-info">
            <span class="prod-title">{{ prod.name }}</span>
            <span v-if="theme.experience.showDescriptions && prod.description" class="prod-sub">
              {{ prod.description }}
            </span>
          </div>

          <div class="compact-right">
            <span v-if="theme.experience.showPrices" class="prod-price font-mono">
              {{ prod.price.toLocaleString('pt-MZ') }} MT
            </span>

            <button
              v-if="theme.experience.showAddToOrder && prod.isAvailable"
              type="button"
              class="compact-add-btn"
              @click.stop="emit('add-to-cart', prod)"
            >
              <Plus :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-compact-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.compact-category-section {
  display: flex;
  flex-direction: column;
}

.compact-cat-bar {
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.compact-items-table {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.compact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: background 0.1s;
}

.compact-row:last-child {
  border-bottom: none;
}

.compact-row:hover {
  background: rgba(0, 0, 0, 0.02);
}

.compact-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.prod-title {
  font-size: 0.8438rem;
  font-weight: 700;
  color: var(--theme-text, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prod-sub {
  font-size: 0.7188rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compact-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.prod-price {
  font-size: 0.8438rem;
  font-weight: 700;
  color: var(--theme-primary, #0d7a5f);
}

.compact-add-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--theme-primary, #0d7a5f);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.unavailable {
  opacity: 0.55;
}
</style>

