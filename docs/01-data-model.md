# 数据模型

## 来源

由 C# 数据结构定义（`Data.cs`）映射为前端 TypeScript 类型。

## 类型定义

```typescript
// ============ 根级 ============

interface AllData {
  novels: Novel[]
  writingStyles: WritingStyle[]
}

// ============ 小说 ============

interface Novel {
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

interface NovelBaseData {
  description: string       // 简介（长文本，高度可调）
  oneWord: string           // 一句话概括
  genre: string             // 题材
  tags: string[]            // 标签
}

// ============ 角色 ============

interface RoleList {
  mainRole: RoleData
  femaleRoles: RoleData[]
  supportingRoles: RoleData[]
}

interface RoleData {
  roleName: string
  roleDescription: string
  relationshipToMainRole: string
}

// ============ 大纲 ============

interface Outline {
  mainRoleSuperpower: string    // 主角金手指
  worldView: string             // 世界观
  writingKeyPoints: string      // 写作要点
  outlinePhases: OutlinePhase[]
}

interface OutlinePhase {
  id: string
  sort: number          // 排序序号
  title: string
  description: string
  chapterOutlines: ChapterOutline[]
}

interface ChapterOutline {
  id: string
  sort: number
  chapterTitle: string
  chapterDescription: string
  hook: string
}

// ============ 章节 ============

interface ChapterList {
  chapters: Chapter[]
}

interface Chapter {
  id: string
  sort: number
  content: string       // 纯文本，不含任何格式标记
}

// ============ 写作风格 ============

interface WritingStyle {
  id: string
  charPerChapter: { min: number; max: number }   // 每章字数范围
  fullStoryLength: number                         // 全本预计字数
  baseTone: string                                // 基调（如热血、虐心、轻松）
}
```

## 模型关系

```
AllData
└── Novel[]
    ├── novelBaseData         — 基本信息（填空表单）
    ├── roleList              — 角色体系（填空表单）
    │   ├── mainRole          — 固定 1 个，可编辑
    │   ├── femaleRoles[]     — 多个，可增删改
    │   └── supportingRoles[] — 多个，可增删改
    ├── outline               — 大纲（填空表单，手风琴结构）
    │   └── outlinePhases[]
    │       └── chapterOutlines[]
    ├── chapterList            — 正文内容
    │   └── chapters[]
    └── writingStyle          — 风格设定（填空表单）
```
