/**
 * useNovel — 获取当前路由对应的小说
 *
 * 依赖 Vue Router 的 `:id` 参数，从 Pinia store 中查找小说对象。
 * 必须在 `<router-view>` 内部使用（有 $route.params.id 可读）。
 *
 * @returns {Object}
 * @returns {ComputedRef<string>} novelId - 当前路由中的小说 ID
 * @returns {ComputedRef<Novel | undefined>} novel - 小说完整数据对象
 *
 * @example
 * ```vue
 * <script setup>
 * const { novelId, novel } = useNovel()
 * </script>
 * <template>
 *   <h1>{{ novel?.title }}</h1>
 * </template>
 * ```
 */
import { useRoute } from 'vue-router'
import { useAllDataStore } from '@/stores/allData'

export function useNovel() {
  const route = useRoute()
  const store = useAllDataStore()

  const novelId = computed(() => route.params.id as string)
  const novel = computed(() => store.getNovelById(novelId.value))

  return { novelId, novel }
}
