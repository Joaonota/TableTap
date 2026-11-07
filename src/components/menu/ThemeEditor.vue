<script setup lang="ts">
import type { MenuTheme } from '@/types'
import { FONT_OPTIONS } from '@/services/menuCustomizationService'
import { Palette, Type, Sparkles } from 'lucide-vue-next'

interface Props {
  theme: MenuTheme
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:colors', colors: Partial<MenuTheme>): void
  (e: 'update:font', fontFamilyKey: string): void
}>()

const presetPalettes = [
  {
    name: 'Verde Moçambique (Padrão)',
    primary: '#0D7A5F',
    secondary: '#E69D00',
    accent: '#10B981',
    bg: '#FFFFFF',
    text: '#111827'
  },
  {
    name: 'Azul Índico & Marisco',
    primary: '#1E3A8A',
    secondary: '#3B82F6',
    accent: '#60A5FA',
    bg: '#F9FAFB',
    text: '#0F172A'
  },
  {
    name: 'Burgundy & Fine Dining',
    primary: '#831843',
    secondary: '#BE185D',
    accent: '#F472B6',
    bg: '#FFFDF9',
    text: '#1F2937'
  },
  {
    name: 'Café & Bistrô Chocolate',
    primary: '#78350F',
    secondary: '#B45309',
    accent: '#D97706',
    bg: '#FFFBEB',
    text: '#1E293B'
  },
  {
    name: 'Minimal Dark & Modern',
    primary: '#10B981',
    secondary: '#F59E0B',
    accent: '#06B6D4',
    bg: '#111827',
    text: '#F9FAFB'
  }
]

const applyPalette = (pal: typeof presetPalettes[0]) => {
  emit('update:colors', {
    primaryColor: pal.primary,
    secondaryColor: pal.secondary,
    accentColor: pal.accent,
    backgroundColor: pal.bg,
    textColor: pal.text
  })
}
</script>

<template>
  <div class="theme-editor">
    <!-- Preset Palettes -->
    <div class="editor-section">
      <div class="section-head">
        <Sparkles :size="16" class="icon-sparkle" />
        <h4 class="section-title">Paletas Pré-definidas</h4>
      </div>
      <div class="palettes-row">
        <button
          v-for="pal in presetPalettes"
          :key="pal.name"
          type="button"
          class="palette-chip"
          @click="applyPalette(pal)"
        >
          <div class="palette-dots">
            <span :style="{ background: pal.primary }"></span>
            <span :style="{ background: pal.secondary }"></span>
            <span :style="{ background: pal.accent }"></span>
          </div>
          <span class="pal-name">{{ pal.name }}</span>
        </button>
      </div>
    </div>

    <!-- Custom Colors Picker -->
    <div class="editor-section">
      <div class="section-head">
        <Palette :size="16" />
        <h4 class="section-title">Cores Personalizadas do Menu</h4>
      </div>

      <div class="colors-grid">
        <div class="color-control-item">
          <label class="color-label">Cor Primária (Botões, Títulos)</label>
          <div class="color-input-box">
            <input
              type="color"
              :value="theme.primaryColor"
              class="color-picker-input"
              @input="emit('update:colors', { primaryColor: ($event.target as HTMLInputElement).value })"
            />
            <input
              type="text"
              :value="theme.primaryColor"
              class="color-hex-text font-mono"
              @change="emit('update:colors', { primaryColor: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>

        <div class="color-control-item">
          <label class="color-label">Cor Secundária (Realces, Preços)</label>
          <div class="color-input-box">
            <input
              type="color"
              :value="theme.secondaryColor"
              class="color-picker-input"
              @input="emit('update:colors', { secondaryColor: ($event.target as HTMLInputElement).value })"
            />
            <input
              type="text"
              :value="theme.secondaryColor"
              class="color-hex-text font-mono"
              @change="emit('update:colors', { secondaryColor: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>

        <div class="color-control-item">
          <label class="color-label">Cor de Fundo do Menu</label>
          <div class="color-input-box">
            <input
              type="color"
              :value="theme.backgroundColor"
              class="color-picker-input"
              @input="emit('update:colors', { backgroundColor: ($event.target as HTMLInputElement).value })"
            />
            <input
              type="text"
              :value="theme.backgroundColor"
              class="color-hex-text font-mono"
              @change="emit('update:colors', { backgroundColor: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>

        <div class="color-control-item">
          <label class="color-label">Cor do Texto Principal</label>
          <div class="color-input-box">
            <input
              type="color"
              :value="theme.textColor"
              class="color-picker-input"
              @input="emit('update:colors', { textColor: ($event.target as HTMLInputElement).value })"
            />
            <input
              type="text"
              :value="theme.textColor"
              class="color-hex-text font-mono"
              @change="emit('update:colors', { textColor: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Typography Picker -->
    <div class="editor-section">
      <div class="section-head">
        <Type :size="16" />
        <h4 class="section-title">Família Tipográfica</h4>
      </div>

      <div class="fonts-grid">
        <div
          v-for="font in FONT_OPTIONS"
          :key="font.key"
          class="font-option-card"
          :class="{ 'is-selected': theme.fontFamilyKey === font.key }"
          :style="{ fontFamily: font.cssStack }"
          @click="emit('update:font', font.key)"
        >
          <span class="font-preview-letter">Aa</span>
          <div class="font-text-wrap">
            <strong class="font-name">{{ font.name }}</strong>
            <span class="font-sample">Prato do Dia • Salada de Camarão</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-editor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text, #111827);
}

.icon-sparkle {
  color: #f59e0b;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
}

.palettes-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.palette-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text, #111827);
  transition: all 0.15s;
}

.palette-chip:hover {
  border-color: var(--color-primary, #0d7a5f);
  background: #f9fafb;
}

.palette-dots {
  display: flex;
  gap: 3px;
}

.palette-dots span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.colors-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 600px) {
  .colors-grid {
    grid-template-columns: 1fr;
  }
}

.color-control-item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.color-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted, #4b5563);
}

.color-input-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #ffffff;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  padding: 0.35rem 0.55rem;
}

.color-picker-input {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  padding: 0;
}

.color-hex-text {
  flex: 1;
  border: none;
  font-size: 0.8125rem;
  color: var(--color-text, #111827);
  outline: none;
  text-transform: uppercase;
}

.fonts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.font-option-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.font-option-card:hover {
  border-color: var(--color-primary, #0d7a5f);
}

.font-option-card.is-selected {
  border-color: var(--color-primary, #0d7a5f);
  background: rgba(13, 122, 95, 0.04);
}

.font-preview-letter {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary, #0d7a5f);
  line-height: 1;
}

.font-text-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.font-name {
  font-size: 0.8125rem;
  color: var(--color-text, #111827);
}

.font-sample {
  font-size: 0.6875rem;
  color: var(--color-text-muted, #6b7280);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

