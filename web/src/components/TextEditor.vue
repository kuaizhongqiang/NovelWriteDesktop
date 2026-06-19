<script setup lang="ts">
import type { Chapter } from '@/types'

const props = defineProps<{
  chapter: Chapter | null
  chapterTitle: string
}>()

const emit = defineEmits<{
  save: [content: string]
  prevChapter: []
  nextChapter: []
}>()

const content = ref('')

watch(
  () => props.chapter,
  (ch) => {
    content.value = ch?.content ?? ''
  },
  { immediate: true },
)

const wordCount = computed(() => content.value.length)

function handleSave() {
  if (props.chapter) {
    emit('save', content.value)
  }
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%;">
    <!-- 顶部信息栏 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="font-size: 16px; font-weight: 600;">
        {{ chapterTitle || '选择章节' }}
      </div>
      <n-tag v-if="chapter" size="small">
        {{ wordCount.toLocaleString() }} 字
      </n-tag>
    </div>

    <!-- 编辑器主体 -->
    <div v-if="chapter" style="flex: 1; display: flex; flex-direction: column;">
      <n-input
        v-model:value="content"
        type="textarea"
        :autosize="{ minRows: 25 }"
        placeholder="开始写作..."
        style="flex: 1;"
      />

      <!-- 底部操作栏 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
        <n-button size="small" @click="emit('prevChapter')">
          ← 上一章
        </n-button>
        <n-button type="primary" size="small" @click="handleSave">
          保存
        </n-button>
        <n-button size="small" @click="emit('nextChapter')">
          下一章 →
        </n-button>
      </div>
    </div>

    <!-- 无章节提示 -->
    <div v-else style="flex: 1; display: flex; align-items: center; justify-content: center;">
      <n-empty description="请在左侧选择章节" />
    </div>
  </div>
</template>
