<script setup lang="ts">
import type { MenuThemeExperience } from '@/types'
import { Check, Settings, ToggleLeft, ToggleRight } from 'lucide-vue-next'

interface Props {
  experience: MenuThemeExperience
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:experience', key: keyof MenuThemeExperience, value: boolean): void
}>()

const settingsList: {
  key: keyof MenuThemeExperience
  title: string
  description: string
}[] = [
  {
    key: 'showSearch',
    title: 'Barra de Pesquisa no Menu',
    description: 'Permite que o cliente filtre pratos e bebidas instantaneamente por texto.'
  },
  {
    key: 'showCategories',
    title: 'Separadores de Categorias',
    description: 'Exibe a barra horizontal de navegação rápida entre secções do menu.'
  },
  {
    key: 'showImages',
    title: 'Fotografias dos Produtos',
    description: 'Apresenta as imagens dos pratos (desative para menus puramente textuais).'
  },
  {
    key: 'showDescriptions',
    title: 'Descrições e Ingredientes',
    description: 'Exibe o texto explicativo sobre o preparo, guarnições e notas dos pratos.'
  },
  {
    key: 'showPrices',
    title: 'Exibição de Preços',
    description: 'Apresenta o valor em Meticais (MT) junto ao nome do produto.'
  },
  {
    key: 'showAddToOrder',
    title: 'Botão de Pedido Direto (+)',
    description: 'Permite aos clientes adicionar o produto diretamente ao carrinho da mesa.'
  },
  {
    key: 'showPromotions',
    title: 'Destaques e Pratos Especiais',
    description: 'Realça visualmente os produtos marcados como sugestão do chef ou promoção.'
  },
  {
    key: 'showWaiterCall',
    title: 'Botão de Chamada de Atendimento',
    description: 'Exibe o botão flutuante para solicitar empregado, conta ou talheres.'
  },
  {
    key: 'showOrders',
    title: 'Acompanhamento do Pedido',
    description: 'Mostra o progresso dos pedidos da sessão atual do cliente.'
  },
  {
    key: 'showRestaurantInfo',
    title: 'Informações e Contactos do Restaurante',
    description: 'Apresenta morada, NUIT, telefone e horário no rodapé do menu digital.'
  }
]
</script>

<template>
  <div class="menu-settings-container">
    <div class="settings-grid">
      <div
        v-for="item in settingsList"
        :key="item.key"
        class="setting-item-row"
        @click="emit('update:experience', item.key, !experience[item.key])"
      >
        <div class="setting-text">
          <strong class="setting-title">{{ item.title }}</strong>
          <p class="setting-desc">{{ item.description }}</p>
        </div>

        <button
          type="button"
          class="switch-btn"
          :class="{ 'is-active': experience[item.key] }"
        >
          <div class="switch-handle"></div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-settings-container {
  display: flex;
  flex-direction: column;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.85rem;
}

.setting-item-row {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}

.setting-item-row:hover {
  border-color: var(--color-primary, #0d7a5f);
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.setting-title {
  font-size: 0.8438rem;
  color: var(--color-text, #111827);
}

.setting-desc {
  font-size: 0.7188rem;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.35;
  margin: 0;
}

.switch-btn {
  width: 40px;
  height: 22px;
  border-radius: 12px;
  background: #d1d5db;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.switch-btn.is-active {
  background: var(--color-primary, #0d7a5f);
}

.switch-handle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.switch-btn.is-active .switch-handle {
  transform: translateX(18px);
}
</style>

