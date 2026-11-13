<script setup lang="ts">
import { ref } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useToastStore } from '@/stores/toast'
import AppToast from '@/components/ui/AppToast.vue'
import { ShoppingBag, ArrowRight } from 'lucide-vue-next'

const cartStore = useCartStore()
const toastStore = useToastStore()
</script>

<template>
  <div class="customer-wrapper">

    <main class="customer-main">
      <router-view />
    </main>

    <!-- Floating Bottom Cart Bar (Appears when cart has items) -->
    <Transition name="cart-slide">
      <div v-if="cartStore.itemCount > 0" class="floating-cart-bar">
        <div class="cart-bar-inner">
          <div class="cart-bar-info">
            <div class="cart-bar-count">
              <ShoppingBag :size="18" />
              <span>{{ cartStore.itemCount }} {{ cartStore.itemCount === 1 ? 'item' : 'itens' }}</span>
            </div>
            <div class="cart-bar-total">
              <span class="total-label">Total:</span>
              <span class="total-amount">{{ cartStore.grandTotal.toLocaleString('pt-MZ') }} MT</span>
            </div>
          </div>

          <button
            class="view-order-btn"
            @click="cartStore.isCartOpen = true"
          >
            <span>Ver Pedido</span>
            <ArrowRight :size="16" />
          </button>
        </div>
      </div>
    </Transition>

    <AppToast />
  </div>
</template>

<style scoped>
.customer-wrapper {
  min-height: 100vh;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px));
}

.customer-main {
  flex: 1;
  min-width: 0;
}

.floating-cart-bar {
  position: fixed;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  left: 1rem;
  right: 1rem;
  max-width: 500px;
  margin: 0 auto;
  z-index: 900;
}

.cart-bar-inner {
  background: var(--color-primary-900);
  color: #ffffff;
  padding: 0.875rem 1.25rem;
  border-radius: var(--radius-xl);
  box-shadow: 0 10px 25px -5px rgba(30, 58, 138, 0.4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.cart-bar-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.cart-bar-count {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #93c5fd;
  font-weight: 500;
}

.cart-bar-total {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
}

.total-label {
  font-size: 0.75rem;
  color: #cbd5e1;
}

.total-amount {
  font-size: 1.125rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: #ffffff;
}

.view-order-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--color-success-500);
  color: #ffffff;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.view-order-btn:hover {
  background-color: var(--color-success-600);
  transform: translateY(-1px);
}

.cart-slide-enter-active,
.cart-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.cart-slide-enter-from,
.cart-slide-leave-to {
  opacity: 0;
  transform: translateY(2rem);
}

@media (max-width: 420px) {
  .floating-cart-bar {
    left: 0.75rem;
    right: 0.75rem;
  }

  .cart-bar-inner {
    padding: 0.75rem 0.875rem;
    gap: 0.625rem;
  }

  .cart-bar-count {
    font-size: 0.75rem;
  }

  .total-amount {
    font-size: 1rem;
  }

  .view-order-btn {
    padding: 0.6rem 0.9rem;
    font-size: 0.8125rem;
  }
}
</style>
