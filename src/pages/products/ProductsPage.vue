<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useTenantStore } from '@/stores/tenant'
import { useToastStore } from '@/stores/toast'
import type { Product } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import ImageUploadField from '@/components/ui/ImageUploadField.vue'
import ProductOptionsEditor, { type OptionRow } from '@/components/menu/ProductOptionsEditor.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import PlanLimitNotice from '@/components/plans/PlanLimitNotice.vue'
import { usePlanLimit } from '@/composables/usePlanLimit'
import {
  Plus,
  Search,
  ShoppingBag,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChefHat,
  Wine
} from 'lucide-vue-next'

const catalogStore = useCatalogStore()
const tenantStore = useTenantStore()
const toastStore = useToastStore()

const isProductModalOpen = ref(false)
const formId = ref<string | undefined>(undefined)
const formName = ref('')
const formDescription = ref('')
const formCategoryId = ref('')
const formPrice = ref(0)
const formPromoPrice = ref<number | undefined>(undefined)
const formStation = ref<'kitchen' | 'bar'>('kitchen')
const formPrepTime = ref(15)
const formImageUrl = ref('')
const formVariants = ref<OptionRow[]>([])
const formAddons = ref<OptionRow[]>([])
const formIsFeatured = ref(false)
const formIsAvailable = ref(true)

onMounted(async () => {
  await catalogStore.loadCatalog()
})

const categoryOptions = computed(() => {
  return catalogStore.categories.map(c => ({
    label: c.name,
    value: c.id
  }))
})

/** Limite de produtos do plano (por restaurante). */
const productsLimit = usePlanLimit('PRODUCTS')
watch(() => catalogStore.products.length, () => productsLimit.refresh())

const openAddModal = () => {
  if (!productsLimit.guard()) return
  formId.value = undefined
  formName.value = ''
  formDescription.value = ''
  formCategoryId.value = catalogStore.categories[0]?.id || ''
  formPrice.value = 0
  formPromoPrice.value = undefined
  formStation.value = 'kitchen'
  formPrepTime.value = 15
  formImageUrl.value = ''
  formVariants.value = []
  formAddons.value = []
  formIsFeatured.value = false
  formIsAvailable.value = true
  isProductModalOpen.value = true
}

const openEditModal = (prod: Product) => {
  formId.value = prod.id
  formName.value = prod.name
  formDescription.value = prod.description
  formCategoryId.value = prod.categoryId
  formPrice.value = prod.price
  formPromoPrice.value = prod.promotionalPrice
  formStation.value = prod.station
  formPrepTime.value = prod.preparationTimeMinutes
  formImageUrl.value = prod.imageUrl
  formVariants.value = (prod.variants ?? []).map(v => ({ id: v.id, name: v.name, amount: v.priceDelta }))
  formAddons.value = (prod.addons ?? []).map(a => ({ id: a.id, name: a.name, amount: a.price }))
  formIsFeatured.value = prod.isFeatured
  formIsAvailable.value = prod.isAvailable
  isProductModalOpen.value = true
}

const handleSaveProduct = async () => {
  if (!formName.value.trim() || !formCategoryId.value) {
    toastStore.warning('Validação', 'Preencha o nome e selecione a categoria do produto.')
    return
  }
  try {
    await catalogStore.saveProduct({
    id: formId.value,
    name: formName.value,
    description: formDescription.value,
    categoryId: formCategoryId.value,
    price: Number(formPrice.value),
    promotionalPrice: formPromoPrice.value ? Number(formPromoPrice.value) : undefined,
    station: formStation.value,
    preparationTimeMinutes: Number(formPrepTime.value),
    imageUrl: formImageUrl.value,
    isFeatured: formIsFeatured.value,
    isAvailable: formIsAvailable.value,
    variants: formVariants.value
      .filter(v => v.name.trim())
      .map(v => ({ id: v.id ?? '', name: v.name.trim(), priceDelta: Number(v.amount) || 0 })),
    addons: formAddons.value
      .filter(a => a.name.trim())
      .map(a => ({ id: a.id ?? '', name: a.name.trim(), price: Math.max(0, Number(a.amount) || 0) }))
    })
    isProductModalOpen.value = false
  } catch {
    // O erro (ex.: limite do plano) já foi mostrado pela store.
  }
}

const handleDeleteProduct = async (id: string) => {
  if (confirm('Tem a certeza de que deseja remover este produto do catálogo?')) {
    await catalogStore.deleteProduct(id)
  }
}
</script>

