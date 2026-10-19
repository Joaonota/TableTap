<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTenantStore } from '@/stores/tenant'
import DemoBanner from '@/components/ui/DemoBanner.vue'
import AppToast from '@/components/ui/AppToast.vue'
import { ChefHat, ArrowLeft, Clock } from 'lucide-vue-next'

const router = useRouter()
const tenantStore = useTenantStore()

const currentTime = ref('')

const updateClock = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

let timer: number
onMounted(() => {
  updateClock()
  timer = window.setInterval(updateClock, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="kds-wrapper">
    <DemoBanner />

    <!-- KDS Top Header -->
    <header class="kds-header">
      <div class="kds-header-left">
        <div class="kds-badge">
          <ChefHat :size="22" />
        </div>
        <div>
          <h1 class="kds-title">Kitchen Display System (KDS)</h1>
          <p class="kds-subtitle">{{ tenantStore.currentRestaurant?.name || 'Cozinha Central' }}</p>
        </div>
      </div>

      <div class="kds-header-right">
        <div class="kds-clock">
          <Clock :size="18" />
          <span>{{ currentTime }}</span>
        </div>

        <router-link to="/app/pedidos" class="exit-kds-btn">
          <ArrowLeft :size="16" />
          <span>Sair do KDS</span>
        </router-link>
      </div>
    </header>

    <main class="kds-main">
      <router-view />
    </main>

    <AppToast />
  </div>
</template>

<style scoped>
.kds-wrapper {
  min-height: 100vh;
  background-color: #0b1120;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
}

.kds-header {
  height: 70px;
  background: #111827;
  border-bottom: 2px solid #1f2937;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
}

.kds-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.kds-badge {
  width: 44px;
  height: 44px;
  background: #dc2626;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.kds-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.1;
}

.kds-subtitle {
  font-size: 0.8125rem;
  color: #9ca3af;
}

.kds-header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.kds-clock {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  font-family: monospace;
  color: #38bdf8;
  background: #1e293b;
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid #334155;
}

.exit-kds-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #374151;
  color: #ffffff;
  padding: 0.55rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.exit-kds-btn:hover {
  background: #4b5563;
}

.kds-main {
  flex: 1;
  padding: 1.5rem;
}
</style>
