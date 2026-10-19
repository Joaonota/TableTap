import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OrderItem, OrderType, PaymentStatus, Product, ProductVariant, ProductAddon, Restaurant, Table, PaymentMethod } from '@/types'
import { useOrderStore } from './order'
import { useToastStore } from './toast'

export interface CartCustomization {
  selectedVariant?: ProductVariant
  selectedAddons?: ProductAddon[]
  removedIngredients?: string[]
  notes?: string
}

export const useCartStore = defineStore('cart', () => {
  const orderStore = useOrderStore()
  const toastStore = useToastStore()

  const items = ref<OrderItem[]>([])
  const activeRestaurant = ref<Restaurant | null>(null)
  const activeTable = ref<Table | null>(null)

  const itemCount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const subtotal = computed(() => {
    return items.value.reduce((sum, item) => sum + item.totalPrice, 0)
  })

  const taxAmount = computed(() => {
    const rate = activeRestaurant.value?.taxRate || 16
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

  const checkout = async (options: {
    customerName?: string
    customerPhone?: string
    notes?: string
    paymentMethod?: PaymentMethod
  }) => {
    if (items.value.length === 0) {
      throw new Error('O carrinho está vazio!')
    }
    if (!activeRestaurant.value) {
      throw new Error('Restaurante não identificado.')
    }

    const orderData = {
      tenantId: activeRestaurant.value.tenantId,
      restaurantId: activeRestaurant.value.id,
      tableId: activeTable.value?.id,
      tableNumber: activeTable.value?.number || 'Balcão',
      type: (activeTable.value ? 'dine_in' : 'takeaway') as OrderType,
      status: 'received' as const,
      paymentStatus: 'pending' as PaymentStatus,
      paymentMethod: options.paymentMethod,
      items: JSON.parse(JSON.stringify(items.value)),
      subtotal: subtotal.value,
      taxAmount: taxAmount.value,
      serviceFee: serviceFee.value,
      total: grandTotal.value,
      customerName: options.customerName || 'Cliente Mesa',
      customerPhone: options.customerPhone,
      notes: options.notes
    }

    const order = await orderStore.createNewOrder(orderData)
    clearCart()
    return order
  }

  return {
    items,
    activeRestaurant,
    activeTable,
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
