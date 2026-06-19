import { useRoute } from 'vue-router'
import { useAllDataStore } from '@/stores/allData'

export function useNovel() {
  const route = useRoute()
  const store = useAllDataStore()

  const novelId = computed(() => route.params.id as string)
  const novel = computed(() => store.getNovelById(novelId.value))

  return { novelId, novel }
}
