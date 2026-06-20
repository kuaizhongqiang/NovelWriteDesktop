<script setup lang="ts">
import { useRouter } from 'vue-router'
import { setStoredToken, isLoggedIn, authApi } from '@/api'

const router = useRouter()
const message = useMessage()

const apiKey = ref('')
const loading = ref(false)

// 如果已有 Key，自动跳转
onMounted(() => {
  if (isLoggedIn()) {
    router.push('/')
  }
})

async function handleLogin() {
  const key = apiKey.value.trim()
  if (!key) {
    message.warning('请输入 API Key')
    return
  }

  loading.value = true
  try {
    const res = await authApi.login(key)
    setStoredToken(key)
    message.success(`欢迎回来，${res.name}！`)
    router.push('/')
  } catch (err) {
    message.error('API Key 无效，请检查后重试')
  } finally {
    loading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleLogin()
}
</script>

<template>
  <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--nw-bg-secondary);">
    <n-card style="width: 400px; max-width: 90vw;" :bordered="true">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">📖</div>
        <div style="font-size: 20px; font-weight: 700;">NovelWrite</div>
        <div style="font-size: 13px; color: var(--nw-text-muted); margin-top: 4px;">输入 API Key 开始写作</div>
      </div>

      <n-form label-placement="top" @submit.prevent="handleLogin">
        <n-form-item label="API Key">
          <n-input
            v-model:value="apiKey"
            type="password"
            show-password-on="click"
            placeholder="请输入 nw_ 开头的 API Key"
            :disabled="loading"
            @keydown="handleKeydown"
          />
        </n-form-item>

        <n-button
          type="primary"
          block
          :loading="loading"
          :disabled="loading"
          @click="handleLogin"
        >
          登录
        </n-button>
      </n-form>

      <div style="margin-top: 16px; font-size: 12px; color: var(--nw-text-light); text-align: center;">
        <p>首次使用？在服务端运行以下命令生成 Key：</p>
        <n-code style="display: block; margin-top: 4px; font-size: 11px;">
          novelwrite auth generate my-key
        </n-code>
      </div>
    </n-card>
  </div>
</template>