<template>
  <div class="products-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Catálogo de Produtos</h1>
        <p class="page-subtitle">Faça a gestão dos pratos, bebidas, preços e disponibilidade do menu digital</p>
      </div>

      <AppButton variant="primary" :disabled="productsLimit.isReached.value" :title="productsLimit.message.value || undefined" @click="openAddModal">
        <template #icon-left>
          <Plus :size="16" />
        </template>
        Adicionar Produto
      </AppButton>
    </div>

    <PlanLimitNotice :evaluation="productsLimit.evaluation.value" />

    <!-- Filters Bar -->
    <div class="filters-card">
      <div class="search-box">
        <Search :size="16" class="search-icon" />
        <input
          v-model="catalogStore.searchQuery"
          type="text"
          placeholder="Pesquisar por nome ou descrição do prato..."
          class="search-input"
        />
      </div>

      <select v-model="catalogStore.selectedCategoryId" class="category-select">
        <option value="all">Todas as Categorias ({{ catalogStore.products.length }})</option>
        <option
          v-for="cat in catalogStore.categories"
          :key="cat.id"
          :value="cat.id"
        >
          {{ cat.name }}
        </option>
      </select>
    </div>

    <!-- Products Table -->
    <div class="app-card products-table-card">
      <div v-if="catalogStore.filteredProducts.length === 0" class="empty-state">
        <ShoppingBag :size="36" class="text-muted" />
        <p>Nenhum produto encontrado com os filtros selecionados.</p>
      </div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nome & Descrição</th>
              <th>Categoria</th>
              <th>Estação</th>
              <th>Preço (MT)</th>
              <th>Disponibilidade</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="prod in catalogStore.filteredProducts"
              :key="prod.id"
            >
              <td class="photo-cell">
                <img v-if="prod.imageUrl" :src="prod.imageUrl" :alt="prod.name" class="table-thumb" />
                <div v-else class="table-thumb table-thumb--empty" aria-hidden="true"></div>
              </td>

              <td class="info-cell">
                <div class="prod-title-row">
                  <strong>{{ prod.name }}</strong>
                  <span v-if="prod.isFeatured" class="featured-badge" title="Prato em Destaque">
                    <Sparkles :size="12" /> Destaque
                  </span>
                </div>
                <p class="prod-desc-snippet">{{ prod.description }}</p>
              </td>

              <td>
                <span class="cat-pill">
                  {{ catalogStore.categories.find(c => c.id === prod.categoryId)?.name || 'Geral' }}
                </span>
              </td>

              <td>
                <span class="station-pill">
                  <ChefHat v-if="prod.station === 'kitchen'" :size="13" />
                  <Wine v-else :size="13" />
                  {{ prod.station === 'kitchen' ? 'Cozinha' : 'Bar' }}
                </span>
              </td>

              <td>
                <div class="price-stack">
                  <span v-if="prod.promotionalPrice" class="promo-strike">
                    {{ prod.price.toLocaleString('pt-MZ') }} MT
                  </span>
                  <span class="main-price">
                    {{ (prod.promotionalPrice ?? prod.price).toLocaleString('pt-MZ') }} MT
                  </span>
                </div>
              </td>

              <td>
                <button
                  type="button"
                  class="availability-toggle-btn"
                  :class="{ 'is-available': prod.isAvailable }"
                  title="Clique para alternar disponibilidade"
                  @click="catalogStore.toggleProductAvailability(prod.id)"
                >
                  <CheckCircle2 v-if="prod.isAvailable" :size="14" />
                  <XCircle v-else :size="14" />
                  <span>{{ prod.isAvailable ? 'Disponível' : 'Esgotado' }}</span>
                </button>
              </td>

              <td class="text-right">
                <div class="actions-cell">
                  <button class="action-btn" title="Editar Produto" @click="openEditModal(prod)">
                    <Edit2 :size="15" />
                  </button>
                  <button class="action-btn danger" title="Eliminar Produto" @click="handleDeleteProduct(prod.id)">
                    <Trash2 :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit Product Modal -->
    <AppModal
      :is-open="isProductModalOpen"
      :title="formId ? 'Editar Produto' : 'Adicionar Novo Produto'"
      subtitle="Defina preços em Meticais (MT) e configurações para a cozinha"
      maxWidth="600px"
      @close="isProductModalOpen = false"
    >
      <form class="product-modal-form" @submit.prevent="handleSaveProduct">
        <AppInput
          v-model="formName"
          label="Nome do Produto / Prato"
          placeholder="Ex: Frango à Zambeziana da Casa"
          required
        />

        <div class="form-row">
          <AppSelect
            v-model="formCategoryId"
            label="Categoria"
            :options="categoryOptions"
            required
          />

          <AppSelect
            v-model="formStation"
            label="Estação de Preparo"
            :options="[
              { label: 'Cozinha (KDS Cozinha)', value: 'kitchen' },
              { label: 'Bar / Bebidas (KDS Bar)', value: 'bar' }
            ]"
            required
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="formPrice"
            label="Preço Base (MT)"
            type="number"
            required
          />

          <AppInput
            v-model="formPromoPrice"
            label="Preço Promocional (Opcional)"
            type="number"
            placeholder="Deixe vazio se não houver"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Descrição dos Ingredientes & Sabor</label>
          <textarea
            v-model="formDescription"
            rows="3"
            placeholder="Descreva a preparação, molhos e acompanhamentos incluídos..."
            class="form-textarea"
          ></textarea>
        </div>

        <ImageUploadField
          v-if="tenantStore.currentRestaurant"
          v-model="formImageUrl"
          label="Fotografia do produto"
          kind="product"
          :tenant-id="tenantStore.currentRestaurant.tenantId"
          :restaurant-id="tenantStore.currentRestaurant.id"
        />

        <ProductOptionsEditor
          v-model="formVariants"
          title="Variantes"
          description="Opções em que o cliente escolhe uma (ex.: Pequena, Grande). O valor é somado ao preço base."
          amount-label="Acréscimo ao preço base"
          add-label="Adicionar variante"
          allow-negative
        />
        <ProductOptionsEditor
          v-model="formAddons"
          title="Adicionais"
          description="Extras que o cliente pode juntar (ex.: Batata frita, Queijo extra)."
          amount-label="Preço do adicional"
          add-label="Adicionar adicional"
        />

        <div class="checkbox-options-row">
          <label class="checkbox-lbl">
            <input v-model="formIsFeatured" type="checkbox" />
            <span>Destacar na secção de pratos recomendados</span>
          </label>

          <label class="checkbox-lbl">
            <input v-model="formIsAvailable" type="checkbox" />
            <span>Produto disponível para novos pedidos</span>
          </label>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="isProductModalOpen = false">Cancelar</AppButton>
        <AppButton variant="primary" @click="handleSaveProduct">Guardar Produto</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.table-thumb--empty {
  background: var(--color-neutral-100);
  border: 1px dashed var(--border-medium);
}

