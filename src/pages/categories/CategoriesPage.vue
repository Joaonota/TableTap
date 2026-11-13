<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useToastStore } from '@/stores/toast'
import type { Category } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import PlanLimitNotice from '@/components/plans/PlanLimitNotice.vue'
import { usePlanLimit } from '@/composables/usePlanLimit'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import ImageUploadField from '@/components/ui/ImageUploadField.vue'
import { useTenantStore } from '@/stores/tenant'
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  ShoppingBag,
  ArrowUpDown,
  ImageOff
} from 'lucide-vue-next'

const catalogStore = useCatalogStore()
const toastStore = useToastStore()
const tenantStore = useTenantStore()

const isCategoryModalOpen = ref(false)
const formId = ref<string | undefined>(undefined)
const formName = ref('')
const formDescription = ref('')
const formImageUrl = ref('')

onMounted(async () => {
  await catalogStore.loadCatalog()
})

const getProductCountForCategory = (catId: string) => {
  return catalogStore.products.filter(p => p.categoryId === catId).length
}

/** Limite de categorias do plano (por restaurante). */
const categoriesLimit = usePlanLimit('CATEGORIES')
watch(() => catalogStore.categories.length, () => categoriesLimit.refresh())

const openAddModal = () => {
  if (!categoriesLimit.guard()) return
  formId.value = undefined
  formName.value = ''
  formDescription.value = ''
  formImageUrl.value = ''
  isCategoryModalOpen.value = true
}

const openEditModal = (cat: Category) => {
  formId.value = cat.id
  formName.value = cat.name
  formDescription.value = cat.description || ''
  formImageUrl.value = cat.imageUrl || ''
  isCategoryModalOpen.value = true
}

const handleSaveCategory = async () => {
  if (!formName.value.trim()) {
    toastStore.warning('Insira o nome da categoria')
    return
  }
  try {
    await catalogStore.saveCategory({
      id: formId.value,
      name: formName.value,
      description: formDescription.value,
      imageUrl: formImageUrl.value
    })
    isCategoryModalOpen.value = false
  } catch {
    // O erro (ex.: limite do plano) já foi mostrado pela store.
  }
}

const handleDeleteCategory = async (id: string) => {
  const count = getProductCountForCategory(id)
  if (count > 0) {
    alert(`Esta categoria contém ${count} produtos associados. Transfira os produtos antes de eliminar.`)
    return
  }
  if (confirm('Deseja eliminar esta categoria?')) {
    await catalogStore.deleteCategory(id)
  }
}
</script>

<template>
  <div class="categories-page">
    <div class="page-top-header">
      <div>
        <h1 class="page-title">Categorias do Menu</h1>
        <p class="page-subtitle">Organize os grupos de produtos para facilitar a navegação do cliente no menu digital</p>
      </div>

      <AppButton variant="primary" :disabled="categoriesLimit.isReached.value" :title="categoriesLimit.message.value || undefined" @click="openAddModal">
        <template #icon-left>
          <Plus :size="16" />
        </template>
        Nova Categoria
      </AppButton>
    </div>

    <PlanLimitNotice :evaluation="categoriesLimit.evaluation.value" />

    <div v-if="!catalogStore.isLoading && !catalogStore.categories.length" class="empty-state-card">
      <h3>Ainda não existem categorias</h3>
      <p>Crie a primeira categoria (ex.: Entradas, Pratos, Bebidas) para começar a montar o menu.</p>
    </div>

    <!-- Categories Grid -->
    <div v-else class="categories-grid">
      <div
        v-for="cat in catalogStore.categories"
        :key="cat.id"
        class="category-card"
      >
        <img v-if="cat.imageUrl" :src="cat.imageUrl" :alt="cat.name" class="cat-cover" />
        <div v-else class="cat-cover cat-cover--empty" aria-hidden="true">
          <ImageOff :size="22" />
        </div>

        <div class="cat-content">
          <div class="cat-header-row">
            <h3 class="cat-name">{{ cat.name }}</h3>
            <AppBadge variant="neutral">
              {{ getProductCountForCategory(cat.id) }} pratos
            </AppBadge>
          </div>

          <p class="cat-description">{{ cat.description || 'Sem descrição definida.' }}</p>

          <div class="cat-actions-row">
            <span class="sort-order-tag">Ordem: #{{ cat.sortOrder }}</span>

            <div class="actions-btns">
              <button class="action-btn" title="Editar Categoria" @click="openEditModal(cat)">
                <Edit2 :size="14" />
              </button>
              <button class="action-btn danger" title="Eliminar Categoria" @click="handleDeleteCategory(cat.id)">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Category Modal -->
    <AppModal
      :is-open="isCategoryModalOpen"
      :title="formId ? 'Editar Categoria' : 'Nova Categoria'"
      maxWidth="500px"
      @close="isCategoryModalOpen = false"
    >
      <form class="modal-form" @submit.prevent="handleSaveCategory">
        <AppInput
          v-model="formName"
          label="Nome da Categoria"
          placeholder="Ex: Pratos Típicos Moçambicanos"
          required
        />

        <AppInput
          v-model="formDescription"
          label="Descrição Curta"
          placeholder="Ex: Pratos de panela, caril de camarão e matapa..."
        />

        <ImageUploadField
          v-if="tenantStore.currentRestaurant"
          v-model="formImageUrl"
          label="Imagem da categoria"
          kind="category"
          aspect="16 / 9"
          :tenant-id="tenantStore.currentRestaurant.tenantId"
          :restaurant-id="tenantStore.currentRestaurant.id"
        />
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="isCategoryModalOpen = false">Cancelar</AppButton>
        <AppButton variant="primary" @click="handleSaveCategory">Guardar Categoria</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.cat-cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-neutral-100);
  color: var(--color-neutral-400);
}

.empty-state-card {
  padding: 2.5rem 1.5rem;
  text-align: center;
  background: #fff;
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
}

.empty-state-card h3 {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}

.empty-state-card p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.categories-page {
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

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
  gap: 1.25rem;
}

.category-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-fast);
}

.category-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.cat-cover {
  width: 100%;
  height: 140px;
  object-fit: cover;
  background-color: var(--color-neutral-100);
}

.cat-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.cat-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.cat-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.cat-description {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 1rem;
  flex: 1;
}

.cat-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.75rem;
}

.sort-order-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-500);
}

.actions-btns {
  display: flex;
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

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 420px) {
  .cat-cover {
    height: 120px;
  }

  .cat-content {
    padding: 0.875rem;
  }
}
</style>
