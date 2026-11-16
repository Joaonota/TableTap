<script setup lang="ts">
/**
 * Foto de produto que se adapta a qualquer proporção (vertical, horizontal,
 * quadrada, muito larga…): a imagem aparece SEMPRE inteira, sem cortes, e o
 * espaço que sobra é preenchido por uma versão desfocada da própria foto.
 *
 * Ocupa 100% do contentor pai — quem a usa define a altura/largura da caixa.
 */
withDefaults(
  defineProps<{
    src: string
    alt?: string
    loading?: 'lazy' | 'eager'
  }>(),
  { alt: '', loading: 'lazy' }
)
</script>

<template>
  <div class="product-image">
    <img :src="src" alt="" aria-hidden="true" class="pi-backdrop" :loading="loading" draggable="false" />
    <img :src="src" :alt="alt" class="pi-main" :loading="loading" />
  </div>
</template>

<style scoped>
.product-image {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-slate-100, #f1f5f9);
  isolation: isolate;
}

/* Fundo: a mesma foto, ampliada e desfocada, para não haver faixas vazias. */
.pi-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.25);
  filter: blur(16px) saturate(1.15);
  opacity: 0.6;
  z-index: -1;
  pointer-events: none;
  user-select: none;
}

/* Foto principal: inteira, centrada, sem cortes. */
.pi-main {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}
</style>
