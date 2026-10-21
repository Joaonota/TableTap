<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { restaurantService, tableService, productService, categoryService, orderService } from '@/services'
import { useCartStore, type CartCustomization } from '@/stores/cart'
import { useTableSessionStore } from '@/stores/tableSession'
import { useServiceRequestStore } from '@/stores/serviceRequest'
import { useToastStore } from '@/stores/toast'
import type {
  Restaurant,
  Table,
  Product,
  Category,
  ProductVariant,
  ProductAddon,
  PaymentMethod,
  ServiceRequestType,
  Order,
  TableSession
} from '@/types'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import WelcomeTableModal from '@/components/menu/WelcomeTableModal.vue'
import OccupiedNoticeScreen from '@/components/menu/OccupiedNoticeScreen.vue'
import UnavailableNoticeScreen from '@/components/menu/UnavailableNoticeScreen.vue'
import SessionHistoryModal from '@/components/menu/SessionHistoryModal.vue'
import BillRequestModal from '@/components/menu/BillRequestModal.vue'
import SuggestedProductsSection from '@/components/menu/SuggestedProductsSection.vue'

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
  Banknote,
  Receipt,
  Eye,
  Users,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const tableSessionStore = useTableSessionStore()
const serviceRequestStore = useServiceRequestStore()
const toastStore = useToastStore()

const restaurantSlug = computed(() => route.params.restaurantSlug as string)
const tableCode = computed(() => route.params.tableCode as string)

const restaurant = ref<Restaurant | null>(null)
const table = ref<Table | null>(null)
const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const sessionOrders = ref<Order[]>([])
const isLoading = ref(true)

// Navigation & Access States
const isWelcomeModalOpen = ref(false)
const isBrowseOnly = ref(false)
const isOccupiedByOther = ref(false)
const isTableUnavailable = ref(false)
const isSubmittingOccupation = ref(false)

// Modals
const isSessionHistoryOpen = ref(false)
const isBillModalOpen = ref(false)
const isServiceModalOpen = ref(false)
const isProductModalOpen = ref(false)

// Filters
const activeCategoryId = ref<string>('all')
const searchQuery = ref('')

// Product Customization Modal
const selectedProduct = ref<Product | null>(null)
const selectedVariant = ref<ProductVariant | undefined>(undefined)
const selectedAddons = ref<ProductAddon[]>([])
const removedIngredients = ref<string[]>([])
const productNotes = ref('')
const itemQuantity = ref(1)

// Checkout form
const customerName = ref('')
const customerPhone = ref('')
const orderNotes = ref('')
const selectedPaymentMethod = ref<PaymentMethod>('mpesa')
const isSubmittingOrder = ref(false)

// Service Request
const serviceType = ref<ServiceRequestType>('waiter_call')
const serviceNotes = ref('')
const isSubmittingService = ref(false)

const loadSessionOrders = async () => {
  if (!restaurant.value || !tableSessionStore.currentSession) {
    sessionOrders.value = []
    return
  }
  const allOrders = await orderService.getOrders(restaurant.value.id)
  const orderIds = tableSessionStore.currentSession.orderIds || []
  sessionOrders.value = allOrders.filter(
    o => orderIds.includes(o.id) || (o.tableSessionId === tableSessionStore.currentSession?.id)
  )
}

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
    if (!foundTable) {
      router.push('/404')
      return
    }
    table.value = foundTable

    // Set cart context
    cartStore.setRestaurantAndTable(foundRest, foundTable)

    // Load products and categories
    const [cats, prods] = await Promise.all([
      categoryService.getCategories(foundRest.id),
      productService.getProducts(foundRest.id)
    ])
    categories.value = cats
    products.value = prods

    // Inspect table session status
    if (foundTable.status === 'unavailable') {
      isTableUnavailable.value = true
      return
    }

    const inspectResult = await tableSessionStore.inspectTableSession(foundRest, foundTable)

    if (inspectResult.isOccupiedByOther) {
      // Table occupied by another person
      isOccupiedByOther.value = true
    } else if (inspectResult.isOwner && inspectResult.session) {
      // Current user is the owner of active session
      isBrowseOnly.value = false
      customerName.value = inspectResult.session.customerName
      await loadSessionOrders()
    } else {
      // Table is free
      isWelcomeModalOpen.value = true
    }
  } finally {
    isLoading.value = false
  }
})

