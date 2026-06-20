<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import { useAllDataStore } from '@/stores/allData'
import AppLayout from '@/layouts/AppLayout.vue'
import UnlockDialog from '@/components/UnlockDialog.vue'

const { theme } = useTheme()
const store = useAllDataStore()

const ready = ref(false)
const unlocked = ref(false)

onMounted(async () => {
  const { hasSessionPassphrase, tryRestoreFromSession } = await import('@/utils/crypto')

  // 尝试从 session 恢复密钥
  if (hasSessionPassphrase()) {
    const ok = await tryRestoreFromSession()
    if (ok) unlocked.value = true
  }

  // 加载数据（如果是明文存储或已解锁）
  await store.init()
  ready.value = true
})

function onUnlocked() {
  unlocked.value = true
}
</script>

<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <!-- 解锁对话框 -->
          <UnlockDialog
            v-if="ready && !unlocked"
            @unlocked="onUnlocked"
          />

          <!-- 主应用 -->
          <AppLayout v-if="ready" />

          <!-- 加载中 -->
          <div
            v-if="!ready"
            style="height: 100vh; display: flex; align-items: center; justify-content: center;"
          >
            <n-spin size="large" />
          </div>
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
