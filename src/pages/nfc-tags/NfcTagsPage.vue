<script setup lang="ts">
import { computed } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import NfcTagManager from '@/components/nfc-tags/NfcTagManager.vue'

const tenantStore = useTenantStore()
const restaurants = computed(() => (tenantStore.currentRestaurant ? [tenantStore.currentRestaurant] : []))
</script>

<template>
  <div class="page">
    <header>
      <h1 class="page-title">Etiquetas NFC</h1>
      <p class="page-subtitle">
        Que etiqueta está em cada mesa, que URL contém e em que estado se encontra{{ tenantStore.currentRestaurant ? ` — ${tenantStore.currentRestaurant.name}` : '' }}.
      </p>
    </header>
    <NfcTagManager scope="restaurant" :restaurants="restaurants" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