// Keep orders updated if session changes
watch(() => tableSessionStore.currentSession?.orderIds.length, async () => {
  await loadSessionOrders()
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

const activeSession = computed(() => tableSessionStore.currentSession)
const isSessionActive = computed(() => {
  return !!activeSession.value && tableSessionStore.isSessionOwner && activeSession.value.status !== 'closed'
})

// Handle Option 1: Browse Menu Only
const handleBrowseOnly = () => {
  isWelcomeModalOpen.value = false
  isBrowseOnly.value = true
  isOccupiedByOther.value = false
  toastStore.info('Modo de Consulta', 'Pode explorar os itens do menu e adicionar ao seu carrinho antes de ocupar a mesa.')
}

// Handle Option 2: Occupy Table
const handleOccupyTable = async (payload: { customerName: string; partySize?: number; notes?: string }) => {
  if (!restaurant.value || !table.value) return
  isSubmittingOccupation.value = true
  try {
    const session = await tableSessionStore.occupyTable({
      restaurant: restaurant.value,
      table: table.value,
      customerName: payload.customerName,
      partySize: payload.partySize,
      notes: payload.notes
    })
    customerName.value = payload.customerName
    isWelcomeModalOpen.value = false
    isBrowseOnly.value = false
    isOccupiedByOther.value = false
    // If cart has items from browsing, keep them!
    if (cartStore.itemCount > 0) {
      toastStore.success('Mesa Pronta', 'Os itens que escolheu continuam no seu carrinho prontos para confirmação!')
    }
  } catch (e) {
    toastStore.error('Não foi possível ocupar a mesa', (e as Error).message)
  } finally {
    isSubmittingOccupation.value = false
  }
}

// Open product modal
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

// Checkout handler
const handleCheckoutClick = () => {
  // If in browse-only mode without active session, prompt occupation first!
  if (!isSessionActive.value) {
    isWelcomeModalOpen.value = true
    return
  }
  cartStore.isCartOpen = true
}

const handleConfirmOrder = async () => {
  if (!customerName.value.trim()) {
    toastStore.warning('Identificação Obrigatória', 'Por favor, insira o seu nome para o envio do pedido.')
    return
  }

  isSubmittingOrder.value = true
  try {
    const createdOrder = await cartStore.checkout({
      customerName: customerName.value.trim(),
      customerPhone: customerPhone.value.trim() || undefined,
      notes: orderNotes.value.trim() || undefined,
      paymentMethod: selectedPaymentMethod.value,
      tableSessionId: activeSession.value?.id
    })

    cartStore.isCartOpen = false
    await loadSessionOrders()

    toastStore.success(
      createdOrder.isAdditional ? 'Pedido Adicional Enviado!' : 'Pedido Enviado à Cozinha!',
      `Pedido ${createdOrder.orderCode} recebido com sucesso.`
    )
  } catch (e) {
    toastStore.error('Erro ao enviar pedido', (e as Error).message)
  } finally {
    isSubmittingOrder.value = false
  }
}

// Service request
const handleSendServiceRequest = async () => {
  if (!restaurant.value || !table.value) return
  isSubmittingService.value = true
  try {
    await serviceRequestStore.createCustomerRequest(
      table.value.id,
      table.value.number,
      serviceType.value,
      serviceNotes.value,
      activeSession.value?.id,
      customerName.value || activeSession.value?.customerName
    )
    isServiceModalOpen.value = false
    serviceNotes.value = ''
  } finally {
    isSubmittingService.value = false
  }
}

// Bill request
const handleConfirmBill = async (payload: { paymentMethod: PaymentMethod; notes?: string; totalAmount: number }) => {
  if (!restaurant.value || !table.value || !activeSession.value) return
  try {
    await tableSessionStore.requestBill({
      restaurant: restaurant.value,
      table: table.value,
      session: activeSession.value,
      totalAmount: payload.totalAmount,
      notes: payload.notes
    })
    isBillModalOpen.value = false
  } catch (e) {
    console.error('Erro ao pedir conta', e)
  }
}

const handleOrderMore = () => {
  isSessionHistoryOpen.value = false
  // Focus on catalog
  window.scrollTo({ top: 380, behavior: 'smooth' })
  toastStore.info('Menu Aberto', 'Escolha novos itens para o seu pedido adicional.')
}
</script>

<template>
  <div v-if="isLoading" class="loading-screen">
    <UtensilsCrossed :size="36" class="spin-icon" />
    <p class="loading-text">A preparar o menu digital da mesa...</p>
  </div>

  <!-- Scenario C: Table Unavailable -->
  <UnavailableNoticeScreen
    v-else-if="isTableUnavailable && restaurant"
    :restaurant="restaurant"
    :table="table"
    @call-service="isServiceModalOpen = true"
    @go-home="router.push('/')"
  />

  <!-- Scenario B: Table Occupied by Other Visitor -->
  <OccupiedNoticeScreen
    v-else-if="isOccupiedByOther && restaurant && table"
    :restaurant="restaurant"
    :table="table"
    :session="tableSessionStore.currentSession"
    @browse-menu="handleBrowseOnly"
    @call-service="isServiceModalOpen = true"
  />

  <!-- Scenario A & Active Menu Experience -->
  <div v-else-if="restaurant" class="menu-page">
    <!-- Active Session or Browsing Status Banner -->
    <div v-if="isSessionActive" class="session-status-banner">
      <div class="banner-inner">
        <div class="session-meta">
          <div class="live-indicator">
            <span class="pulsing-dot"></span>
            <strong>Mesa {{ table?.number }} • Olá, {{ activeSession?.customerName }}!</strong>
          </div>
          <span class="session-sub-text">
            {{ sessionOrders.length === 0 ? 'Sessão iniciada • Faça o seu primeiro pedido' : `${sessionOrders.length} ${sessionOrders.length === 1 ? 'pedido enviado' : 'pedidos enviados'} nesta sessão` }}
          </span>
        </div>

        <div class="banner-quick-actions">
          <button
            type="button"
            class="banner-btn"
            @click="isSessionHistoryOpen = true"
          >
            <Receipt :size="15" />
            <span>Pedidos na Mesa ({{ sessionOrders.length }})</span>
          </button>

          <button
            type="button"
            class="banner-btn highlight"
            @click="handleOrderMore"
          >
            <Plus :size="15" />
            <span>Pedir Mais Alguma Coisa</span>
          </button>

          <button
            v-if="sessionOrders.length > 0 && activeSession?.status !== 'awaiting_bill'"
            type="button"
            class="banner-btn warning"
            @click="isBillModalOpen = true"
          >
            <Receipt :size="15" />
            <span>Pedir a Conta</span>
          </button>

          <button
            type="button"
            class="banner-btn ghost"
            @click="isServiceModalOpen = true"
          >
            <BellRing :size="15" />
            <span>Chamar Garçom</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Browse Only Banner (When browsing without occupation) -->
    <div v-else-if="isBrowseOnly" class="browse-only-banner">
      <div class="browse-inner">
        <div class="browse-text">
          <Eye :size="18" class="browse-icon" />
          <span>Está em <strong>Modo de Consulta</strong> da Mesa {{ table?.number }}. Para enviar pedidos à cozinha, ocupe a mesa.</span>
        </div>
        <button type="button" class="occupy-now-btn" @click="isWelcomeModalOpen = true">
          <UtensilsCrossed :size="14" />
          <span>Ocupar Mesa Agora</span>
        </button>
      </div>
    </div>

    <!-- Hero Header -->
    <header class="menu-hero">
      <img :src="restaurant.coverImage" :alt="restaurant.name" class="hero-cover" />
      <div class="hero-gradient"></div>

      <div class="hero-content">
        <div class="restaurant-badge-row">
          <img :src="restaurant.logoUrl" :alt="restaurant.name" class="restaurant-logo" />
          <div class="table-tag">
            <span class="table-dot"></span>
            <strong>Mesa {{ table?.number || tableCode }}</strong>
            <span class="tag-sep">•</span>
            <span>{{ table?.area || 'Sala' }}</span>
          </div>
        </div>

        <h1 class="restaurant-title">{{ restaurant.name }}</h1>
        <p class="restaurant-desc">{{ restaurant.description }}</p>

        <div class="hero-actions">
          <button type="button" class="service-call-btn" @click="isServiceModalOpen = true">
            <BellRing :size="16" />
            <span>Chamar Garçom / Assistência</span>
          </button>

          <button
            v-if="isSessionActive && sessionOrders.length > 0"
            type="button"
            class="history-open-btn"
            @click="isSessionHistoryOpen = true"
          >
            <Receipt :size="16" />
            <span>Ver Meus Pedidos ({{ sessionOrders.length }})</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content Area: Responsive Layout (Grid + Sidebar on Desktop) -->
    <div class="menu-layout-container">
      <!-- Left / Main Column: Search, Categories, Products -->
      <main class="menu-main-column">
        <!-- Search & Category Navigation -->
        <div class="menu-nav-bar">
          <div class="search-box">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Pesquisar pratos, bebidas ou sobremesas..."
              class="search-input"
            />
          </div>

          <div class="categories-scroll" role="tablist">
            <button
              type="button"
              class="cat-chip"
              :class="{ 'is-active': activeCategoryId === 'all' }"
              @click="activeCategoryId = 'all'"
            >
              Todos ({{ products.length }})
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

        <!-- Contextual Suggestions: "Quer pedir mais alguma coisa?" -->
        <SuggestedProductsSection
          v-if="products.length > 0"
          :products="products"
          @select-product="openProductModal"
        />

        <!-- Products Grid -->
        <div class="products-section">
          <div v-if="filteredProducts.length === 0" class="empty-products">
            <AlertCircle :size="32" class="empty-icon" />
            <p>Nenhum item encontrado nesta categoria ou pesquisa.</p>
          </div>

          <div v-else class="products-grid">
            <article
              v-for="product in filteredProducts"
              :key="product.id"
              class="product-card"
              :class="{ 'is-unavailable': !product.isAvailable }"
              tabindex="0"
              @click="openProductModal(product)"
              @keyup.enter="openProductModal(product)"
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
                    aria-label="Adicionar prato"
                    @click.stop="openProductModal(product)"
                  >
                    <Plus :size="16" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </main>

      <!-- Desktop Sidebar: Active Table Panel & Cart Summary -->
      <aside class="menu-desktop-sidebar">
        <!-- Table & Session Widget -->
        <div class="desktop-panel table-session-widget">
          <div class="widget-header">
            <div class="widget-title-row">
              <span class="widget-dot"></span>
              <h3 class="widget-title">Mesa {{ table?.number }}</h3>
            </div>
            <AppBadge :variant="isSessionActive ? 'success' : 'neutral'">
              {{ isSessionActive ? 'Sessão Ativa' : 'Modo Consulta' }}
            </AppBadge>
          </div>

          <div v-if="isSessionActive" class="widget-body">
            <div class="session-user-line">
              <span class="user-label">Cliente:</span>
              <strong class="user-val">{{ activeSession?.customerName }}</strong>
            </div>
            <div v-if="activeSession?.partySize" class="session-user-line">
              <span class="user-label">Pessoas:</span>
              <span>{{ activeSession.partySize }}</span>
            </div>

            <div class="sidebar-actions-grid">
              <button
                type="button"
                class="sidebar-action-btn"
                @click="isSessionHistoryOpen = true"
              >
                <Receipt :size="16" />
                <span>Histórico ({{ sessionOrders.length }})</span>
              </button>

              <button
                type="button"
                class="sidebar-action-btn"
                @click="isServiceModalOpen = true"
              >
                <BellRing :size="16" />
                <span>Chamar Garçom</span>
              </button>
            </div>

            <button
              v-if="sessionOrders.length > 0 && activeSession?.status !== 'awaiting_bill'"
              type="button"
              class="request-bill-sidebar-btn"
              @click="isBillModalOpen = true"
            >
              <Receipt :size="16" />
              <span>Pedir a Conta da Mesa</span>
            </button>
          </div>

          <div v-else class="widget-body not-occupied">
            <p class="widget-hint">
              Está a navegar no menu. Para enviar pedidos à cozinha, ocupe a mesa com o seu nome.
            </p>
            <AppButton variant="primary" size="md" class="full-width" @click="isWelcomeModalOpen = true">
              Ocupar Mesa Agora
            </AppButton>
          </div>
        </div>

        <!-- Desktop Cart Panel -->
        <div class="desktop-panel desktop-cart-panel">
          <div class="cart-panel-header">
            <div class="cart-panel-title">
              <ShoppingBag :size="18" />
              <span>O Seu Pedido Atual</span>
            </div>
            <span class="cart-items-count">{{ cartStore.itemCount }} {{ cartStore.itemCount === 1 ? 'item' : 'itens' }}</span>
          </div>

          <div v-if="cartStore.items.length === 0" class="empty-sidebar-cart">
            <ShoppingBag :size="32" class="empty-cart-icon" />
            <p>O carrinho para este pedido está vazio.</p>
            <span>Escolha itens no menu para adicionar.</span>
          </div>

          <div v-else class="sidebar-cart-content">
            <div class="sidebar-items-scroll">
              <div
                v-for="item in cartStore.items"
                :key="item.id"
                class="sidebar-item-row"
              >
                <div class="item-text-info">
                  <span class="sidebar-item-name">{{ item.productName }}</span>
                  <span v-if="item.selectedVariant" class="sidebar-item-sub">({{ item.selectedVariant.name }})</span>
                  <span class="sidebar-item-price">{{ item.totalPrice.toLocaleString('pt-MZ') }} MT</span>
                </div>

                <div class="sidebar-qty-controls">
                  <button type="button" class="btn-qty-mini" @click="cartStore.updateQuantity(item.id, item.quantity - 1)">
                    <Minus :size="12" />
                  </button>
                  <span class="qty-num">{{ item.quantity }}</span>
                  <button type="button" class="btn-qty-mini" @click="cartStore.updateQuantity(item.id, item.quantity + 1)">
                    <Plus :size="12" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Totals breakdown -->
            <div class="sidebar-totals">
              <div class="tot-row">
                <span>Subtotal:</span>
                <span>{{ cartStore.subtotal.toLocaleString('pt-MZ') }} MT</span>
              </div>
              <div class="tot-row grand">
                <strong>Total:</strong>
                <strong>{{ cartStore.grandTotal.toLocaleString('pt-MZ') }} MT</strong>
              </div>
            </div>

            <AppButton
              variant="success"
              size="lg"
              class="full-width"
              @click="handleCheckoutClick"
            >
              {{ isSessionActive ? 'Rever & Confirmar Pedido' : 'Ocupar Mesa para Concluir' }}
            </AppButton>
          </div>
        </div>
      </aside>
    </div>

    <!-- Product Customization Modal -->
    <AppModal
      :is-open="isProductModalOpen"
      :title="selectedProduct?.name"
      :subtitle="selectedProduct?.station === 'bar' ? 'Bebida / Bar' : 'Cozinha'"
      max-width="540px"
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
          <div class="group-title">Acompanhamentos / Extras:</div>
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
          <div class="group-title">Preferências (Remover Ingredientes):</div>
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
          <label for="prodNotes" class="group-title">Observações Especiais para a Cozinha:</label>
          <textarea
            id="prodNotes"
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
              aria-label="Diminuir quantidade"
              @click="itemQuantity--"
            >
              <Minus :size="16" />
            </button>
            <span class="qty-val">{{ itemQuantity }}</span>
            <button
              type="button"
              class="qty-btn"
              aria-label="Aumentar quantidade"
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

    <!-- Cart Modal / Checkout (Mobile / Overlay) -->
    <AppModal
      :is-open="cartStore.isCartOpen"
      title="O Seu Pedido"
      :subtitle="`Mesa ${table?.number || tableCode} • ${restaurant.name}`"
      max-width="600px"
      @close="cartStore.isCartOpen = false"
    >
      <div class="cart-modal-body">
        <div v-if="cartStore.items.length === 0" class="empty-cart-msg">
          <ShoppingBag :size="40" class="empty-icon" />
          <p class="empty-title">O seu carrinho para este pedido está vazio.</p>
          <span class="empty-sub">Adicione pratos ou bebidas do menu para avançar.</span>
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
              <button type="button" class="qty-btn-sm" aria-label="Diminuir" @click="cartStore.updateQuantity(item.id, item.quantity - 1)">
                <Minus :size="14" />
              </button>
              <span class="qty-text">{{ item.quantity }}</span>
              <button type="button" class="qty-btn-sm" aria-label="Aumentar" @click="cartStore.updateQuantity(item.id, item.quantity + 1)">
                <Plus :size="14" />
              </button>
              <button type="button" class="trash-btn" title="Remover item" @click="cartStore.removeItem(item.id)">
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
              <strong>Total Deste Pedido:</strong>
              <strong>{{ cartStore.grandTotal.toLocaleString('pt-MZ') }} MT</strong>
            </div>
          </div>

          <!-- Customer info / Session confirmation -->
          <div class="checkout-fields">
            <div class="form-title">Dados da Mesa & Responsável</div>
            <div class="fields-row">
              <input
                v-model="customerName"
                type="text"
                placeholder="Nome do cliente *"
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

            <div class="form-group">
              <input
                v-model="orderNotes"
                type="text"
                placeholder="Observações adicionais para este pedido..."
                class="form-input"
              />
            </div>

            <!-- Payment preference -->
            <div class="payment-method-selector">
              <div class="form-title">Método de Pagamento Preferencial:</div>
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
                  <Banknote :size="18" />
                  <span>Dinheiro</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="cartStore.isCartOpen = false">Continuar a Escolher</AppButton>
        <AppButton
          variant="success"
          size="lg"
          :disabled="cartStore.items.length === 0"
          :loading="isSubmittingOrder"
          @click="handleConfirmOrder"
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
      max-width="480px"
      @close="isServiceModalOpen = false"
    >
      <div class="service-modal-content">
        <p class="service-subhead">
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

          <button
            type="button"
            class="service-option-btn"
            :class="{ 'is-selected': serviceType === 'general_help' }"
            @click="serviceType = 'general_help'"
          >
            <span>Assistência Geral</span>
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

    <!-- Welcome Modal for Free Table (Scenario A) -->
    <WelcomeTableModal
      v-if="table"
      :is-open="isWelcomeModalOpen"
      :restaurant="restaurant"
      :table="table"
      :is-submitting="isSubmittingOccupation"
      @browse-menu="handleBrowseOnly"
      @occupy-table="handleOccupyTable"
    />

    <!-- Session Orders History Modal -->
    <SessionHistoryModal
      :is-open="isSessionHistoryOpen"
      :session="activeSession"
      :orders="sessionOrders"
      @close="isSessionHistoryOpen = false"
      @order-more="handleOrderMore"
      @request-bill="isSessionHistoryOpen = false; isBillModalOpen = true"
    />

    <!-- Bill Request Modal -->
    <BillRequestModal
      :is-open="isBillModalOpen"
      :session="activeSession"
      :orders="sessionOrders"
      @close="isBillModalOpen = false"
      @confirm-bill="handleConfirmBill"
    />
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

.loading-text {
  font-size: 0.9375rem;
  font-weight: 600;
}

.menu-page {
  padding-bottom: 6rem;
  background-color: #f8fafc;
  min-height: 100vh;
}

/* Session Status Banner */
.session-status-banner {
  background: linear-gradient(90deg, #1e3a8a 0%, #1e40af 100%);
  color: #ffffff;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  position: sticky;
  top: 0;
  z-index: 800;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.banner-inner {
  max-width: 1320px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.session-meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
}

.pulsing-dot {
  width: 9px;
  height: 9px;
  background-color: #4ade80;
  border-radius: 50%;
  box-shadow: 0 0 8px #4ade80;
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
}

.session-sub-text {
  font-size: 0.75rem;
  color: #bfdbfe;
}

.banner-quick-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.banner-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 36px;
}

.banner-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

.banner-btn.highlight {
  background-color: var(--color-success-500);
  border-color: var(--color-success-400);
  color: #ffffff;
}

.banner-btn.highlight:hover {
  background-color: var(--color-success-600);
}

.banner-btn.warning {
  background-color: #eab308;
  border-color: #ca8a04;
  color: #713f12;
}

.banner-btn.warning:hover {
  background-color: #facc15;
}

/* Browse Only Banner */
.browse-only-banner {
  background-color: #eff6ff;
  border-bottom: 1.5px solid #bfdbfe;
  padding: 0.625rem 1.25rem;
  position: sticky;
  top: 0;
  z-index: 800;
}

.browse-inner {
  max-width: 1320px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.browse-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #1e3a8a;
}

.browse-icon {
  color: #2563eb;
  flex-shrink: 0;
}

.occupy-now-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.875rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-800);
  color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.occupy-now-btn:hover {
  background-color: var(--color-primary-900);
}

/* Hero Section */
.menu-hero {
  position: relative;
  height: 260px;
  overflow: hidden;
  background-color: #0f172a;
}

.hero-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.5;
}

.hero-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%);
}

