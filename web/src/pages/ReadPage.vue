<script setup lang="ts">
import { useNovel } from '@/composables/useNovel'
import { useFontSize } from '@/composables/useFontSize'
import { useKeyboard } from '@/composables/useKeyboard'
import TocPanel from '@/components/TocPanel.vue'

const { novel } = useNovel()
const { fontSize, increase, decrease } = useFontSize()

const showToc = ref(false)
const currentChapterId = ref<string | null>(null)

// 当前章节内容
const currentChapter = computed(() => {
  if (!novel.value || !currentChapterId.value) return null
  return novel.value.chapterList.chapters.find(ch => ch.id === currentChapterId.value) ?? null
})

// 当前章节标题
const currentChapterTitle = computed(() => {
  if (!novel.value || !currentChapterId.value) return ''
  const ch = novel.value.chapterList.chapters.find(c => c.id === currentChapterId.value)
  if (!ch) return ''
  // 尝试从大纲找标题
  for (const phase of novel.value.outline.outlinePhases) {
    const outlineCh = phase.chapterOutlines.find(co => co.id === currentChapterId.value)
    if (outlineCh) return outlineCh.chapterTitle || `第${outlineCh.sort}章`
  }
  return `第${ch.sort}章`
})

// 所有章节 ID 列表
const allChapterIds = computed(() => {
  if (!novel.value) return []
  return novel.value.chapterList.chapters.map(c => c.id)
})

function goPrevChapter() {
  const ids = allChapterIds.value
  const idx = ids.indexOf(currentChapterId.value!)
  if (idx > 0) {
    currentChapterId.value = ids[idx - 1]
  }
}

function goNextChapter() {
  const ids = allChapterIds.value
  const idx = ids.indexOf(currentChapterId.value!)
  if (idx < ids.length - 1) {
    currentChapterId.value = ids[idx + 1]
  }
}

function selectChapter(chapterId: string) {
  currentChapterId.value = chapterId
}

// 键盘快捷键
useKeyboard({
  prevChapter: goPrevChapter,
  nextChapter: goNextChapter,
})

// 自动选中第一章
watch(
  () => novel.value?.chapterList.chapters,
  (chapters) => {
    if (chapters && chapters.length > 0 && !currentChapterId.value) {
      currentChapterId.value = chapters[0].id
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="novel" style="max-width: 800px; margin: 0 auto;">
    <!-- 顶部工具栏 -->
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;">
      <n-button-group size="small">
        <n-button @click="decrease">A-</n-button>
        <n-button disabled style="font-weight: 600;">{{ fontSize }}</n-button>
        <n-button @click="increase">A+</n-button>
      </n-button-group>

      <n-divider vertical style="height: 20px;" />

      <n-button size="small" secondary @click="showToc = !showToc">
        ≡ 目录
      </n-button>

      <n-divider vertical style="height: 20px;" />

      <n-button size="small" :disabled="!currentChapterId || allChapterIds.indexOf(currentChapterId!) <= 0" @click="goPrevChapter">
        ← 上一章
      </n-button>
      <n-button size="small" :disabled="!currentChapterId || allChapterIds.indexOf(currentChapterId!) >= allChapterIds.length - 1" @click="goNextChapter">
        下一章 →
      </n-button>

      <div style="margin-left: auto; font-size: 12px; color: #999;">
        ← → 切换章节
      </div>
    </div>

    <!-- 章节内容 -->
    <div v-if="currentChapter" :style="{ fontSize: fontSize + 'px' }">
      <n-h2 style="text-align: center;">
        {{ currentChapterTitle }}
      </n-h2>
      <div style="white-space: pre-wrap; line-height: 1.9; color: #333;">
        {{ currentChapter.content || '（本章暂无内容）' }}
      </div>
      <div style="text-align: center; margin: 48px 0; color: #ccc; font-size: 14px;">
        —— 本章完 · 共 {{ currentChapter.content.length.toLocaleString() }} 字 ——
      </div>
    </div>

    <div v-else style="text-align: center; padding: 60px 0;">
      <n-empty description="暂无章节内容" />
    </div>

    <!-- 底部章节切换 -->
    <div style="display: flex; justify-content: space-between; margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee;">
      <n-button :disabled="!currentChapterId || allChapterIds.indexOf(currentChapterId!) <= 0" @click="goPrevChapter">
        ← 上一章
      </n-button>
      <n-button :disabled="!currentChapterId || allChapterIds.indexOf(currentChapterId!) >= allChapterIds.length - 1" @click="goNextChapter">
        下一章 →
      </n-button>
    </div>

    <!-- 目录浮窗 -->
    <TocPanel
      :show="showToc"
      :novel="novel"
      :current-chapter-id="currentChapterId"
      @close="showToc = false"
      @select-chapter="selectChapter"
    />
  </div>

  <div v-else>
    <n-empty description="小说不存在" />
  </div>
</template>
