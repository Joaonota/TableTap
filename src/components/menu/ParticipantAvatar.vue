<script setup lang="ts">
import { computed } from 'vue'
import { avatarColor, initials } from '@/domain/groupBill'

/** Avatar de um participante da mesa: iniciais sobre a cor escolhida. */
const props = withDefaults(defineProps<{ id: string; name: string; avatar?: string; size?: number }>(), { size: 32 })
const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.38)}px`,
  background: avatarColor({ id: props.id, avatar: props.avatar })
}))
</script>

<template>
  <span class="pa" :style="style" :title="name" aria-hidden="true">{{ initials(name) }}</span>
</template>

<style scoped>
.pa {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 800;
  letter-spacing: 0.02em;
  box-shadow: 0 0 0 2px #fff;
  user-select: none;
}
</style>
