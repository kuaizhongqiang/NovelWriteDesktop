<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import AppLayout from '@/layouts/AppLayout.vue'

const { theme } = useTheme()
</script>

<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <AppLayout />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
