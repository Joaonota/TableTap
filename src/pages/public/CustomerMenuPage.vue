<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { restaurantService, tableService, productService, categoryService } from '@/services'
import { useCartStore, type CartCustomization } from '@/stores/cart'
import { useServiceRequestStore } from '@/stores/serviceRequest'
import { useToastStore } from '@/stores/toast'
import type { Restaurant, Table, Product, Category, ProductVariant, ProductAddon, PaymentMethod, ServiceRequestType } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import {
  Search,
  Plus,
  Minus,
  Clock,
  Trash2,
  BellRing,
  UtensilsCrossed,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  CreditCard,
  DollarSign,
  Phone,
  Sparkles
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const serviceRequestStore = useServiceRequestStore()
const toastStore = useToastStore()

const restaurantSlug = computed(() => route.params.restaurantSlug as string)
const tableCode = computed(() => route.params.tableCode as string)

const restaurant = ref<Restaurant | null>(null)
const table = ref<Table | null>(null)
const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const isLoading = ref(true)

// Filters
const activeCategoryId = ref<string>('all')
const searchQuery = ref('')

// Product Customization Modal
const selectedProduct = ref<Product | null>(null)
const isProductModalOpen = ref(false)
const selectedVariant = ref<ProductVariant | undefined>(undefined)
const selectedAddons = ref<ProductAddon[]>([])
const removedIngredients = ref<string[]>([])
const productNotes = ref('')
const itemQuantity = ref(1)

// Cart Modal / Checkout
const isCartModalOpen = ref(false)
const customerName = ref('')
const customerPhone = ref('')
const orderNotes = ref('')
const selectedPaymentMethod = ref<PaymentMethod>('mpesa')
const isSubmittingOrder = ref(false)

// Service Request Modal
const isServiceModalOpen = ref(false)
const serviceType = ref<ServiceRequestType>('waiter_call')
const serviceNotes = ref('')
const isSubmittingService = ref(false)

onMounted(async () => {
  isLoading.value = true
  try {
    const foundRest = await restaurantService.getRestaurantBySlug(restaurantSlug.value)
    if (!foundRest) {
      router.push('/404')
      return
    }
    restaurant.value = foundRest

    // Find table
    const foundTable = await tableService.getTableByNumber(foundRest.id, tableCode.value)
    table.value = foundTable || null

    // Set cart context
    cartStore.setRestaurantAndTable(foundRest, foundTable || undefined)

    // Load products and categories
    const [cats, prods] = await Promise.all([
      categoryService.getCategories(foundRest.id),
      productService.getProducts(foundRest.id)
    ])
    categories.value = cats
    products.value = prods
  } finally {
    isLoading.value = false
  }
})

const filteredProducts = computed(() => {
  return products.value.filter(p => {
    const matchCat = activeCategoryId.value === 'all' || p.categoryId === activeCategoryId.value
    const matchSearch = !searchQuery.value ||
      p.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchCat && matchSearch
  })
})

const openProductModal = (product: Product) => {
  if (!product.isAvailable) {
    toastStore.warning('Produto Indisponível', 'Este item não pode ser adicionado ao pedido no momento.')
    return
  }
  selectedProduct.value = product
  selectedVariant.value = product.variants?.[0]
  selectedAddons.value = []
  removedIngredients.value = []
  productNotes.value = ''
  itemQuantity.value = 1
  isProductModalOpen.value = true
}

const toggleAddon = (addon: ProductAddon) => {
  const index = selectedAddons.value.findIndex(a => a.id === addon.id)
  if (index !== -1) {
    selectedAddons.value.splice(index, 1)
  } else {
    selectedAddons.value.push(addon)
  }
}

const toggleIngredient = (ing: string) => {
  const index = removedIngredients.value.indexOf(ing)
  if (index !== -1) {
    removedIngredients.value.splice(index, 1)
  } else {
    removedIngredients.value.push(ing)
  }
}

const calculateCurrentModalTotal = computed(() => {
  if (!selectedProduct.value) return 0
  const base = selectedProduct.value.promotionalPrice ?? selectedProduct.value.price
  const variantDelta = selectedVariant.value?.priceDelta ?? 0
  const addonsTotal = selectedAddons.value.reduce((s, a) => s + a.price, 0)
  return (base + variantDelta + addonsTotal) * itemQuantity.value
})

const handleAddToCart = () => {
  if (!selectedProduct.value) return
  const customization: CartCustomization = {
    selectedVariant: selectedVariant.value,
    selectedAddons: selectedAddons.value,
    removedIngredients: removedIngredients.value,
    notes: productNotes.value
  }
  cartStore.addItem(selectedProduct.value, itemQuantity.value, customization)
  isProductModalOpen.value = false
}

const handleCheckout = async () => {
  if (!customerName.value.trim()) {
    toastStore.warning('Identificação', 'Por favor, insira o seu nome para o pedido.')
    return
  }
  isSubmittingOrder.value = true
  try {
    const createdOrder = await cartStore.checkout({
      customerName: customerName.value,
      customerPhone: customerPhone.value,
      notes: orderNotes.value,
      paymentMethod: selectedPaymentMethod.value
    })
    isCartModalOpen.value = false
    toastStore.success('Pedido Enviado!', `O seu pedido ${createdOrder.orderCode} foi recebido com sucesso.`)
    router.push(`/pedido/${createdOrder.id}`)
  } catch (e) {
    toastStore.error('Erro no pedido', (e as Error).message)
  } finally {
    isSubmittingOrder.value = false
  }
}

const handleSendServiceRequest = async () => {
  if (!restaurant.value || !table.value) return
  isSubmittingService.value = true
  try {
    await serviceRequestStore.createCustomerRequest(
      table.value.id,
      table.value.number,
      serviceType.value,
      serviceNotes.value
    )
    isServiceModalOpen.value = false
    serviceNotes.value = ''
  } finally {
    isSubmittingService.value = false
  }
}
</script>

<template>
  <div v-if="isLoading" class="loading-screen">
    <UtensilsCrossed :size="32" class="spin-icon" />
    <p>A carregar o menu digital...</p>
  </div>

  <div v-else-if="restaurant" class="menu-page">
    <!-- Restaurant Header with Cover & Logo -->
    <header class="menu-hero">
      <img :src="restaurant.coverImage" :alt="restaurant.name" class="hero-cover" />
      <div class="hero-gradient"></div>

      <div class="hero-content">
        <div class="restaurant-badge-row">
          <img :src="restaurant.logoUrl" :alt="restaurant.name" class="restaurant-logo" />
          <div class="table-tag">
            <span class="table-dot"></span>
            <strong>Mesa {{ table?.number || tableCode }}</strong>
          </div>
        </div>

        <h1 class="restaurant-title">{{ restaurant.name }}</h1>
        <p class="restaurant-desc">{{ restaurant.description }}</p>

        <div class="hero-actions">
          <button class="service-call-btn" @click="isServiceModalOpen = true">
            <BellRing :size="16" />
            <span>Chamar Garçom / Pedir Assistência</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Menu Navigation & Search -->
    <div class="menu-nav-bar">
      <!-- Search Input -->
      <div class="search-box">
        <Search :size="18" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Pesquisar pratos, bebidas ou sobremesas..."
          class="search-input"
        />
      </div>

      <!-- Categories Tabs -->
      <div class="categories-scroll">
        <button
          type="button"
          class="cat-chip"
          :class="{ 'is-active': activeCategoryId === 'all' }"
          @click="activeCategoryId = 'all'"
        >
          Todos os Pratos ({{ products.length }})
        </button>

        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="cat-chip"
          :class="{ 'is-active': activeCategoryId === cat.id }"
          @click="activeCategoryId = cat.id"
        >
          {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- Product Grid -->
    <div class="products-container">
      <div v-if="filteredProducts.length === 0" class="empty-products">
        <AlertCircle :size="32" />
        <p>Nenhum prato encontrado nesta categoria ou pesquisa.</p>
      </div>

      <div v-else class="products-grid">
        <div
          v-for="product in filteredProducts"
          :key="product.id"
          class="product-card"
          :class="{ 'is-unavailable': !product.isAvailable }"
          @click="openProductModal(product)"
        >
          <div class="product-image-box">
            <img :src="product.imageUrl" :alt="product.name" class="product-thumb" loading="lazy" />

            <div class="badges-corner">
              <span v-if="product.isFeatured" class="corner-badge featured">Destaque</span>
              <span v-if="product.promotionalPrice" class="corner-badge promo">Promoção</span>
              <span v-if="!product.isAvailable" class="corner-badge unavailable">Esgotado</span>
            </div>
          </div>

          <div class="product-info">
            <div class="product-name-row">
              <h3 class="product-name">{{ product.name }}</h3>
            </div>

            <p class="product-description">{{ product.description }}</p>

            <div class="product-bottom-row">
              <div class="price-box">
                <span v-if="product.promotionalPrice" class="original-price">
                  {{ product.price.toLocaleString('pt-MZ') }} MT
                </span>
                <span class="final-price">
                  {{ (product.promotionalPrice ?? product.price).toLocaleString('pt-MZ') }} MT
                </span>
              </div>

              <button
                type="button"
                class="add-btn"
                :disabled="!product.isAvailable"
                @click.stop="openProductModal(product)"
              >
                <Plus :size="16" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Customization Modal -->
    <AppModal
      :is-open="isProductModalOpen"
      :title="selectedProduct?.name"
      :subtitle="selectedProduct?.station === 'bar' ? 'Bebida / Bar' : 'Cozinha'"
      @close="isProductModalOpen = false"
    >
      <div v-if="selectedProduct" class="customization-content">
        <img :src="selectedProduct.imageUrl" :alt="selectedProduct.name" class="modal-product-img" />
        <p class="modal-product-desc">{{ selectedProduct.description }}</p>

        <!-- Variants -->
        <div v-if="selectedProduct.variants && selectedProduct.variants.length > 0" class="custom-group">
          <div class="group-title">Escolha o Tamanho / Variante:</div>
          <div class="options-list">
            <label
              v-for="v in selectedProduct.variants"
              :key="v.id"
              class="radio-option"
              :class="{ 'is-selected': selectedVariant?.id === v.id }"
            >
              <input
                type="radio"
                name="variant"
                :checked="selectedVariant?.id === v.id"
                @change="selectedVariant = v"
              />
              <span class="option-name">{{ v.name }}</span>
              <span class="option-price">
                {{ v.priceDelta > 0 ? `+${v.priceDelta} MT` : 'Incluído' }}
              </span>
            </label>
          </div>
        </div>

        <!-- Addons -->
        <div v-if="selectedProduct.addons && selectedProduct.addons.length > 0" class="custom-group">
          <div class="group-title">Acompanhamentos / Extras Opcionais:</div>
          <div class="options-list">
            <label
              v-for="addon in selectedProduct.addons"
              :key="addon.id"
              class="checkbox-option"
              :class="{ 'is-selected': selectedAddons.some(a => a.id === addon.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedAddons.some(a => a.id === addon.id)"
                @change="toggleAddon(addon)"
              />
              <span class="option-name">{{ addon.name }}</span>
              <span class="option-price">+{{ addon.price }} MT</span>
            </label>
          </div>
        </div>

        <!-- Removable Ingredients -->
        <div v-if="selectedProduct.removableIngredients && selectedProduct.removableIngredients.length > 0" class="custom-group">
          <div class="group-title">Remover Ingredientes (Preferências):</div>
          <div class="tags-list">
            <button
              v-for="ing in selectedProduct.removableIngredients"
              :key="ing"
              type="button"
              class="ingredient-tag"
              :class="{ 'is-removed': removedIngredients.includes(ing) }"
              @click="toggleIngredient(ing)"
            >
              {{ removedIngredients.includes(ing) ? `Sem ${ing}` : `Com ${ing}` }}
            </button>
          </div>
        </div>

        <!-- Notes -->
        <div class="custom-group">
          <div class="group-title">Observações Especiais para a Cozinha:</div>
          <textarea
            v-model="productNotes"
            placeholder="Ex: pouco sal, piripíri à parte, bem passado..."
            rows="2"
            class="notes-textarea"
          ></textarea>
        </div>

        <!-- Quantity & Modal Add Action -->
        <div class="quantity-row">
          <div class="qty-control">
            <button
              type="button"
              class="qty-btn"
              :disabled="itemQuantity <= 1"
              @click="itemQuantity--"
            >
              <Minus :size="16" />
            </button>
            <span class="qty-val">{{ itemQuantity }}</span>
            <button
              type="button"
              class="qty-btn"
              @click="itemQuantity++"
            >
              <Plus :size="16" />
            </button>
          </div>

          <AppButton variant="primary" size="lg" @click="handleAddToCart">
            Adicionar • {{ calculateCurrentModalTotal.toLocaleString('pt-MZ') }} MT
          </AppButton>
        </div>
      </div>
    </AppModal>

    <!-- Cart / Checkout Modal -->
    <AppModal
      :is-open="isCartModalOpen"
      title="O Seu Pedido"
      :subtitle="`Mesa ${table?.number || tableCode} • ${restaurant.name}`"
      maxWidth="600px"
      @close="isCartModalOpen = false"
    >
      <div class="cart-modal-body">
        <div v-if="cartStore.items.length === 0" class="empty-cart-msg">
          <ShoppingBag :size="36" />
          <p>O seu carrinho está vazio.</p>
        </div>

        <div v-else class="cart-items-list">
          <div
            v-for="item in cartStore.items"
            :key="item.id"
            class="cart-item-card"
          >
            <div class="item-main">
              <div class="item-title">{{ item.productName }}</div>
              <div v-if="item.selectedVariant" class="item-sub">
                Tamanho: {{ item.selectedVariant.name }}
              </div>
              <div v-if="item.selectedAddons && item.selectedAddons.length > 0" class="item-sub">
                Extras: {{ item.selectedAddons.map(a => a.name).join(', ') }}
              </div>
              <div v-if="item.removedIngredients && item.removedIngredients.length > 0" class="item-sub text-danger">
                Remover: {{ item.removedIngredients.join(', ') }}
              </div>
              <div v-if="item.notes" class="item-sub text-muted">
                Obs: "{{ item.notes }}"
              </div>
              <div class="item-price">{{ item.totalPrice.toLocaleString('pt-MZ') }} MT</div>
            </div>

            <div class="item-qty-actions">
              <button class="qty-btn-sm" @click="cartStore.updateQuantity(item.id, item.quantity - 1)">
                <Minus :size="14" />
              </button>
              <span class="qty-text">{{ item.quantity }}</span>
              <button class="qty-btn-sm" @click="cartStore.updateQuantity(item.id, item.quantity + 1)">
                <Plus :size="14" />
              </button>
              <button class="trash-btn" title="Remover item" @click="cartStore.removeItem(item.id)">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>

          <!-- Totals calculation breakdown -->
          <div class="totals-breakdown">
            <div class="breakdown-row">
              <span>Subtotal:</span>
              <span>{{ cartStore.subtotal.toLocaleString('pt-MZ') }} MT</span>
            </div>
            <div class="breakdown-row">
              <span>IVA ({{ restaurant.taxRate }}%):</span>
              <span>{{ cartStore.taxAmount.toLocaleString('pt-MZ') }} MT</span>
            </div>
            <div class="breakdown-row">
              <span>Taxa de Serviço ({{ restaurant.settings.serviceFeePercent }}%):</span>
              <span>{{ cartStore.serviceFee.toLocaleString('pt-MZ') }} MT</span>
            </div>
            <div class="breakdown-row total-highlight">
              <strong>Total a Pagar:</strong>
              <strong>{{ cartStore.grandTotal.toLocaleString('pt-MZ') }} MT</strong>
            </div>
          </div>

          <!-- Customer info form -->
          <div class="checkout-fields">
            <div class="form-title">Dados para a Mesa</div>
            <div class="fields-row">
              <input
                v-model="customerName"
                type="text"
                placeholder="O seu nome *"
                class="form-input"
                required
              />
              <input
                v-model="customerPhone"
                type="tel"
                placeholder="Telemóvel (ex: 84/85...)"
                class="form-input"
              />
            </div>

            <div class="payment-method-selector">
              <div class="form-title">Método de Pagamento Pretendido:</div>
              <div class="methods-grid">
                <button
                  type="button"
                  class="method-btn"
                  :class="{ 'is-selected': selectedPaymentMethod === 'mpesa' }"
                  @click="selectedPaymentMethod = 'mpesa'"
                >
                  <DollarSign :size="18" />
                  <span>M-Pesa</span>
                </button>

                <button
                  type="button"
                  class="method-btn"
                  :class="{ 'is-selected': selectedPaymentMethod === 'emola' }"
                  @click="selectedPaymentMethod = 'emola'"
                >
                  <Phone :size="18" />
                  <span>e-Mola</span>
                </button>

                <button
                  type="button"
                  class="method-btn"
                  :class="{ 'is-selected': selectedPaymentMethod === 'card' }"
                  @click="selectedPaymentMethod = 'card'"
                >
                  <CreditCard :size="18" />
                  <span>Cartão POS</span>
                </button>

                <button
                  type="button"
                  class="method-btn"
                  :class="{ 'is-selected': selectedPaymentMethod === 'cash' }"
                  @click="selectedPaymentMethod = 'cash'"
                >
                  <DollarSign :size="18" />
                  <span>Dinheiro</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isCartModalOpen = false">Continuar a Escolher</AppButton>
        <AppButton
          variant="success"
          size="lg"
          :disabled="cartStore.items.length === 0"
          :loading="isSubmittingOrder"
          @click="handleCheckout"
        >
          Confirmar Pedido ({{ cartStore.grandTotal.toLocaleString('pt-MZ') }} MT)
        </AppButton>
      </template>
    </AppModal>

    <!-- Service Request Modal (Chamar Garçom) -->
    <AppModal
      :is-open="isServiceModalOpen"
      title="Atendimento na Mesa"
      :subtitle="`Mesa ${table?.number || tableCode}`"
      @close="isServiceModalOpen = false"
    >
      <div class="service-modal-content">
        <p class="text-sm text-muted">
          Como podemos ajudá-lo de imediato? Selecione o motivo do pedido de assistência:
        </p>

        <div class="service-options-grid">
          <button
            type="button"
            class="service-option-btn"
            :class="{ 'is-selected': serviceType === 'waiter_call' }"
            @click="serviceType = 'waiter_call'"
          >
            <BellRing :size="20" />
            <span>Chamar Garçom</span>
          </button>

          <button
            type="button"
            class="service-option-btn"
            :class="{ 'is-selected': serviceType === 'water' }"
            @click="serviceType = 'water'"
          >
            <span>Pedir Água</span>
          </button>

          <button
            type="button"
            class="service-option-btn"
            :class="{ 'is-selected': serviceType === 'cutlery' }"
            @click="serviceType = 'cutlery'"
          >
            <span>Pedir Talheres</span>
          </button>

          <button
            type="button"
            class="service-option-btn"
            :class="{ 'is-selected': serviceType === 'bill' }"
            @click="serviceType = 'bill'"
          >
            <span>Pedir a Conta</span>
          </button>
        </div>

        <textarea
          v-model="serviceNotes"
          placeholder="Alguma nota adicional? (opcional)"
          rows="2"
          class="notes-textarea"
        ></textarea>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="isServiceModalOpen = false">Cancelar</AppButton>
        <AppButton
          variant="primary"
          :loading="isSubmittingService"
          @click="handleSendServiceRequest"
        >
          Enviar Solicitação à Equipa
        </AppButton>
      </template>
    </AppModal>

    <!-- Floating Trigger for Cart modal -->
    <Teleport to="body">
      <div v-if="cartStore.itemCount > 0" class="floating-cart-trigger">
        <button class="cart-trigger-btn" @click="isCartModalOpen = true">
          <div class="trigger-badge">{{ cartStore.itemCount }}</div>
          <ShoppingBag :size="20" />
          <span>Ver Pedido ({{ cartStore.grandTotal.toLocaleString('pt-MZ') }} MT)</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.loading-screen {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-muted);
}

.spin-icon {
  animation: spin 1s infinite linear;
  color: var(--color-primary-800);
}

.menu-page {
  padding-bottom: 6rem;
}

/* Hero */
.menu-hero {
  position: relative;
  height: 280px;
  overflow: hidden;
  background-color: #0f172a;
}

.hero-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.55;
}

