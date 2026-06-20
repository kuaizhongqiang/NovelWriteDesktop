/**
 * AI Tool Calling 执行引擎
 *
 * 将 DeepSeek 返回的 tool_call 映射到数据库操作。
 * 所有操作使用参数化查询。
 */
import { getDb } from '../db/index.js'
import { queryFirst, execute } from '../db/query.js'
import { createId, nowISO } from '../types/index.js'
import type { ToolDefinition, ToolCall } from './types.js'

// ============ 工具定义 ============

const NOVEL_FIELDS = ['title', 'novel_base_data', 'role_list', 'outline', 'chapter_list', 'writing_style', 'is_open'] as const

function getNovelJSON(novelId: string, field: string): Record<string, unknown> {
  const row = queryFirst<{ [key: string]: string }>(`SELECT ${field} FROM novels WHERE id = ?`, [novelId])
  if (!row) throw new Error('Novel not found')
  return JSON.parse(row[field] || '{}')
}

function patchNovelJSON(novelId: string, field: string, mutator: (data: any) => any): void {
  const db = getDb()
  db.run('BEGIN')
  try {
    const stmt = db.prepare(`SELECT ${field} FROM novels WHERE id = ?`)
    stmt.bind([novelId])
    if (!stmt.step()) {
      stmt.free()
      db.run('ROLLBACK')
      throw new Error('Novel not found')
    }
    const row = stmt.getAsObject() as Record<string, string>
    stmt.free()
    const current = JSON.parse(row[field] || '{}')
    const updated = mutator(current)
    db.run(`UPDATE novels SET ${field} = ?, updated = ? WHERE id = ?`, [
      JSON.stringify(updated), nowISO(), novelId,
    ])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}

// ============ 工具注册表 ============

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

const toolRegistry = new Map<string, RegisteredTool>()

function register(name: string, description: string, parameters: ToolDefinition['parameters'], handler: ToolHandler) {
  toolRegistry.set(name, {
    definition: { name, description, parameters },
    handler,
  })
}

// ============ Novel Tools ============

register('get_novel', '获取小说完整数据', {
  type: 'object',
  properties: {
    novelId: { type: 'string', description: '小说 ID' },
  },
  required: ['novelId'],
}, async (args) => {
  const row = queryFirst('SELECT * FROM novels WHERE id = ?', [args.novelId])
  if (!row) throw new Error('Novel not found')
  return row
})

register('update_novel_base', '更新小说基础设定（只传需要修改的字段）', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    title: { type: 'string', description: '新标题' },
    genre: { type: 'string', description: '题材' },
    tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
    description: { type: 'string', description: '简介' },
    oneWord: { type: 'string', description: '一句话概括' },
  },
  required: ['novelId'],
}, async (args) => {
  const { novelId, ...fields } = args
  const existing = getNovelJSON(novelId as string, 'novel_base_data')
  Object.assign(existing, fields)
  patchNovelJSON(novelId as string, 'novel_base_data', () => existing)
  return { updated: true }
})

// ============ Role Tools ============

register('get_roles', '获取角色列表', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
  },
  required: ['novelId'],
}, async (args) => {
  return getNovelJSON(args.novelId as string, 'role_list')
})

register('add_role', '添加角色', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    type: { type: 'string', enum: ['main', 'female', 'supporting'] },
    roleName: { type: 'string' },
    roleDescription: { type: 'string' },
    relationshipToMainRole: { type: 'string' },
  },
  required: ['novelId', 'type', 'roleName'],
}, async (args) => {
  const role = {
    roleName: args.roleName,
    roleDescription: args.roleDescription || '',
    relationshipToMainRole: args.relationshipToMainRole || '',
  }
  patchNovelJSON(args.novelId as string, 'role_list', (rl: any) => {
    if (args.type === 'main') rl.mainRole = role
    else if (args.type === 'female') rl.femaleRoles.push(role)
    else rl.supportingRoles.push(role)
    return rl
  })
  return { added: args.type, roleName: args.roleName }
})

register('update_role', '更新角色（用 roleName 定位，只传需要改的字段）', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    roleName: { type: 'string', description: '当前角色名（用于定位）' },
    newName: { type: 'string', description: '新名称' },
    roleDescription: { type: 'string' },
    relationshipToMainRole: { type: 'string' },
  },
  required: ['novelId', 'roleName'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'role_list', (rl: any) => {
    const allRoles = [rl.mainRole, ...rl.femaleRoles, ...rl.supportingRoles]
    const target = allRoles.find((r: any) => r.roleName === args.roleName)
    if (!target) throw new Error('Role not found')
    if (args.newName) target.roleName = args.newName
    if (args.roleDescription) target.roleDescription = args.roleDescription
    if (args.relationshipToMainRole) target.relationshipToMainRole = args.relationshipToMainRole
    return rl
  })
  return { updated: true }
})

