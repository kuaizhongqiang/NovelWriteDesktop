<script setup lang="ts">
import type { Novel } from '@/types'

const props = defineProps<{
  novel: Novel
  activeChapterId: string | null
}>()

const emit = defineEmits<{
  selectChapter: [chapterId: string]
}>()

// 收集所有已在 Phase 中的章节 ID
const phaseChapterIds = computed(() => {
  const ids = new Set<string>()
  for (const phase of props.novel.outline.outlinePhases) {
    for (const ch of phase.chapterOutlines) {
      ids.add(ch.id)
    }
  }
  return ids
})

// 不在任何 Phase 中的章节（避免重复显示）
const chaptersNotInPhase = computed(() => {
  return props.novel.chapterList.chapters.filter(ch => !phaseChapterIds.value.has(ch.id))
})

function handleClick(chapterId: string) {
  emit('selectChapter', chapterId)
}
</script>

<template>
  <div style="height: 100%; overflow-y: auto;">
    <div style="font-weight: 600; font-size: 14px; margin-bottom: 12px; padding: 0 8px;">
      📖 {{ novel.title }}
    </div>

    <div v-if="novel.outline.outlinePhases.length === 0 && novel.chapterList.chapters.length === 0" style="padding: 0 8px; color: #888; font-size: 13px;">
      暂无章节，请先在大纲中设置
    </div>

    <!-- 按 Phase 分组显示 -->
    <template v-for="phase in novel.outline.outlinePhases" :key="phase.id">
      <div v-if="phase.title" style="font-weight: 600; font-size: 13px; padding: 8px 8px 4px; color: #666;">
        {{ phase.title }}
      </div>
      <div style="margin-left: 8px; border-left: 2px solid #eee;">
        <div
          v-for="chOutline in phase.chapterOutlines"
          :key="chOutline.id"
          :class="['tree-item', { active: activeChapterId === chOutline.id }]"
          @click="handleClick(chOutline.id)"
        >
          <span class="tree-dot">●</span>
          <span>{{ chOutline.chapterTitle || `第${chOutline.sort}章` }}</span>
        </div>
      </div>
    </template>

    <!-- 不在任何 Phase 中的章节（独立创建，不重复显示） -->
    <div v-if="chaptersNotInPhase.length > 0" style="margin-top: 8px;">
      <div style="font-weight: 600; font-size: 13px; padding: 4px 8px; color: #666;">
        其他章节
      </div>
      <div
        v-for="ch in chaptersNotInPhase"
        :key="ch.id"
        :class="['tree-item', { active: activeChapterId === ch.id }]"
        @click="handleClick(ch.id)"
        style="margin-left: 8px;"
      >
        <span class="tree-dot">●</span>
        <span>{{ `第${ch.sort}章` + (ch.content ? ` (${ch.content.length}字)` : '') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  transition: background 0.15s;
}
.tree-item:hover {
  background: #f5f5f5;
}
.tree-item.active {
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 500;
}
.tree-dot {
  font-size: 8px;
  color: #aaa;
  flex-shrink: 0;
}
.tree-item.active .tree-dot {
  color: #1a73e8;
}
</style>
