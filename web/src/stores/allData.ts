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

export const useAllDataStore = defineStore('allData', () => {
  // ============ State ============
  const initialData = loadFromStorage() ?? { novels: [] as Novel[], writingStyles: [] as WritingStyle[] }
  // 兼容旧数据：缺少 writingStyles 时补上
  if (!initialData.writingStyles) initialData.writingStyles = []
  const data = ref<AllData>(initialData)

  // ============ Persistence ============
  watch(
    data,
    (val: AllData) => {
      saveToStorage(val)
    },
    { deep: true },
  )

  // ============ Getters ============
  function getNovelById(id: string): Novel | undefined {
    return data.value.novels.find((n: Novel) => n.id === id)
  }

  const novelCount = computed(() => data.value.novels.length)

  // ============ Novel Actions ============
  function addNovel(): Novel {
    // 确保至少有一个预设
    if (data.value.writingStyles.length === 0) {
      data.value.writingStyles.push(createDefaultWritingStyle())
    }
    const novel = createDefaultNovel()
    // 将第一部小说的风格关联到第一个预设
    novel.writingStyle = { ...data.value.writingStyles[0] }
    data.value.novels.push(novel)
    return novel
  }

  function deleteNovel(id: string): void {
    const idx = data.value.novels.findIndex((n: Novel) => n.id === id)
    if (idx !== -1) {
      data.value.novels.splice(idx, 1)
    }
  }

  function updateNovel(id: string, partial: Partial<Novel>): void {
    const novel = data.value.novels.find((n: Novel) => n.id === id)
    if (novel) {
      Object.assign(novel, partial, { updated: new Date() })
    }
  }

  function saveNow(): void {
    saveToStorage(data.value)
  }

  // ============ Writing Style Preset Actions ============

  /** 新建预设 */
  function addWritingStylePreset(style?: WritingStyle): WritingStyle {
    const preset = style ?? createDefaultWritingStyle()
    data.value.writingStyles.push(preset)
    return preset
  }

  /** 删除预设 */
  function deleteWritingStylePreset(id: string): void {
    data.value.writingStyles = data.value.writingStyles.filter(s => s.id !== id)
  }

  /** 更新预设 */
  function updateWritingStylePreset(id: string, partial: Partial<WritingStyle>): void {
    const preset = data.value.writingStyles.find(s => s.id === id)
    if (preset) {
      Object.assign(preset, partial)
    }
  }

  /** 将小说的风格关联到指定预设（复制预设值到小说） */
  function applyPresetToNovel(novelId: string, presetId: string): void {
    const preset = data.value.writingStyles.find(s => s.id === presetId)
    const novel = getNovelById(novelId)
    if (preset && novel) {
      novel.writingStyle = { ...preset }
      novel.updated = new Date()
    }
  }

  return {
    data,
    getNovelById,
    novelCount,
    addNovel,
    deleteNovel,
    updateNovel,
    saveNow,
    // preset 管理
    addWritingStylePreset,
    deleteWritingStylePreset,
    updateWritingStylePreset,
    applyPresetToNovel,
  }
})