.hero-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%);
}

.hero-content {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
  color: #ffffff;
}

.restaurant-badge-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.restaurant-logo {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 2px solid #ffffff;
  object-fit: cover;
}

.table-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background-color: var(--color-success-600);
  color: #ffffff;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
}

.table-dot {
  width: 6px;
  height: 6px;
  background: #ffffff;
  border-radius: 50%;
}

.restaurant-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 0.25rem;
}

.restaurant-desc {
  font-size: 0.875rem;
  color: #cbd5e1;
  max-width: 600px;
  line-height: 1.4;
  margin-bottom: 0.75rem;
}

.service-call-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all var(--transition-fast);
}

.service-call-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Nav & Search */
.menu-nav-bar {
  position: sticky;
  top: 40px;
  z-index: 30;
  background: #ffffff;
  padding: 0.875rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-xs);
}

.search-box {
  position: relative;
  margin-bottom: 0.75rem;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-neutral-400);
}

.search-input {
  width: 100%;
  padding: 0.65rem 1rem 0.65rem 2.5rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  outline: none;
  background-color: var(--color-neutral-50);
}

.search-input:focus {
  border-color: var(--color-primary-600);
  background-color: #ffffff;
}

.categories-scroll {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: none;
}

.categories-scroll::-webkit-scrollbar {
  display: none;
}

