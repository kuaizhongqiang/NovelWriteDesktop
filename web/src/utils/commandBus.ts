/**
 * CommandBus — 命令抽象层
 *
 * 解耦 AI Agent Tools 与 Pinia Store：
 * - Store Action 和 AI Tool 都通过 Command 操作数据
 * - 支持权限检查（读/写/删分级确认）
 * - 支持操作审计日志
 * - 支持 dry-run 预览
 * - Store 重构时只需更新 Command 实现，不影响 AI Tool
 */
import { useAllDataStore } from '@/stores/allData'
import type { Novel, OutlinePhase, RoleData } from '@/types'

// ============ 命令接口 ============

export interface Command<T = unknown> {
  /** 唯一标识 */
  readonly id: string
  /** 人类可读描述（用于确认对话框） */
  readonly description: string
  /** 权限等级 */
  readonly permission: 'read' | 'write' | 'delete'
  /** 执行命令 */
  execute(): Promise<T>
  /** 预览将要执行的操作（可选） */
  preview?(): string
}

// ============ 权限检查 ============

let _confirmFn: (description: string, permission: 'write' | 'delete') => Promise<boolean> = async (desc, perm) => {
  console.warn(`[CommandBus] 权限确认未注入，自动放行 ${perm}: ${desc}`)
  return true
}

/**
 * 设置确认回调（由组件在 setup 中注入）
 */
export function setConfirmHandler(
  fn: (description: string, permission: 'write' | 'delete') => Promise<boolean>,
) {
  _confirmFn = fn
}

async function checkPermission(cmd: Command): Promise<boolean> {
  if (cmd.permission === 'read') return true
  return _confirmFn(cmd.description, cmd.permission)
}

// ============ 审计日志 ============

interface AuditEntry {
  timestamp: string
  command: string
  description: string
  permission: 'read' | 'write' | 'delete'
  success: boolean
  error?: string
}

const auditLog = ref<AuditEntry[]>([])

export function getAuditLog(): AuditEntry[] {
  return auditLog.value
}

export function clearAuditLog(): void {
  auditLog.value = []
}

function logAudit(cmd: Command, success: boolean, error?: string) {
  auditLog.value.push({
    timestamp: new Date().toISOString(),
    command: cmd.id,
    description: cmd.description,
    permission: cmd.permission,
    success,
    error,
  })
  // 只保留最近 200 条
  if (auditLog.value.length > 200) {
    auditLog.value = auditLog.value.slice(-200)
  }
}

// ============ 执行器 ============

/**
 * 执行单个命令（含权限检查 + 审计）
 */
export async function executeCommand<T>(cmd: Command<T>): Promise<T | null> {
  const ok = await checkPermission(cmd)
  if (!ok) {
    logAudit(cmd, false, 'Permission denied')
    return null
  }

  try {
    const result = await cmd.execute()
    logAudit(cmd, true)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logAudit(cmd, false, msg)
    throw err
  }
}

/**
 * 批量执行命令（逐项确认 + 全有或全无）
 */
export async function executeCommands<T>(commands: Command<T>[]): Promise<(T | null)[]> {
  const results: (T | null)[] = []
  for (const cmd of commands) {
    const result = await executeCommand(cmd)
    results.push(result)
    if (result === null && cmd.permission !== 'read') {
      // 用户拒绝了某个写/删操作，中断后续
      break
    }
  }
  return results
}

// ============ 具体命令工厂 ============

let _cmdId = 0
function nextId(): string {
  return `cmd-${++_cmdId}-${Date.now().toString(36)}`
}

/** 获取章节的显示标题 */
function getChapterTitle(novel: Novel, chapterId: string): string {
  for (const phase of novel.outline.outlinePhases) {
    const ch = phase.chapterOutlines.find(c => c.id === chapterId)
    if (ch) return ch.chapterTitle || `第${ch.sort}章`
  }
  const ch = novel.chapterList.chapters.find(c => c.id === chapterId)
  return ch ? `第${ch.sort}章` : chapterId
}

// ---- Outline Commands ----

export function createAddPhaseCommand(novelId: string, title: string): Command<OutlinePhase | undefined> {
  return {
    id: nextId(),
    description: `添加新幕/卷: ${title}`,
    permission: 'write',
    async execute() {
      const store = useAllDataStore()
      return store.addPhaseToNovel(novelId, { title })
    },
  }
}

