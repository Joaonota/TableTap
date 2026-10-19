import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product, Category } from '@/types'
import { productService, categoryService } from '@/services'
import { useTenantStore } from './tenant'
import { useToastStore } from './toast'

export const useCatalogStore = defineStore('catalog', () => {
  const tenantStore = useTenantStore()
  const toastStore = useToastStore()

  const categories = ref<Category[]>([])
  const products = ref<Product[]>([])
  const isLoading = ref(false)

  const selectedCategoryId = ref<string>('all')
  const searchQuery = ref('')

  const loadCatalog = async () => {
    if (!tenantStore.currentRestaurant) {
      categories.value = []
      products.value = []
      return
    }
    isLoading.value = true
    try {
      const restId = tenantStore.currentRestaurant.id
      const [cats, prods] = await Promise.all([
        categoryService.getCategories(restId),
        productService.getProducts(restId)
      ])
      categories.value = cats
      products.value = prods
    } finally {
      isLoading.value = false
    }
  }

  const filteredProducts = computed(() => {
    return products.value.filter(product => {
      const matchesCategory =
        selectedCategoryId.value === 'all' || product.categoryId === selectedCategoryId.value
      const matchesSearch =
        !searchQuery.value ||
        product.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.value.toLowerCase())
      return matchesCategory && matchesSearch
    })
  })

  const toggleProductAvailability = async (productId: string) => {
    const prod = products.value.find(p => p.id === productId)
    if (!prod) return
    const newStatus = !prod.isAvailable
    try {
      const updated = await productService.updateProduct(productId, { isAvailable: newStatus })
      const index = products.value.findIndex(p => p.id === productId)
      if (index !== -1) {
        products.value[index] = updated
      }
      toastStore.success(
        updated.name,
        newStatus ? 'Marcado como DISPONÍVEL no menu' : 'Marcado como INDISPONÍVEL no menu'
      )
    } catch (e) {
      toastStore.error('Erro ao atualizar produto', (e as Error).message)
    }
  }

  const saveProduct = async (productData: Partial<Product> & { name: string; price: number; categoryId: string }) => {
    if (!tenantStore.currentRestaurant) return
    try {
      if (productData.id) {
        const updated = await productService.updateProduct(productData.id, productData)
        const index = products.value.findIndex(p => p.id === productData.id)
        if (index !== -1) products.value[index] = updated
        toastStore.success('Produto atualizado com sucesso!')
        return updated
      } else {
        const created = await productService.createProduct({
          ...productData,
          tenantId: tenantStore.currentRestaurant.tenantId,
          restaurantId: tenantStore.currentRestaurant.id,
          description: productData.description || '',
          imageUrl: productData.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
          isAvailable: productData.isAvailable ?? true,
          isFeatured: productData.isFeatured ?? false,
          preparationTimeMinutes: productData.preparationTimeMinutes ?? 15,
          station: productData.station || 'kitchen',
          sortOrder: products.value.length + 1,
          isActive: true
        } as Omit<Product, 'id'>)
        products.value.push(created)
        toastStore.success('Novo produto adicionado ao catálogo!')
        return created
      }
    } catch (e) {
      toastStore.error('Erro ao guardar produto', (e as Error).message)
      throw e
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      await productService.deleteProduct(id)
      products.value = products.value.filter(p => p.id !== id)
      toastStore.success('Produto removido')
    } catch (e) {
      toastStore.error('Erro ao eliminar produto', (e as Error).message)
    }
  }

  const saveCategory = async (categoryData: Partial<Category> & { name: string }) => {
    if (!tenantStore.currentRestaurant) return
    try {
      if (categoryData.id) {
        const updated = await categoryService.updateCategory(categoryData.id, categoryData)
        const index = categories.value.findIndex(c => c.id === categoryData.id)
        if (index !== -1) categories.value[index] = updated
        toastStore.success('Categoria atualizada')
        return updated
      } else {
        const created = await categoryService.createCategory({
          ...categoryData,
          tenantId: tenantStore.currentRestaurant.tenantId,
          restaurantId: tenantStore.currentRestaurant.id,
          sortOrder: categories.value.length + 1,
          isActive: true
        } as Omit<Category, 'id'>)
        categories.value.push(created)
        toastStore.success('Nova categoria criada!')
        return created
      }
    } catch (e) {
      toastStore.error('Erro ao guardar categoria', (e as Error).message)
      throw e
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      await categoryService.deleteCategory(id)
      categories.value = categories.value.filter(c => c.id !== id)
      toastStore.success('Categoria removida')
    } catch (e) {
      toastStore.error('Erro ao eliminar categoria', (e as Error).message)
    }
  }

  return {
    categories,
    products,
    isLoading,
    selectedCategoryId,
    searchQuery,
    filteredProducts,
    loadCatalog,
    toggleProductAvailability,
    saveProduct,
    deleteProduct,
    saveCategory,
    deleteCategory
  }
})
