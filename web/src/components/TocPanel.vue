<script setup lang="ts">
import type { Novel } from '@/types'

const props = defineProps<{
  show: boolean
  novel: Novel
  currentChapterId: string | null
}>()

const emit = defineEmits<{
  close: []
  selectChapter: [chapterId: string]
}>()

function handleSelect(chapterId: string) {
  emit('selectChapter', chapterId)
  emit('close')
}

const tocChapters = computed(() => {
  const result: { phaseTitle: string; chapterId: string; title: string; sort: number }[] = []

  for (const phase of props.novel.outline.outlinePhases) {
    for (const ch of phase.chapterOutlines) {
      result.push({
        phaseTitle: phase.title,
        chapterId: ch.id,
        title: ch.chapterTitle || `第${ch.sort}章`,
        sort: ch.sort,
      })
    }
  }

  // 也加入不在大纲中的章节
  for (const ch of props.novel.chapterList.chapters) {
    if (!result.find(r => r.chapterId === ch.id)) {
      result.push({
        phaseTitle: '',
        chapterId: ch.id,
        title: `第${ch.sort}章`,
        sort: ch.sort,
      })
    }
  }

  result.sort((a, b) => a.sort - b.sort)
  return result
})
</script>

<template>
  <!-- 遮罩 -->
  <div
    v-if="show"
    class="toc-overlay"
    @click.self="emit('close')"
  >
    <!-- 浮窗 -->
    <div class="toc-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #eee;">
        <span style="font-weight: 600;">📖 目录</span>
        <n-button text size="small" @click="emit('close')">✕</n-button>
      </div>
      <div style="padding: 8px 0; max-height: 60vh; overflow-y: auto;">
        <div
          v-for="ch in tocChapters"
          :key="ch.chapterId"
          :class="['toc-item', { active: ch.chapterId === currentChapterId }]"
          @click="handleSelect(ch.chapterId)"
        >
          <span v-if="ch.phaseTitle" style="font-size: 11px; color: #999; margin-right: 4px;">
            [{{ ch.phaseTitle }}]
          </span>
          {{ ch.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toc-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 80px;
  background: rgba(0, 0, 0, 0.3);
}
.toc-panel {
  width: 360px;
  max-width: 90vw;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
.toc-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s;
}
.toc-item:hover {
  background: #f5f5f5;
}
.toc-item.active {
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 500;
}
</style>