register('delete_role', '删除角色（用 roleName 定位）', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    roleName: { type: 'string', description: '要删除的角色名' },
  },
  required: ['novelId', 'roleName'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'role_list', (rl: any) => {
    if (rl.mainRole.roleName === args.roleName) throw new Error('Cannot delete main role')
    rl.femaleRoles = rl.femaleRoles.filter((r: any) => r.roleName !== args.roleName)
    rl.supportingRoles = rl.supportingRoles.filter((r: any) => r.roleName !== args.roleName)
    return rl
  })
  return { deleted: args.roleName }
})

// ============ Outline Tools ============

register('get_outline', '获取完整大纲', {
  type: 'object',
  properties: { novelId: { type: 'string' } },
  required: ['novelId'],
}, async (args) => {
  return getNovelJSON(args.novelId as string, 'outline')
})

register('add_phase', '添加幕/卷', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    title: { type: 'string', description: '幕/卷标题' },
  },
  required: ['novelId', 'title'],
}, async (args) => {
  let phaseId = ''
  patchNovelJSON(args.novelId as string, 'outline', (ol: any) => {
    phaseId = createId()
    ol.outlinePhases.push({ id: phaseId, sort: ol.outlinePhases.length + 1, title: args.title, description: '', chapterOutlines: [] })
    return ol
  })
  return { id: phaseId, title: args.title }
})

register('update_phase', '更新幕/卷', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    phaseId: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['novelId', 'phaseId'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'outline', (ol: any) => {
    const phase = ol.outlinePhases.find((p: any) => p.id === args.phaseId)
    if (!phase) throw new Error('Phase not found')
    if (args.title) phase.title = args.title
    if (args.description) phase.description = args.description
    return ol
  })
  return { updated: args.phaseId }
})

register('delete_phase', '删除幕/卷', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    phaseId: { type: 'string' },
  },
  required: ['novelId', 'phaseId'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'outline', (ol: any) => {
    ol.outlinePhases = ol.outlinePhases.filter((p: any) => p.id !== args.phaseId)
    ol.outlinePhases.forEach((p: any, i: number) => { p.sort = i + 1 })
    return ol
  })
  return { deleted: args.phaseId }
})

// ============ Chapter Outline Tools ============

register('add_chapter_outline', '添加章节大纲到指定幕/卷', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    phaseId: { type: 'string' },
    chapterTitle: { type: 'string' },
  },
  required: ['novelId', 'phaseId', 'chapterTitle'],
}, async (args) => {
  let chId = ''
  patchNovelJSON(args.novelId as string, 'outline', (ol: any) => {
    const phase = ol.outlinePhases.find((p: any) => p.id === args.phaseId)
    if (!phase) throw new Error('Phase not found')
    chId = createId()
    phase.chapterOutlines.push({ id: chId, sort: phase.chapterOutlines.length + 1, chapterTitle: args.chapterTitle, chapterDescription: '', hook: '' })
    return ol
  })
  return { id: chId }
})

register('update_chapter_outline', '更新章节大纲', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    chapterOutlineId: { type: 'string' },
    chapterTitle: { type: 'string' },
    chapterDescription: { type: 'string' },
    hook: { type: 'string' },
  },
  required: ['novelId', 'chapterOutlineId'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'outline', (ol: any) => {
    for (const p of ol.outlinePhases) {
      const target = p.chapterOutlines.find((c: any) => c.id === args.chapterOutlineId)
      if (target) {
        if (args.chapterTitle) target.chapterTitle = args.chapterTitle
        if (args.chapterDescription) target.chapterDescription = args.chapterDescription
        if (args.hook) target.hook = args.hook
        return ol
      }
    }
    throw new Error('Chapter outline not found')
  })
  return { updated: args.chapterOutlineId }
})

register('delete_chapter_outline', '删除章节大纲', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    chapterOutlineId: { type: 'string' },
  },
  required: ['novelId', 'chapterOutlineId'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'outline', (ol: any) => {
    let found = false
    for (const p of ol.outlinePhases) {
      const before = p.chapterOutlines.length
      p.chapterOutlines = p.chapterOutlines.filter((c: any) => c.id !== args.chapterOutlineId)
      p.chapterOutlines.forEach((c: any, i: number) => { c.sort = i + 1 })
      if (p.chapterOutlines.length < before) found = true
    }
    if (!found) throw new Error('Chapter outline not found')
    return ol
  })
  return { deleted: args.chapterOutlineId }
})

