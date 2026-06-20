/**
 * useChapterTree — 章节树逻辑
 *
 * 统一 OutlineTree 和 TocPanel 中重复的"将大纲阶段章节与实际章节合并"逻辑。
 * 提供按阶段分组的树状结构和扁平的排序列表两种视图。
 */
import type { Novel } from '@/types'

export interface ChapterTreeNode {
  id: string
  sort: number
  title: string
  phaseTitle: string
  phaseId: string
  wordCount: number
}

/**
 * 收集所有已分配到大纲阶段中的章节 ID
 */
export function getPhaseChapterIds(novel: Novel): Set<string> {
  const ids = new Set<string>()
  for (const phase of novel.outline.outlinePhases) {
    for (const ch of phase.chapterOutlines) {
      ids.add(ch.id)
    }
  }
  return ids
}

/**
 * 获取章节的显示标题（优先从大纲取，其次 fallback 为"第N章"）
 */
export function getChapterTitle(novel: Novel, chapterId: string): string {
  for (const phase of novel.outline.outlinePhases) {
    const outlineCh = phase.chapterOutlines.find(co => co.id === chapterId)
    if (outlineCh) return outlineCh.chapterTitle || `第${outlineCh.sort}章`
  }
  const ch = novel.chapterList.chapters.find(c => c.id === chapterId)
  return ch ? `第${ch.sort}章` : ''
}

/**
 * 不在任何大纲阶段中的章节列表（用于"其他章节"）
 */
export function getChaptersNotInPhase(novel: Novel): { id: string; sort: number; content: string }[] {
  const phaseIds = getPhaseChapterIds(novel)
  return novel.chapterList.chapters.filter(ch => !phaseIds.has(ch.id))
}

/**
 * 扁平的完整章节树节点列表（按 sort 排序）
 * 同时包含大纲阶段中的章节和未分配的章节
 */
export function getFlatChapterTree(novel: Novel): ChapterTreeNode[] {
  const result: ChapterTreeNode[] = []
  const phaseIds = getPhaseChapterIds(novel)

  for (const phase of novel.outline.outlinePhases) {
    for (const ch of phase.chapterOutlines) {
      result.push({
        id: ch.id,
        sort: ch.sort,
        title: ch.chapterTitle || `第${ch.sort}章`,
        phaseTitle: phase.title,
        phaseId: phase.id,
        wordCount: getChapterWordCount(novel, ch.id),
      })
    }
  }

  for (const ch of novel.chapterList.chapters) {
    if (!phaseIds.has(ch.id)) {
      result.push({
        id: ch.id,
        sort: ch.sort,
        title: `第${ch.sort}章`,
        phaseTitle: '',
        phaseId: '',
        wordCount: ch.content.length,
      })
    }
  }

  result.sort((a, b) => a.sort - b.sort)
  return result
}

function getChapterWordCount(novel: Novel, chapterId: string): number {
  const ch = novel.chapterList.chapters.find(c => c.id === chapterId)
  return ch ? ch.content.length : 0
}