.hero-content {
  position: absolute;
  bottom: 1.5rem;
  left: 1.25rem;
  right: 1.25rem;
  max-width: 1320px;
  margin: 0 auto;
  color: #ffffff;
}

.restaurant-badge-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.restaurant-logo {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 2px solid #ffffff;
  object-fit: cover;
  box-shadow: var(--shadow-md);
}

.table-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background-color: var(--color-success-600);
  color: #ffffff;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 700;
}

.table-dot {
  width: 7px;
  height: 7px;
  background-color: #ffffff;
  border-radius: 50%;
}

.tag-sep {
  opacity: 0.6;
}

.restaurant-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.restaurant-desc {
  margin: 0.25rem 0 0.75rem 0;
  font-size: 0.875rem;
  color: #cbd5e1;
  max-width: 600px;
  line-height: 1.4;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.service-call-btn,
.history-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 40px;
}

.service-call-btn:hover,
.history-open-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

/* Responsive Main Layout Container */
.menu-layout-container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 1.25rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 1024px) {
  .menu-layout-container {
    grid-template-columns: 1fr 340px;
    align-items: start;
  }
}

@media (min-width: 1280px) {
  .menu-layout-container {
    grid-template-columns: 1fr 380px;
    gap: 2rem;
  }
}

/* Main Column */
.menu-main-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Search and Navigation Bar */
.menu-nav-bar {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  background-color: #ffffff;
  padding: 1rem;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-lg);
  font-size: 0.9375rem;
  outline: none;
  background-color: #f8fafc;
  transition: all var(--transition-fast);
  min-height: 44px;
}

