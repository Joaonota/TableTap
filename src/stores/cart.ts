import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OrderItem, Product, ProductVariant, ProductAddon, Restaurant, Table, PaymentMethod } from '@/types'
import { useToastStore } from './toast'
import { publicTableService } from '@/services'

export interface CartCustomization {
  selectedVariant?: ProductVariant
  selectedAddons?: ProductAddon[]
  removedIngredients?: string[]
  notes?: string
}

export const useCartStore = defineStore('cart', () => {
  const toastStore = useToastStore()

  const items = ref<OrderItem[]>([])
  const activeRestaurant = ref<Restaurant | null>(null)
  const activeTable = ref<Table | null>(null)
  const isCartOpen = ref(false)

  const itemCount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const subtotal = computed(() => {
    return items.value.reduce((sum, item) => sum + item.totalPrice, 0)
  })

  const taxAmount = computed(() => {
    const rate = activeRestaurant.value?.taxRate ?? 0
    return Math.round((subtotal.value * (rate / 100)) * 100) / 100
  })

  const serviceFee = computed(() => {
    const feePercent = activeRestaurant.value?.settings.serviceFeePercent || 0
    return Math.round((subtotal.value * (feePercent / 100)) * 100) / 100
  })

  const grandTotal = computed(() => {
    return Math.round((subtotal.value + taxAmount.value + serviceFee.value) * 100) / 100
  })

  const setRestaurantAndTable = (restaurant: Restaurant, table?: Table) => {
    activeRestaurant.value = restaurant
    activeTable.value = table || null
  }

  const addItem = (
    product: Product,
    quantity: number = 1,
    customization?: CartCustomization
  ) => {
    if (!product.isAvailable) {
      toastStore.error('Produto Indisponível', `${product.name} não está disponível no momento.`)
      return false
    }

    // Calculate item unit price based on catalog price + variant delta + addons
    const basePrice = product.promotionalPrice ?? product.price
    const variantDelta = customization?.selectedVariant?.priceDelta ?? 0
    const addonsTotal = (customization?.selectedAddons ?? []).reduce((s, a) => s + a.price, 0)
    const unitPrice = basePrice + variantDelta + addonsTotal
    const totalPrice = unitPrice * quantity

    const newItem: OrderItem = {
      id: `cart-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrl,
      quantity,
      unitPrice,
      totalPrice,
      selectedVariant: customization?.selectedVariant
        ? {
            id: customization.selectedVariant.id,
            name: customization.selectedVariant.name,
            priceDelta: customization.selectedVariant.priceDelta
          }
        : undefined,
      selectedAddons: customization?.selectedAddons?.map(a => ({
        id: a.id,
        name: a.name,
        price: a.price
      })),
      removedIngredients: customization?.removedIngredients,
      notes: customization?.notes,
      station: product.station
    }

    items.value.push(newItem)
    toastStore.success('Adicionado ao Pedido', `${product.name} foi adicionado com sucesso.`)
    return true
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    const item = items.value.find(i => i.id === itemId)
    if (!item) return

    if (newQuantity <= 0) {
      removeItem(itemId)
    } else {
      item.quantity = newQuantity
      item.totalPrice = item.unitPrice * newQuantity
    }
  }

  const removeItem = (itemId: string) => {
    items.value = items.value.filter(i => i.id !== itemId)
    toastStore.info('Item removido do pedido')
  }

  const clearCart = () => {
    items.value = []
  }

  /**
   * Envia o pedido. O navegador só diz O QUE foi pedido (produto, quantidade,
   * opções); preços, IVA, taxa de serviço e total são calculados pelo
   * servidor a partir do menu atual. A notificação à equipa também é criada
   * no servidor.
   */
  const checkout = async (options: {
    customerName?: string
    customerPhone?: string
    notes?: string
    paymentMethod?: PaymentMethod
    tableSessionId?: string
    participantToken?: string
  }) => {
    if (items.value.length === 0) {
      throw new Error('O carrinho está vazio!')
    }
    if (!activeRestaurant.value) {
      throw new Error('Restaurante não identificado.')
    }
    if (!options.tableSessionId) {
      throw new Error('Inicie ou junte-se à sessão da mesa para enviar o pedido.')
    }

    const order = await publicTableService.placeOrder({
      sessionId: options.tableSessionId,
      participantToken: options.participantToken,
      customerName: options.customerName,
      customerPhone: options.customerPhone,
      notes: options.notes,
      paymentMethod: options.paymentMethod,
      items: items.value.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.selectedVariant?.id,
        addonIds: item.selectedAddons?.map(a => a.id),
        removedIngredients: item.removedIngredients,
        notes: item.notes
      }))
    })

    clearCart()
    return order
  }

  return {
    items,
    activeRestaurant,
    activeTable,
    isCartOpen,
    itemCount,
    subtotal,
    taxAmount,
    serviceFee,
    grandTotal,
    setRestaurantAndTable,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    checkout
  }
})