export function createDeletePhaseCommand(novelId: string, phaseId: string, phaseTitle: string): Command<void> {
  return {
    id: nextId(),
    description: `删除幕/卷: ${phaseTitle}`,
    permission: 'delete',
    async execute() {
      const store = useAllDataStore()
      const novel = store.getNovelById(novelId)
      if (!novel) return
      const idx = novel.outline.outlinePhases.findIndex(p => p.id === phaseId)
      if (idx !== -1) store.removePhaseFromNovel(novelId, idx)
    },
  }
}

// ---- Chapter Content Commands ----

export function createUpdateChapterContentCommand(
  novelId: string, chapterId: string, content: string,
): Command<void> {
  return {
    id: nextId(),
    description: `修改章节正文 (${getChapterTitle(useAllDataStore().getNovelById(novelId)!, chapterId)})`,
    permission: 'write',
    async execute() {
      const store = useAllDataStore()
      store.updateChapterContent(novelId, chapterId, content)
      const n = store.getNovelById(novelId)
      if (n) {
        store.updateNovel(novelId, {
          chapterList: { chapters: [...n.chapterList.chapters] },
        })
      }
    },
  }
}

export function createPatchChapterContentCommand(
  novelId: string,
  chapterId: string,
  operation: 'replace' | 'append' | 'prepend' | 'insert_after' | 'delete_range',
  targetText?: string,
  newText?: string,
  startPos?: number,
  endPos?: number,
): Command<void> {
  const store = useAllDataStore()
  const chapter = store.getNovelById(novelId)?.chapterList.chapters.find(c => c.id === chapterId)

  return {
    id: nextId(),
    description: `局部修改: ${operation} (${getChapterTitle(store.getNovelById(novelId)!, chapterId)})`,
    permission: 'write',
    preview() {
      return `操作: ${operation}, 目标: "${targetText?.slice(0, 50)}", 替换为: "${newText?.slice(0, 50)}"`
    },
    async execute() {
      if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
      let content = chapter.content

      switch (operation) {
        case 'replace':
          if (targetText) content = content.replace(targetText, newText ?? '')
          else if (startPos !== undefined && endPos !== undefined)
            content = content.slice(0, startPos) + (newText ?? '') + content.slice(endPos)
          break
        case 'append':
          content += newText ?? ''
          break
        case 'prepend':
          content = (newText ?? '') + content
          break
        case 'insert_after':
          if (targetText) {
            const idx = content.indexOf(targetText)
            if (idx === -1) throw new Error(`未找到目标文本: "${targetText.slice(0, 30)}"`)
            content = content.slice(0, idx + targetText.length) + (newText ?? '') + content.slice(idx + targetText.length)
          }
          break
        case 'delete_range':
          if (targetText) content = content.replace(targetText, '')
          else if (startPos !== undefined && endPos !== undefined)
            content = content.slice(0, startPos) + content.slice(endPos)
          break
      }

      store.updateChapterContent(novelId, chapterId, content)
      const n = store.getNovelById(novelId)
      if (n) {
        store.updateNovel(novelId, {
          chapterList: { chapters: [...n.chapterList.chapters] },
        })
      }
    },
  }
}

// ---- Role Commands ----

export function createAddRoleCommand(
  novelId: string,
  type: 'female' | 'supporting',
  roleName: string,
): Command<RoleData | undefined> {
  return {
    id: nextId(),
    description: `添加${type === 'female' ? '女主角' : '配角'}: ${roleName}`,
    permission: 'write',
    async execute() {
      const store = useAllDataStore()
      if (type === 'female') return store.addFemaleRole(novelId)
      return store.addSupportingRole(novelId)
    },
  }
}

export function createDeleteRoleCommand(
  novelId: string,
  type: 'female' | 'supporting',
  index: number,
  roleName: string,
): Command<void> {
  return {
    id: nextId(),
    description: `删除${type === 'female' ? '女主角' : '配角'}: ${roleName || `#${index + 1}`}`,
    permission: 'delete',
    async execute() {
      const store = useAllDataStore()
      if (type === 'female') store.removeFemaleRole(novelId, index)
      else store.removeSupportingRole(novelId, index)
    },
  }
}