// ============ Chapter Content Tools ============

register('get_chapter', '获取章节正文', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    chapterId: { type: 'string' },
  },
  required: ['novelId', 'chapterId'],
}, async (args) => {
  const cl = getNovelJSON(args.novelId as string, 'chapter_list')
  const ch = (cl.chapters as any[])?.find((c: any) => c.id === args.chapterId)
  if (!ch) throw new Error('Chapter not found')
  return ch
})

register('patch_chapter_content', '局部修改章节正文（优先用 operation，而非全量重写）', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    chapterId: { type: 'string' },
    operation: { type: 'string', enum: ['replace', 'append', 'prepend', 'insert_after', 'delete_range'] },
    targetText: { type: 'string', description: '定位文本' },
    newText: { type: 'string', description: '替换/插入的新文本' },
    startPos: { type: 'integer', description: '起始位置' },
    endPos: { type: 'integer', description: '结束位置' },
  },
  required: ['novelId', 'chapterId', 'operation'],
}, async (args) => {
  let resultLength = 0
  patchNovelJSON(args.novelId as string, 'chapter_list', (cl: any) => {
    const ch = cl.chapters.find((c: any) => c.id === args.chapterId)
    if (!ch) throw new Error('Chapter not found')
    switch (args.operation) {
      case 'replace':
        if (args.targetText) ch.content = ch.content.replace(args.targetText, args.newText ?? '')
        else if (args.startPos !== undefined && args.endPos !== undefined)
          ch.content = ch.content.slice(0, args.startPos) + (args.newText ?? '') + ch.content.slice(args.endPos)
        break
      case 'append': ch.content += String(args.newText ?? ''); break
      case 'prepend': ch.content = String(args.newText ?? '') + ch.content; break
      case 'insert_after':
        if (!args.targetText) throw new Error('insert_after 需要 targetText')
        ch.content = ch.content.replace(String(args.targetText), String(args.targetText) + String(args.newText ?? ''))
        break
      case 'delete_range':
        if (args.targetText) ch.content = ch.content.replace(args.targetText, '')
        else if (args.startPos !== undefined && args.endPos !== undefined)
          ch.content = ch.content.slice(0, args.startPos) + ch.content.slice(args.endPos)
        break
    }
    resultLength = ch.content.length
    return cl
  })
  return { updated: args.chapterId, length: resultLength }
})

register('replace_chapter_content', '全量替换章节正文（谨慎使用，优先用 patch_chapter_content）', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    chapterId: { type: 'string' },
    content: { type: 'string', description: '完整内容' },
  },
  required: ['novelId', 'chapterId', 'content'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'chapter_list', (cl: any) => {
    const ch = cl.chapters.find((c: any) => c.id === args.chapterId)
    if (!ch) throw new Error('Chapter not found')
    ch.content = args.content
    return cl
  })
  return { replaced: args.chapterId, length: (args.content as string).length }
})

// ============ Writing Style Tools ============

register('get_writing_style', '获取小说当前写作风格', {
  type: 'object',
  properties: { novelId: { type: 'string' } },
  required: ['novelId'],
}, async (args) => {
  return getNovelJSON(args.novelId as string, 'writing_style')
})

register('update_writing_style', '更新写作风格', {
  type: 'object',
  properties: {
    novelId: { type: 'string' },
    charPerChapterMin: { type: 'integer' },
    charPerChapterMax: { type: 'integer' },
    fullStoryLength: { type: 'integer' },
    baseTone: { type: 'string' },
  },
  required: ['novelId'],
}, async (args) => {
  patchNovelJSON(args.novelId as string, 'writing_style', (ws: any) => {
    if (args.charPerChapterMin !== undefined) ws.charPerChapter.min = args.charPerChapterMin
    if (args.charPerChapterMax !== undefined) ws.charPerChapter.max = args.charPerChapterMax
    if (args.fullStoryLength) ws.fullStoryLength = args.fullStoryLength
    if (args.baseTone) ws.baseTone = args.baseTone
    return ws
  })
  return { updated: true }
})

// ============ 公开 API ============

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(toolRegistry.values()).map(r => r.definition)
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return getToolDefinitions()
}

export async function executeToolCall(toolCall: ToolCall): Promise<unknown> {
  const { name, arguments: argsStr } = toolCall.function
  const tool = toolRegistry.get(name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)

  const args = JSON.parse(argsStr)
  return tool.handler(args)
}