.cat-chip {
  padding: 0.45rem 1rem;
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cat-chip.is-active {
  background: var(--color-primary-800);
  color: #ffffff;
  border-color: var(--color-primary-800);
}

/* Products */
.products-container {
  max-width: 900px;
  margin: 1.5rem auto;
  padding: 0 1rem;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.product-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.product-card.is-unavailable {
  opacity: 0.65;
}

.product-image-box {
  position: relative;
  height: 180px;
  background-color: var(--color-neutral-100);
}

.product-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badges-corner {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  display: flex;
  gap: 0.35rem;
}

.corner-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  color: #ffffff;
}

.corner-badge.featured { background: var(--color-primary-800); }
.corner-badge.promo { background: #e11d48; }
.corner-badge.unavailable { background: #4b5563; }

.product-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.product-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  margin-bottom: 0.35rem;
  line-height: 1.3;
}

.product-description {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 1rem;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price-box {
  display: flex;
  flex-direction: column;
}

.original-price {
  font-size: 0.75rem;
  color: var(--color-neutral-400);
  text-decoration: line-through;
}

.final-price {
  font-size: 1.125rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--color-primary-900);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background-color: var(--color-primary-50);
  color: var(--color-primary-800);
  border: 1px solid var(--color-primary-200);
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.add-btn:hover:not(:disabled) {
  background-color: var(--color-primary-800);
  color: #ffffff;
}

/* Modals */
.customization-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-product-img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

.modal-product-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.custom-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-800);
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.radio-option, .checkbox-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.85rem;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
}

.radio-option.is-selected, .checkbox-option.is-selected {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
}

.option-price {
  font-weight: 600;
  color: var(--color-primary-800);
}

.tags-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ingredient-tag {
  background: var(--color-neutral-100);
  border: 1px solid var(--border-subtle);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.ingredient-tag.is-removed {
  background: var(--color-danger-50);
  border-color: var(--color-danger-200);
  color: var(--color-danger-600);
  text-decoration: line-through;
}

.notes-textarea {
  width: 100%;
  padding: 0.65rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.quantity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.5rem;
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-neutral-100);
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius-full);
}

