/**
 * useTheme — 主题管理
 *
 * 同时控制 Naive UI 的 darkTheme 和全局 CSS 变量（通过 `html.dark` class）。
 * 主题偏好存储在 localStorage 中跨会话持久化。
 *
 * **单例模式**: 多个组件同时调用 useTheme 共享同一状态。
 *
 * @returns {Object}
 * @returns {Ref<boolean>} isDark - 当前是否为暗色模式
 * @returns {ComputedRef<BuiltInGlobalTheme | null>} theme - Naive UI theme 对象（暗色/亮色）
 * @returns {Function} toggleTheme - 切换主题
 *
 * @example
 * ```vue
 * <script setup>
 * const { isDark, theme, toggleTheme } = useTheme()
 * </script>
 * <template>
 *   <n-config-provider :theme="theme">
 *     <button @click="toggleTheme">{{ isDark ? '🌙' : '☀️' }}</button>
 *   </n-config-provider>
 * </template>
 * ```
 */
import { darkTheme } from 'naive-ui'
import type { BuiltInGlobalTheme } from 'naive-ui/es/themes/interface'

const STORAGE_KEY = 'novelwrite-theme'

// 单例状态，跨组件共享
const isDark = ref(false)
let initialized = false

export function useTheme() {
  if (!initialized) {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark') {
      isDark.value = true
    }
    // 同步 html.dark class（用于 CSS 变量）
    updateDocumentClass(isDark.value)
    initialized = true
  }

  const theme = computed<BuiltInGlobalTheme | null>(() =>
    isDark.value ? darkTheme : null,
  )

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
    updateDocumentClass(isDark.value)
  }

  return { isDark, theme, toggleTheme }
}

function updateDocumentClass(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
