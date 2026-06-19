<script setup lang="ts">
import { useNovel } from '@/composables/useNovel'
import { useAllDataStore } from '@/stores/allData'
import type { Chapter } from '@/types'
import OutlineTree from '@/components/OutlineTree.vue'
import TextEditor from '@/components/TextEditor.vue'

const { novelId, novel } = useNovel()
const store = useAllDataStore()
const message = useMessage()

const activeChapterId = ref<string | null>(null)

// 当前章节
const activeChapter = computed<Chapter | null>(() => {
  if (!novel.value || !activeChapterId.value) return null
  return novel.value.chapterList.chapters.find(ch => ch.id === activeChapterId.value) ?? null
})

// 当前章节标题
const activeChapterTitle = computed(() => {
  if (!novel.value || !activeChapterId.value) return ''
  // 尝试从大纲中找标题
  for (const phase of novel.value.outline.outlinePhases) {
    const outlineCh = phase.chapterOutlines.find(ch => ch.id === activeChapterId.value)
    if (outlineCh) return outlineCh.chapterTitle || `第${outlineCh.sort}章`
  }
  const ch = novel.value.chapterList.chapters.find(c => c.id === activeChapterId.value)
  return ch ? `第${ch.sort}章` : ''
})

// 选择章节时的处理
function selectChapter(chapterId: string) {
  // 检查当前是否有未保存的更改（简单处理：直接切换）
  // 如果章节不存在于 chapterList 中，自动创建
  if (novel.value) {
    let ch = novel.value.chapterList.chapters.find(c => c.id === chapterId)
    if (!ch) {
      // 从大纲中找信息创建章节
      let sort = 1
      for (const phase of novel.value.outline.outlinePhases) {
        const outlineCh = phase.chapterOutlines.find(co => co.id === chapterId)
        if (outlineCh) {
          sort = outlineCh.sort
          break
        }
      }
      ch = {
        id: chapterId,
        sort,
        content: '',
      }
      novel.value.chapterList.chapters.push(ch)
      // 按 sort 排序
      novel.value.chapterList.chapters.sort((a, b) => a.sort - b.sort)
    }
  }
  activeChapterId.value = chapterId
}

function handleSave(content: string) {
  if (!novel.value || !activeChapter.value) return
  activeChapter.value.content = content
  store.updateNovel(novelId.value, {
    chapterList: { ...novel.value.chapterList },
  })
  message.success('已保存')
}

function goPrevChapter() {
  if (!novel.value || !activeChapterId.value) return
  const allIds = novel.value.chapterList.chapters.map(c => c.id)
  const idx = allIds.indexOf(activeChapterId.value)
  if (idx > 0) {
    selectChapter(allIds[idx - 1])
  }
}

function goNextChapter() {
  if (!novel.value || !activeChapterId.value) return
  const allIds = novel.value.chapterList.chapters.map(c => c.id)
  const idx = allIds.indexOf(activeChapterId.value)
  if (idx < allIds.length - 1) {
    selectChapter(allIds[idx + 1])
  }
}

// 自动选中第一章
watch(
  () => novel.value,
  (n) => {
    if (n && !activeChapterId.value && n.chapterList.chapters.length > 0) {
      activeChapterId.value = n.chapterList.chapters[0].id
    } else if (n && !activeChapterId.value && n.outline.outlinePhases.length > 0) {
      const firstPhase = n.outline.outlinePhases[0]
      if (firstPhase.chapterOutlines.length > 0) {
        activeChapterId.value = firstPhase.chapterOutlines[0].id
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="novel" style="height: 100%; display: flex; flex-direction: column;">
    <div style="display: flex; gap: 16px; flex: 1; min-height: 0;">
      <!-- 左侧大纲树 -->
      <div style="width: 260px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid #eee; padding-right: 12px;">
        <OutlineTree
          :novel="novel"
          :active-chapter-id="activeChapterId"
          @select-chapter="selectChapter"
        />
      </div>

      <!-- 右侧编辑器 -->
      <div style="flex: 1; min-width: 0;">
        <TextEditor
          :chapter="activeChapter"
          :chapter-title="activeChapterTitle"
          @save="handleSave"
          @prev-chapter="goPrevChapter"
          @next-chapter="goNextChapter"
        />
      </div>
    </div>
  </div>

  <div v-else>
    <n-empty description="小说不存在" />
  </div>
</template>
