<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Restaurant } from '@/types'
import { restaurantService } from '@/services'
import NfcTagManager from '@/components/nfc-tags/NfcTagManager.vue'

const restaurants = ref<Restaurant[]>([])

onMounted(async () => {
  restaurants.value = (await restaurantService.getAllRestaurants()).sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <div class="page">
    <header>
      <h1 class="page-title">Etiquetas NFC</h1>
      <p class="page-subtitle">
        Preparação e registo das etiquetas de todos os restaurantes. A gravação física é feita pela equipa com uma aplicação externa;
        aqui regista-se o resultado.
      </p>
    </header>
    <NfcTagManager scope="platform" :restaurants="restaurants" />
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
  max-width: 720px;
}
</style>