.search-input:focus {
  border-color: var(--color-primary-600);
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.categories-scroll {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
}

.cat-chip {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--border-color);
  background-color: #ffffff;
  color: var(--text-main);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  min-height: 40px;
}

.cat-chip:hover {
  border-color: var(--color-primary-400);
}

.cat-chip.is-active {
  background-color: var(--color-primary-800);
  border-color: var(--color-primary-800);
  color: #ffffff;
}

/* Products Section & Grid */
.products-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-products {
  text-align: center;
  padding: 3rem 1rem;
  background-color: #ffffff;
  border-radius: var(--radius-xl);
  border: 1px dashed var(--border-color);
  color: var(--text-muted);
}

.empty-icon {
  margin: 0 auto 0.5rem auto;
  color: var(--color-slate-400);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

@media (min-width: 640px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

.product-card {
  background-color: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary-400);
  box-shadow: var(--shadow-md);
}

.product-card.is-unavailable {
  opacity: 0.65;
  filter: grayscale(0.5);
  cursor: not-allowed;
}

.product-image-box {
  position: relative;
  height: 170px;
  background-color: var(--color-slate-100);
  overflow: hidden;
}

.product-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-card:hover .product-thumb {
  transform: scale(1.03);
}

.badges-corner {
  position: absolute;
  top: 0.625rem;
  left: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.corner-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
}

.corner-badge.featured {
  background-color: var(--color-primary-800);
  color: #ffffff;
}

.corner-badge.promo {
  background-color: var(--color-danger-500);
  color: #ffffff;
}

.corner-badge.unavailable {
  background-color: var(--color-slate-800);
  color: #ffffff;
}

.product-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.product-name-row {
  margin-bottom: 0.25rem;
}

.product-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.3;
}

