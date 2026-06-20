<script setup lang="ts">
import { useRouter } from 'vue-router'
import { authApi, checkAuthStatus } from '@/api'

const router = useRouter()
const message = useMessage()

const password = ref('')
const loading = ref(false)

onMounted(async () => {
  const loggedIn = await checkAuthStatus()
  if (loggedIn) router.push('/')
})

async function handleLogin() {
  const pwd = password.value.trim()
  if (!pwd) {
    message.warning('请输入密码')
    return
  }

  loading.value = true
  try {
    await authApi.login(pwd)
    message.success('登录成功')
    router.push('/')
  } catch {
    message.error('密码错误')
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
        <div style="font-size: 13px; color: var(--nw-text-muted); margin-top: 4px;">输入密码开始写作</div>
      </div>

      <n-form label-placement="top" @submit.prevent="handleLogin">
        <n-form-item label="密码">
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="请输入管理员密码"
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
        <p>首次运行服务端时会在控制台输出初始密码</p>
      </div>
    </n-card>
  </div>
</template>