.products-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-neutral-900);
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.filters-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1 1 240px;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-neutral-400);
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.category-select {
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  background: #ffffff;
  outline: none;
}

/* Table */
.products-table-card {
  padding: 0;
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.data-table th {
  background: var(--color-neutral-50);
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-neutral-600);
  border-bottom: 1px solid var(--border-medium);
}

.data-table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.photo-cell {
  width: 56px;
}

.table-thumb {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  object-fit: cover;
  border: 1px solid var(--border-subtle);
}

.prod-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.featured-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--color-primary-50);
  color: var(--color-primary-800);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
}

.prod-desc-snippet {
  font-size: 0.75rem;
  color: var(--text-muted);
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.15rem;
}

.cat-pill {
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-neutral-100);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  color: var(--color-neutral-700);
}

.station-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.price-stack {
  display: flex;
  flex-direction: column;
}

.promo-strike {
  font-size: 0.6875rem;
  color: var(--color-neutral-400);
  text-decoration: line-through;
}

.main-price {
  font-weight: 700;
  color: var(--color-neutral-900);
}

.availability-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--color-danger-50);
  color: var(--color-danger-600);
  border: 1px solid var(--color-danger-200);
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.availability-toggle-btn.is-available {
  background: var(--color-success-50);
  color: var(--color-success-700);
  border-color: var(--color-success-200);
}

.actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
}

.action-btn {
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-neutral-700);
}

.action-btn:hover {
  background: var(--color-neutral-200);
}

.action-btn.danger:hover {
  background: var(--color-danger-50);
  color: var(--color-danger-600);
}

.text-right {
  text-align: right;
}

/* Modal Form */
.product-modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.form-textarea {
  width: 100%;
  padding: 0.65rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.checkbox-options-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.checkbox-lbl {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-neutral-800);
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 4rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .filters-card {
    align-items: stretch;
    gap: 0.75rem;
  }

  .search-box,
  .category-select {
    flex: 1 1 100%;
    width: 100%;
  }

  .data-table {
    min-width: 760px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .empty-state {
    padding: 2.5rem 1rem;
  }
}
</style>
