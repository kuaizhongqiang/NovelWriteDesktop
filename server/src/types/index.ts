// ============ 服务端类型定义 ============
// 映射自 Data.cs / web/src/types/index.ts
// 与服务端交互时使用 ISO 字符串代替 Date 对象

export interface AllData {
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
  created: string   // ISO 8601
  updated: string   // ISO 8601
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

// ============ Auth ============

export interface AuthKey {
  id: string
  name: string
  keyHash: string
  createdAt: string
  lastUsedAt: string | null
  revoked: boolean
}

// ============ 辅助函数 ============

export function createId(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
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

export function createDefaultNovel(): Omit<Novel, 'id' | 'created' | 'updated'> {
  const style = createDefaultWritingStyle()
  return {
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
    isOpen: true,
  }
}

// ============ API 响应类型 ============

export interface ApiError {
  error: string
  details?: string
}

export interface NovelSummary {
  id: string
  title: string
  created: string
  updated: string
  isOpen: boolean
}