.product-description {
  margin: 0 0 1rem 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.45;
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
  margin-top: auto;
  gap: 0.5rem;
}

.price-box {
  display: flex;
  flex-direction: column;
}

.original-price {
  font-size: 0.75rem;
  color: var(--text-muted);
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
  border: 1.5px solid var(--color-primary-300);
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 40px;
}

.add-btn:hover:not(:disabled) {
  background-color: var(--color-primary-800);
  color: #ffffff;
  border-color: var(--color-primary-800);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Desktop Sidebar */
.menu-desktop-sidebar {
  display: none;
}

@media (min-width: 1024px) {
  .menu-desktop-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    position: sticky;
    top: 5rem;
  }
}

.desktop-panel {
  background-color: #ffffff;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-session-widget {
  padding: 1.25rem;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 0.75rem;
}

.widget-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.widget-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-success-500);
}

.widget-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-main);
}

.widget-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-user-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
}

.user-label {
  color: var(--text-muted);
}

.user-val {
  color: var(--text-main);
}

.sidebar-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.sidebar-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--color-slate-50);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidebar-action-btn:hover {
  background-color: #ffffff;
  border-color: var(--color-primary-400);
}

.request-bill-sidebar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem;
  border-radius: var(--radius-md);
  background-color: #fef08a;
  border: 1px solid #eab308;
  color: #854d0e;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.request-bill-sidebar-btn:hover {
  background-color: #fde047;
}

