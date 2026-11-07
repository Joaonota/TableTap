<script setup lang="ts">
import type { MenuLayout } from '@/types'
import { Check, LayoutGrid, List, Sparkles, Image, AlignLeft } from 'lucide-vue-next'

interface Props {
  modelValue: MenuLayout
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: MenuLayout): void
}>()

const layouts: {
  key: MenuLayout
  name: string
  subtitle: string
  description: string
  icon: any
}[] = [
  {
    key: 'modern',
    name: 'Moderno',
    subtitle: 'Cards em grelha com imagens',
    description: 'Apresentação dinâmica e balanceada, ideal para a maioria dos restaurantes e cafés.',
    icon: LayoutGrid
  },
  {
    key: 'classic',
    name: 'Clássico',
    subtitle: 'Lista tradicional categorizada',
    description: 'Estrutura tradicional com pontilhados e separadores, familiar e simples de consultar.',
    icon: List
  },
  {
    key: 'elegant',
    name: 'Elegante',
    subtitle: 'Fine dining & tipografia serifada',
    description: 'Estética sofisticada com inspiração em cartas de vinhos e restaurantes gourmet.',
    icon: Sparkles
  },
  {
    key: 'compact',
    name: 'Compacto',
    subtitle: 'Alta densidade para bares & cafés',
    description: 'Máxima velocidade de consulta para estabelecimentos com rotação rápida.',
    icon: AlignLeft
  },
  {
    key: 'visual',
    name: 'Visual',
    subtitle: 'Galeria fotográfica de grande impacto',
    description: 'Foco total na apresentação visual e fotografia dos pratos gastronómicos.',
    icon: Image
  }
]
</script>

<template>
  <div class="layout-selector-grid">
    <div
      v-for="layout in layouts"
      :key="layout.key"
      class="layout-option-card"
      :class="{ 'is-selected': modelValue === layout.key }"
      @click="emit('update:modelValue', layout.key)"
    >
      <div class="card-radio-wrap">
        <div class="card-radio" :class="{ 'checked': modelValue === layout.key }">
          <Check v-if="modelValue === layout.key" :size="12" />
        </div>
        <component :is="layout.icon" :size="20" class="layout-icon" />
      </div>

      <div class="card-text">
        <h4 class="layout-name">{{ layout.name }}</h4>
        <span class="layout-sub">{{ layout.subtitle }}</span>
        <p class="layout-desc">{{ layout.description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.85rem;
}

.layout-option-card {
  background: var(--color-surface, #ffffff);
  border: 2px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s ease;
  user-select: none;
}

.layout-option-card:hover {
  border-color: var(--color-primary, #0d7a5f);
  background: #fdfdfd;
}

.layout-option-card.is-selected {
  border-color: var(--color-primary, #0d7a5f);
  background: rgba(13, 122, 95, 0.04);
}

.card-radio-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border, #d1d5db);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  color: #ffffff;
  transition: all 0.15s;
}

.card-radio.checked {
  background: var(--color-primary, #0d7a5f);
  border-color: var(--color-primary, #0d7a5f);
}

.layout-icon {
  color: var(--color-primary, #0d7a5f);
}

.layout-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text, #111827);
  margin: 0;
}

.layout-sub {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary, #0d7a5f);
  display: block;
  margin: 0.15rem 0 0.35rem;
}

.layout-desc {
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.35;
  margin: 0;
}
</style>

