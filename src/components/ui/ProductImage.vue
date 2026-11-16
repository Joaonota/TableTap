<script setup lang="ts">
/**
 * Foto de produto que se adapta a qualquer proporção (vertical, horizontal,
 * quadrada, muito larga…). A imagem aparece SEMPRE inteira, sem cortes.
 *
 * Dois modos:
 *  - por omissão: ocupa 100% do contentor pai (quem a usa define o tamanho
 *    da caixa) e o espaço que sobra é preenchido pela própria foto desfocada.
 *  - `natural`: a altura segue a proporção real da foto, para o cartão se
 *    ajustar à imagem. Limites configuráveis por CSS no contentor:
 *      --pi-min-h (por omissão 140px) — fotos muito largas não ficam finas;
 *      --pi-max-h (por omissão 420px) — fotos muito altas não criam cartões
 *      gigantes. Fora destes limites entra o fundo desfocado.
 */
withDefaults(
  defineProps<{
    src: string
    alt?: string
    loading?: 'lazy' | 'eager'
    natural?: boolean
  }>(),
  { alt: '', loading: 'lazy', natural: false }
)
</script>

<template>
  <div class="product-image" :class="{ 'is-natural': natural }">
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

/* Modo natural: a caixa toma a altura que a foto pede (dentro dos limites). */
.product-image.is-natural {
  height: auto;
  min-height: var(--pi-min-h, 140px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-image.is-natural .pi-main {
  height: auto;
  max-height: var(--pi-max-h, 420px);
}
</style>
