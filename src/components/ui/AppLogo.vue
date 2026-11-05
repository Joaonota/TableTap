<script setup lang="ts">
interface Props {
  size?: number
  chip?: boolean
}

withDefaults(defineProps<Props>(), {
  size: 32,
  chip: false
})
</script>

<template>
  <span class="app-logo" :class="{ 'app-logo--chip': chip }">
    <img src="/logo/logo.PNG" alt="TapMenu" :style="{ height: `${size}px` }" />
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  vertical-align: middle;
}

.app-logo img {
  display: block;
  width: auto;
}

.app-logo--chip {
  background: #ffffff;
  border-radius: var(--radius-md);
  padding: 0.375rem 0.625rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
</style>
