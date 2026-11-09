<script setup lang="ts">
import { computed } from 'vue'
import type { Table } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { TABLE_STATUS_LABELS, effectiveTableStatus } from '@/domain/tableRules'

const props = defineProps<{ table: Pick<Table, 'status' | 'isActive'> }>()

const status = computed(() => effectiveTableStatus(props.table))
const variant = computed(() => (status.value === 'free' ? 'success' : status.value === 'occupied' ? 'primary' : 'neutral'))
const label = computed(() => (!props.table.isActive ? 'Desativada' : TABLE_STATUS_LABELS[status.value]))
</script>

<template>
  <AppBadge :variant="variant" dot>{{ label }}</AppBadge>
</template>
