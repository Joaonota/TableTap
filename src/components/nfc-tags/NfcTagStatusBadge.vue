<script setup lang="ts">
import { computed } from 'vue'
import type { NfcTagStatus } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import { NFC_TAG_STATUS_DESCRIPTIONS, NFC_TAG_STATUS_LABELS } from '@/domain/nfcTagRules'

const props = defineProps<{ status: NfcTagStatus }>()

const variant = computed(() => {
  switch (props.status) {
    case 'active':
      return 'success'
    case 'configured':
      return 'primary'
    case 'reassignment_pending':
      return 'warning'
    case 'disabled':
      return 'danger'
    default:
      return 'neutral'
  }
})
</script>

<template>
  <AppBadge :variant="variant" dot :title="NFC_TAG_STATUS_DESCRIPTIONS[status]">{{ NFC_TAG_STATUS_LABELS[status] }}</AppBadge>
</template>
