import { defineStore } from 'pinia'
import {
  type AllData,
  type Novel,
  type WritingStyle,
  createDefaultNovel,
  createDefaultWritingStyle,
  loadFromStorage,
  saveToStorage,
} from '@/types'
import { novelsApi, writingStylesApi, isLoggedIn } from '@/api'

export const useAllDataStore = defineStore('allData', () => {
  // ============ State ============
  const initialData = loadFromStorage() ?? { version: 1, novels: [] as Novel[], writingStyles: [] as WritingStyle[] }
  const data = ref<AllData>(initialData)

  const syncEnabled = ref(isLoggedIn())

  // ============ Persistence (debounced) ============
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    data,
    (val: AllData) => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveToStorage(val)
        saveTimer = null
      }, 500)
    },
    { deep: true },
  )

  // ============ Helpers ============

  /** 后端同步（静默失败，不阻塞用户操作） */
  async function syncToServer(fn: () => Promise<any>): Promise<void> {
    if (!syncEnabled.value) return
    try {
      await fn()
    } catch {
      // 静默失败——前端继续使用 localStorage
    }
  }

  // ============ Getters ============
  function getNovelById(id: string): Novel | undefined {
    return data.value.novels.find((n: Novel) => n.id === id)
  }

  const novelCount = computed(() => data.value.novels.length)

  // ============ Novel Actions ============
  function addNovel(): Novel {
    if (data.value.writingStyles.length === 0) {
      data.value.writingStyles.push(createDefaultWritingStyle())
    }
    const novel = createDefaultNovel()
    novel.writingStyle = { ...data.value.writingStyles[0] }
    data.value.novels.push(novel)
    syncToServer(() => novelsApi.create(novel))
    return novel
  }

  function deleteNovel(id: string): void {
    const idx = data.value.novels.findIndex((n: Novel) => n.id === id)
    if (idx !== -1) {
      data.value.novels.splice(idx, 1)
    }
    syncToServer(() => novelsApi.delete(id))
  }

  function updateNovel(id: string, partial: Partial<Novel>): void {
    const novel = data.value.novels.find((n: Novel) => n.id === id)
    if (novel) {
      Object.assign(novel, partial, { updated: new Date() })
    }
    syncToServer(() => novelsApi.update(id, partial))
  }

  function saveNow(): void {
    saveToStorage(data.value)
  }

  // ============ Writing Style Preset Actions ============

  function addWritingStylePreset(style?: WritingStyle): WritingStyle {
    const preset = style ?? createDefaultWritingStyle()
    data.value.writingStyles.push(preset)
    syncToServer(() => writingStylesApi.create(preset))
    return preset
  }

  function deleteWritingStylePreset(id: string): void {
    data.value.writingStyles = data.value.writingStyles.filter(s => s.id !== id)
    syncToServer(() => writingStylesApi.delete(id))
  }

  function updateWritingStylePreset(id: string, partial: Partial<WritingStyle>): void {
    const preset = data.value.writingStyles.find(s => s.id === id)
    if (preset) {
      Object.assign(preset, partial)
    }
    syncToServer(() => writingStylesApi.update(id, partial))
  }

  function applyPresetToNovel(novelId: string, presetId: string): void {
    const preset = data.value.writingStyles.find(s => s.id === presetId)
    const novel = getNovelById(novelId)
    if (preset && novel) {
      novel.writingStyle = { ...preset }
      novel.updated = new Date()
    }
  }

  /** 切换后端同步状态 */
  function setSyncEnabled(enabled: boolean): void {
    syncEnabled.value = enabled
  }

  return {
    data,
    syncEnabled,
    getNovelById,
    novelCount,
    addNovel,
    deleteNovel,
    updateNovel,
    saveNow,
    addWritingStylePreset,
    deleteWritingStylePreset,
    updateWritingStylePreset,
    applyPresetToNovel,
    setSyncEnabled,
  }
})
