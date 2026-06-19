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
    initialized = true
  }

  const theme = computed<BuiltInGlobalTheme | null>(() =>
    isDark.value ? darkTheme : null,
  )

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  }

  return { isDark, theme, toggleTheme }
}
