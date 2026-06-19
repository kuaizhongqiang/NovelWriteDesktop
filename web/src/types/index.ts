// ============ 小说写作战 — 前端类型定义 ============
// 映射自 Data.cs

export const CURRENT_DATA_VERSION = 1

export interface AllData {
  version: number
  novels: Novel[]
  writingStyles: WritingStyle[]
}

export interface Novel {
  id: string
  title: string
  novelBaseData: NovelBaseData
  roleList: RoleList
  outline: Outline
  chapterList: ChapterList
  writingStyle: WritingStyle
  created: Date
  updated: Date
  isOpen: boolean
}

export interface NovelBaseData {
  description: string
  oneWord: string
  genre: string
  tags: string[]
}

export interface RoleList {
  mainRole: RoleData
  femaleRoles: RoleData[]
  supportingRoles: RoleData[]
}

export interface RoleData {
  roleName: string
  roleDescription: string
  relationshipToMainRole: string
}

export interface Outline {
  mainRoleSuperpower: string
  worldView: string
  writingKeyPoints: string
  outlinePhases: OutlinePhase[]
}

export interface OutlinePhase {
  id: string
  sort: number
  title: string
  description: string
  chapterOutlines: ChapterOutline[]
}

export interface ChapterOutline {
  id: string
  sort: number
  chapterTitle: string
  chapterDescription: string
  hook: string
}

export interface ChapterList {
  chapters: Chapter[]
}

export interface Chapter {
  id: string
  sort: number
  content: string
}

export interface WritingStyle {
  id: string
  name: string
  charPerChapter: { min: number; max: number }
  fullStoryLength: number
  baseTone: string
}

// ============ 辅助函数 ============

export function createId(): string {
  return crypto.randomUUID()
}

export function createDefaultWritingStyle(): WritingStyle {
  return {
    id: createId(),
    name: '默认风格',
    charPerChapter: { min: 1000, max: 3000 },
    fullStoryLength: 100000,
    baseTone: '',
  }
}

export function createDefaultNovel(): Novel {
  const style = createDefaultWritingStyle()
  return {
    id: createId(),
    title: '未命名小说',
    novelBaseData: {
      description: '',
      oneWord: '',
      genre: '',
      tags: [],
    },
    roleList: {
      mainRole: { roleName: '', roleDescription: '', relationshipToMainRole: '自身' },
      femaleRoles: [],
      supportingRoles: [],
    },
    outline: {
      mainRoleSuperpower: '',
      worldView: '',
      writingKeyPoints: '',
      outlinePhases: [],
    },
    chapterList: {
      chapters: [],
    },
    writingStyle: style,
    created: new Date(),
    updated: new Date(),
    isOpen: true,
  }
}

/**
 * 计算小说的总字符数（所有章节 content 长度之和，中文字符计数）
 */
export function calcTotalCharCount(novel: Novel): number {
  return novel.chapterList.chapters.reduce((sum, ch) => sum + ch.content.length, 0)
}

/**
 * 获取小说的章节数量
 */
export function calcChapterCount(novel: Novel): number {
  return novel.chapterList.chapters.length
}

const STORAGE_KEY = 'novelwrite-all-data'

/**
 * 从 localStorage 加载数据（含版本迁移）
 */
export function loadFromStorage(): AllData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AllData

    // 版本 0 → 1: 补充缺失字段
    if (!parsed.version) {
      if (!parsed.writingStyles) parsed.writingStyles = []
      parsed.version = 1
    }

    // 将日期字符串还原为 Date 对象
    parsed.novels.forEach(n => {
      n.created = new Date(n.created)
      n.updated = new Date(n.updated)
    })
    return parsed
  } catch {
    return null
  }
}

/**
 * 保存数据到 localStorage
 */
export function saveToStorage(data: AllData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