.qty-btn {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.qty-val {
  font-weight: 700;
  font-size: 1rem;
}

/* Cart Modal */
.cart-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.cart-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cart-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.item-title {
  font-weight: 700;
  font-size: 0.9375rem;
}

.item-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.item-price {
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--color-primary-900);
  margin-top: 0.25rem;
}

.item-qty-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn-sm {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.trash-btn {
  background: transparent;
  border: none;
  color: var(--color-danger-600);
  cursor: pointer;
  padding: 0.25rem;
}

.totals-breakdown {
  background: var(--color-neutral-100);
  padding: 1rem;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.875rem;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
}

.breakdown-row.total-highlight {
  font-size: 1.125rem;
  color: var(--color-primary-900);
  border-top: 1px solid var(--border-medium);
  padding-top: 0.5rem;
  margin-top: 0.25rem;
}

.checkout-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-neutral-800);
}

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-input {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.methods-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.method-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.method-btn.is-selected {
  background: var(--color-primary-50);
  border-color: var(--color-primary-800);
  color: var(--color-primary-800);
  box-shadow: 0 0 0 1px var(--color-primary-800);
}

/* Service Request */
.service-options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin: 1rem 0;
}

.service-option-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem;
  background: var(--color-neutral-50);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.service-option-btn.is-selected {
  background: var(--color-primary-50);
  border-color: var(--color-primary-800);
  color: var(--color-primary-800);
}

/* Floating Bottom Trigger */
.floating-cart-trigger {
  position: fixed;
  bottom: 1.25rem;
  left: 1rem;
  right: 1rem;
  max-width: 480px;
  margin: 0 auto;
  z-index: 1000;
}

.cart-trigger-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: var(--color-primary-900);
  color: #ffffff;
  border: none;
  padding: 1rem 1.5rem;
  border-radius: var(--radius-full);
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 10px 25px -5px rgba(30, 58, 138, 0.45);
  cursor: pointer;
  position: relative;
  transition: transform var(--transition-fast);
}

.cart-trigger-btn:hover {
  transform: translateY(-2px);
}

.trigger-badge {
  background: var(--color-success-500);
  color: #ffffff;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
}
</style>
