import { defineStore } from 'pinia'
import {
  type AllData,
  type Novel,
  type WritingStyle,
  type OutlinePhase,
  type ChapterOutline,
  type RoleData,
  type Chapter,
  createDefaultNovel,
  createDefaultWritingStyle,
  createId,
} from '@/types'
import { novelsApi, writingStylesApi, isLoggedIn } from '@/api'
import { getAdapter } from '@/api/storage'

export const useAllDataStore = defineStore('allData', () => {
  // ============ State ============
  const data = ref<AllData>({ version: 1, novels: [], writingStyles: [] })
  const loaded = ref(false)
  const syncEnabled = ref(isLoggedIn())

  // ============ 初始化（异步加载） ============
  async function init(): Promise<void> {
    if (loaded.value) return
    const adapter = getAdapter()
    const stored = await adapter.loadAllData()
    if (stored) {
      data.value = stored
    }
    loaded.value = true
  }

  // ============ Persistence (debounced, async) ============
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    data,
    (val: AllData) => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        getAdapter().saveAllData(val)
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

  async function saveNow(): Promise<void> {
    await getAdapter().saveAllData(data.value)
  }

  // ============ Outline Actions ============

  /** 更新大纲顶层字段 */
  function updateOutlineField(novelId: string, field: 'mainRoleSuperpower' | 'worldView' | 'writingKeyPoints', value: string): void {
    const novel = getNovelById(novelId)
    if (novel) {
      novel.outline[field] = value
      novel.updated = new Date()
    }
  }

  /** 添加大纲阶段（幕/卷） */
  function addPhaseToNovel(novelId: string, phase?: Partial<OutlinePhase>): OutlinePhase | undefined {
    const novel = getNovelById(novelId)
    if (!novel) return undefined
    const newPhase: OutlinePhase = {
      id: createId(),
      sort: novel.outline.outlinePhases.length + 1,
      title: '',
      description: '',
      chapterOutlines: [],
      ...phase,
    }
    novel.outline.outlinePhases.push(newPhase)
    novel.updated = new Date()
    return newPhase
  }

  /** 删除大纲阶段 */
  function removePhaseFromNovel(novelId: string, index: number): void {
    const novel = getNovelById(novelId)
    if (!novel) return
    novel.outline.outlinePhases.splice(index, 1)
    novel.outline.outlinePhases.forEach((p, i) => { p.sort = i + 1 })
    novel.updated = new Date()
  }

  /** 更新阶段字段 */
  function updatePhase(novelId: string, phaseId: string, partial: Partial<OutlinePhase>): void {
    const novel = getNovelById(novelId)
    if (!novel) return
    const phase = novel.outline.outlinePhases.find(p => p.id === phaseId)
    if (phase) {
      Object.assign(phase, partial)
      novel.updated = new Date()
    }
  }

  /** 添加章节大纲到阶段 */
  function addChapterOutlineToPhase(novelId: string, phaseId: string, ch?: Partial<ChapterOutline>): ChapterOutline | undefined {
    const novel = getNovelById(novelId)
    if (!novel) return undefined
    const phase = novel.outline.outlinePhases.find(p => p.id === phaseId)
    if (!phase) return undefined
    const newCh: ChapterOutline = {
      id: createId(),
      sort: phase.chapterOutlines.length + 1,
      chapterTitle: '',
      chapterDescription: '',
      hook: '',
      ...ch,
    }
    phase.chapterOutlines.push(newCh)
    novel.updated = new Date()
    return newCh
  }

  /** 删除章节大纲 */
  function removeChapterOutlineFromPhase(novelId: string, phaseId: string, index: number): void {
    const novel = getNovelById(novelId)
    if (!novel) return
    const phase = novel.outline.outlinePhases.find(p => p.id === phaseId)
    if (!phase) return
    phase.chapterOutlines.splice(index, 1)
    phase.chapterOutlines.forEach((ch, i) => { ch.sort = i + 1 })
    novel.updated = new Date()
  }

  /** 更新章节大纲字段 */
  function updateChapterOutline(novelId: string, phaseId: string, chId: string, partial: Partial<ChapterOutline>): void {
    const novel = getNovelById(novelId)
    if (!novel) return
    for (const phase of novel.outline.outlinePhases) {
      if (phase.id === phaseId) {
        const ch = phase.chapterOutlines.find(c => c.id === chId)
        if (ch) {
          Object.assign(ch, partial)
          novel.updated = new Date()
        }
        return
      }
    }
  }

  // ============ Role Actions ============

  /** 更新主角数据 */
  function updateMainRole(novelId: string, data: Partial<RoleData>): void {
    const novel = getNovelById(novelId)
    if (novel) {
      Object.assign(novel.roleList.mainRole, data)
      novel.updated = new Date()
    }
  }

  /** 添加女角色 */
  function addFemaleRole(novelId: string): RoleData | undefined {
    const novel = getNovelById(novelId)
    if (!novel) return undefined
    const role: RoleData = { roleName: '', roleDescription: '', relationshipToMainRole: '' }
    novel.roleList.femaleRoles.push(role)
    novel.updated = new Date()
    return role
  }

  /** 删除女角色 */
  function removeFemaleRole(novelId: string, index: number): void {
    const novel = getNovelById(novelId)
    if (!novel) return
    novel.roleList.femaleRoles.splice(index, 1)
    novel.updated = new Date()
  }

  /** 添加配角 */
  function addSupportingRole(novelId: string): RoleData | undefined {
    const novel = getNovelById(novelId)
    if (!novel) return undefined
    const role: RoleData = { roleName: '', roleDescription: '', relationshipToMainRole: '' }
    novel.roleList.supportingRoles.push(role)
    novel.updated = new Date()
    return role
  }

  /** 删除配角 */
  function removeSupportingRole(novelId: string, index: number): void {
    const novel = getNovelById(novelId)
    if (!novel) return
    novel.roleList.supportingRoles.splice(index, 1)
    novel.updated = new Date()
  }

  // ============ Chapter Actions ============

  /** 添加章节（如 ID 与大纲对应，则从大纲继承序号） */
  function addChapterToNovel(novelId: string, chapterId: string): Chapter | undefined {
    const novel = getNovelById(novelId)
    if (!novel) return undefined
    if (novel.chapterList.chapters.find(c => c.id === chapterId)) return undefined

    // 从大纲查找序号
    let sort = novel.chapterList.chapters.length + 1
    for (const phase of novel.outline.outlinePhases) {
      const outlineCh = phase.chapterOutlines.find(co => co.id === chapterId)
      if (outlineCh) {
        sort = outlineCh.sort
        break
      }
    }

    const ch: Chapter = { id: chapterId, sort, content: '' }
    novel.chapterList.chapters.push(ch)
    novel.chapterList.chapters.sort((a, b) => a.sort - b.sort)
    novel.updated = new Date()
    return ch
  }

  /** 更新章节内容 */
  function updateChapterContent(novelId: string, chapterId: string, content: string): void {
    const novel = getNovelById(novelId)
    if (!novel) return
    const ch = novel.chapterList.chapters.find(c => c.id === chapterId)
    if (ch) {
      ch.content = content
    }
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

  /** 强制重新加载数据（解锁后调用） */
  async function reloadFromStorage(): Promise<void> {
    const stored = await getAdapter().loadAllData()
    if (stored) {
      data.value = stored
    }
  }

  return {
    data,
    loaded,
    syncEnabled,
    init,
    getNovelById,
    novelCount,
    addNovel,
    deleteNovel,
    updateNovel,
    saveNow,
    // Outline
    updateOutlineField,
    addPhaseToNovel,
    removePhaseFromNovel,
    updatePhase,
    addChapterOutlineToPhase,
    removeChapterOutlineFromPhase,
    updateChapterOutline,
    // Roles
    updateMainRole,
    addFemaleRole,
    removeFemaleRole,
    addSupportingRole,
    removeSupportingRole,
    // Chapters
    addChapterToNovel,
    updateChapterContent,
    // Writing Styles
    addWritingStylePreset,
    deleteWritingStylePreset,
    updateWritingStylePreset,
    applyPresetToNovel,
    setSyncEnabled,
    reloadFromStorage,
  }
})
