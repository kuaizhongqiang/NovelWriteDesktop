<script setup lang="ts">
/**
 * 加密解锁对话框
 * 首次使用时设置密码，之后输入密码解锁
 */
import { useAllDataStore } from '@/stores/allData'

const store = useAllDataStore()

const emit = defineEmits<{
  unlocked: []
}>()

const passphrase = ref('')
const confirmPassphrase = ref('')
const loading = ref(false)
const error = ref('')
const mode = ref<'unlock' | 'setup'>('unlock')

const { hasSessionPassphrase, tryRestoreFromSession, unlock } = await import('@/utils/crypto')

// 检查 sessionStorage 是否有缓存密码
const sessionRestored = ref(false)

onMounted(async () => {
  if (hasSessionPassphrase()) {
    const ok = await tryRestoreFromSession()
    if (ok) {
      sessionRestored.value = true
      await store.reloadFromStorage()
      emit('unlocked')
      return
    }
  }

  // 判断是首次设置还是解锁：看 localStorage 是否有加密数据
  const raw = localStorage.getItem('novelwrite-all-data')
  if (raw && raw.startsWith('enc:v1:')) {
    mode.value = 'unlock'
  } else {
    mode.value = 'setup'
  }
})

async function handleSubmit() {
  error.value = ''

  if (!passphrase.value.trim()) {
    error.value = '请输入密码'
    return
  }

  if (mode.value === 'setup') {
    if (passphrase.value.length < 4) {
      error.value = '密码至少 4 个字符'
      return
    }
    if (passphrase.value !== confirmPassphrase.value) {
      error.value = '两次密码输入不一致'
      return
    }
  }

  loading.value = true
  try {
    await unlock(passphrase.value)
    await store.reloadFromStorage()
    emit('unlocked')
  } catch (e) {
    error.value = '密码错误或数据损坏'
    console.error('[UnlockDialog]', e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <n-modal
    :show="!sessionRestored"
    :mask-closable="false"
    :closeable="false"
    preset="card"
    :title="mode === 'setup' ? '🔐 设置加密密码' : '🔐 输入密码解锁'"
    style="max-width: 420px;"
  >
    <p style="margin-bottom: 16px; color: #888; font-size: 13px;">
      <template v-if="mode === 'setup'">
        您的创作数据将使用 AES-GCM 256 位加密存储在浏览器中。
        请设置一个密码，每次打开页面时需输入此密码。
      </template>
      <template v-else>
        该小说数据已加密，请输入密码解锁。
      </template>
    </p>

    <n-form label-placement="top" @submit.prevent="handleSubmit">
      <n-form-item label="密码">
        <n-input
          v-model:value="passphrase"
          type="password"
          show-password-on="click"
          placeholder="输入密码"
          :disabled="loading"
          @keyup.enter="handleSubmit"
        />
      </n-form-item>

      <n-form-item v-if="mode === 'setup'" label="确认密码">
        <n-input
          v-model:value="confirmPassphrase"
          type="password"
          show-password-on="click"
          placeholder="再次输入密码"
          :disabled="loading"
          @keyup.enter="handleSubmit"
        />
      </n-form-item>

      <n-alert v-if="error" type="error" :title="error" closable style="margin-bottom: 12px;" />

      <n-button
        type="primary"
        block
        :loading="loading"
        :disabled="loading"
        @click="handleSubmit"
      >
        {{ mode === 'setup' ? '设置密码并解锁' : '解锁' }}
      </n-button>
    </n-form>

    <template v-if="mode === 'unlock'" #footer>
      <div style="text-align: center;">
        <n-button text size="tiny" @click="mode = 'setup'">
          首次使用？设置新密码
        </n-button>
      </div>
    </template>
  </n-modal>
</template>
