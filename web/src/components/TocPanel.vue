<script setup lang="ts">
import type { Novel } from '@/types'
import { getFlatChapterTree } from '@/composables/useChapterTree'

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

const tocChapters = computed(() => getFlatChapterTree(props.novel))
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
          :key="ch.id"
          :class="['toc-item', { active: ch.id === currentChapterId }]"
          @click="handleSelect(ch.id)"
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
  background: var(--nw-overlay);
}
.toc-panel {
  width: 360px;
  max-width: 90vw;
  background: var(--nw-card-bg);
  border-radius: 8px;
  box-shadow: 0 4px 24px var(--nw-shadow);
  overflow: hidden;
}
.toc-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s;
  color: var(--nw-text);
}
.toc-item:hover {
  background: var(--nw-bg-hover);
}
.toc-item.active {
  background: var(--nw-bg-active);
  color: var(--nw-accent);
  font-weight: 500;
}
</style>