.widget-hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
}

/* Cart Panel Desktop */
.desktop-cart-panel {
  display: flex;
  flex-direction: column;
}

.cart-panel-header {
  padding: 1rem 1.25rem;
  background-color: #f8fafc;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cart-panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  font-size: 0.9375rem;
  color: var(--text-main);
}

.cart-items-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary-800);
}

.empty-sidebar-cart {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-muted);
}

.empty-cart-icon {
  margin: 0 auto 0.5rem auto;
  opacity: 0.4;
}

.empty-sidebar-cart p {
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
}

.empty-sidebar-cart span {
  font-size: 0.75rem;
}

.sidebar-cart-content {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-items-scroll {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.item-text-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-item-name {
  font-weight: 700;
  color: var(--text-main);
}

.sidebar-item-sub {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.sidebar-item-price {
  font-weight: 700;
  color: var(--color-primary-800);
}

.sidebar-qty-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.btn-qty-mini {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.qty-num {
  font-weight: 700;
  font-size: 0.8125rem;
}

.sidebar-totals {
  border-top: 1px dashed var(--border-color);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.8125rem;
}

.tot-row {
  display: flex;
  justify-content: space-between;
}

.tot-row.grand {
  font-size: 1rem;
  color: var(--color-primary-900);
  margin-top: 0.25rem;
}

.full-width {
  width: 100%;
}

/* Modals Customization */
.customization-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-product-img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: var(--radius-lg);
}

.modal-product-desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.45;
}

.custom-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.radio-option,
.checkbox-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.radio-option.is-selected,
.checkbox-option.is-selected {
  border-color: var(--color-primary-600);
  background-color: #eff6ff;
}

.option-name {
  font-weight: 600;
  color: var(--text-main);
}

.option-price {
  font-weight: 700;
  color: var(--color-primary-800);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.ingredient-tag {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
  background-color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ingredient-tag.is-removed {
  background-color: var(--color-danger-50);
  border-color: var(--color-danger-300);
  color: var(--color-danger-700);
  text-decoration: line-through;
}

.notes-textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}

.quantity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.qty-control {
  display: flex;
  align-items: center;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.qty-btn {
  width: 40px;
  height: 40px;
  background-color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-main);
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-val {
  padding: 0 0.875rem;
  font-size: 1rem;
  font-weight: 800;
}

/* Cart Modal Body */
.cart-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.empty-cart-msg {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--text-muted);
}

.empty-title {
  margin: 0.5rem 0 0.25rem 0;
  font-weight: 700;
  color: var(--text-main);
}

.empty-sub {
  font-size: 0.8125rem;
}

.cart-items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 380px;
  overflow-y: auto;
}

.cart-item-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background-color: #ffffff;
}

.item-main {
  flex: 1;
}

.item-title {
  font-weight: 800;
  font-size: 0.9375rem;
  color: var(--text-main);
}

.item-sub {
  font-size: 0.75rem;
  margin-top: 0.125rem;
}

.text-danger {
  color: var(--color-danger-600);
}

.text-muted {
  color: var(--text-muted);
}

.item-price {
  font-weight: 800;
  color: var(--color-primary-800);
  margin-top: 0.35rem;
}

.item-qty-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.qty-btn-sm {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.qty-text {
  font-weight: 700;
  padding: 0 0.35rem;
  min-width: 24px;
  text-align: center;
}

.trash-btn {
  background: none;
  border: none;
  color: var(--color-danger-500);
  cursor: pointer;
  padding: 0.35rem;
  margin-left: 0.25rem;
}

.totals-breakdown {
  background-color: var(--color-slate-50);
  padding: 0.875rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8125rem;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
}

.total-highlight {
  border-top: 1px dashed var(--border-color);
  padding-top: 0.5rem;
  margin-top: 0.25rem;
  font-size: 1rem;
  color: var(--color-primary-900);
}

.checkout-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
}

@media (max-width: 480px) {
  .fields-row {
    grid-template-columns: 1fr;
  }
}

.form-input {
  width: 100%;
  padding: 0.65rem 0.875rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
  min-height: 44px;
}

.form-input:focus {
  border-color: var(--color-primary-600);
}

.methods-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.method-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.625rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  min-height: 44px;
}

.method-btn.is-selected {
  border-color: var(--color-primary-700);
  background-color: #eff6ff;
  color: var(--color-primary-900);
}

/* Service Request Modal */
.service-modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.service-subhead {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.service-options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

.service-option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.875rem 0.5rem;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-lg);
  background-color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
  min-height: 64px;
  transition: all var(--transition-fast);
}

.service-option-btn:hover {
  border-color: var(--color-primary-400);
}

.service-option-btn.is-selected {
  border-color: var(--color-primary-700);
  background-color: #eff6ff;
  color: var(--color-primary-900);
}
</style>
