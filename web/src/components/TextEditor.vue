<script setup lang="ts">
import type { Chapter } from '@/types'
import { useUndoRedo } from '@/composables/useUndoRedo'

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
const savedContent = ref('')
const saveStatus = ref<'saved' | 'saving' | 'unsaved'>('saved')
const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const snapshotTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 撤销/重做
const { pushSnapshot, undo, redo, canUndo, canRedo, clear: clearHistory } = useUndoRedo()

watch(
  () => props.chapter,
  (ch) => {
    const text = ch?.content ?? ''
    content.value = text
    savedContent.value = text
    saveStatus.value = 'saved'
    clearHistory()
  },
  { immediate: true },
)

const wordCount = computed(() => content.value.length)
const charCountCN = computed(() => {
  return (content.value.match(/[一-鿿＀-￯]/g) || []).length
})
const hasUnsavedChanges = computed(() => content.value !== savedContent.value)

// 自动保存（2s 防抖）
watch(content, (newVal) => {
  if (!props.chapter) return
  saveStatus.value = 'unsaved'

  // 自动保存防抖
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
  autoSaveTimer.value = setTimeout(() => {
    doSave()
  }, 2000)

  // 撤销快照：用户停止输入 3s 后记录快照
  if (snapshotTimer.value) clearTimeout(snapshotTimer.value)
  snapshotTimer.value = setTimeout(() => {
    pushSnapshot(newVal)
  }, 3000)
})

function handleSave() {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
  doSave()
}

function doSave() {
  if (!props.chapter) return
  saveStatus.value = 'saving'
  // 保存前记录快照
  pushSnapshot(content.value)
  emit('save', content.value)
  savedContent.value = content.value
  saveStatus.value = 'saved'
}

// 撤销/重做操作
function handleUndo() {
  const prev = undo(content.value)
  if (prev !== null) content.value = prev
}

function handleRedo() {
  const next = redo(content.value)
  if (next !== null) content.value = next
}

// Tab 缩进
function handleKeydown(e: KeyboardEvent) {
  // Ctrl+S 保存
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    handleSave()
    return
  }

  // Ctrl+Z 撤销
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    handleUndo()
    return
  }

  // Ctrl+Y 或 Ctrl+Shift+Z 重做
  if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
    e.preventDefault()
    handleRedo()
    return
  }

  // Tab 插入空格
  if (e.key === 'Tab') {
    e.preventDefault()
    const target = e.target as HTMLTextAreaElement
    const start = target.selectionStart
    const end = target.selectionEnd
    const before = content.value.substring(0, start)
    const after = content.value.substring(end)
    content.value = before + '  ' + after
    nextTick(() => {
      const pos = start + 2
      target.setSelectionRange(pos, pos)
    })
  }
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%;">
    <!-- 顶部信息栏 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 4px;">
      <div style="font-size: 16px; font-weight: 600;">
        {{ chapterTitle || '选择章节' }}
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <!-- 撤销/重做 -->
        <n-button-group size="tiny">
          <n-button :disabled="!canUndo" @click="handleUndo" title="撤销 (Ctrl+Z)">
            ↩ 撤销
          </n-button>
          <n-button :disabled="!canRedo" @click="handleRedo" title="重做 (Ctrl+Y)">
            重做 ↪
          </n-button>
        </n-button-group>

        <!-- 字数统计 -->
        <n-tag v-if="chapter" size="tiny">
          {{ wordCount.toLocaleString() }} 字
        </n-tag>
        <n-tag v-if="chapter" size="tiny" type="info">
          {{ charCountCN.toLocaleString() }} 中文
        </n-tag>

        <!-- 保存状态 -->
        <n-tag
          v-if="chapter"
          :type="saveStatus === 'saved' ? 'success' : 'warning'"
          size="tiny"
        >
          {{ saveStatus === 'saved' ? '已保存' : '未保存' }}
        </n-tag>
      </div>
    </div>

    <!-- 编辑器主体 -->
    <div v-if="chapter" style="flex: 1; display: flex; flex-direction: column;">
      <n-input
        v-model:value="content"
        type="textarea"
        :autosize="{ minRows: 25 }"
        placeholder="开始写作...（Tab 缩进，Ctrl+S 保存，Ctrl+Z 撤销）"
        style="flex: 1; font-family: 'Source Han Serif', 'Noto Serif SC', serif; line-height: 1.8;"
        @keydown="handleKeydown"
      />

      <!-- 底部操作栏 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
        <div style="display: flex; gap: 8px;">
          <n-button size="tiny" @click="emit('prevChapter')">
            ← 上一章
          </n-button>
          <n-button size="tiny" @click="emit('nextChapter')">
            下一章 →
          </n-button>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <n-button
            v-if="hasUnsavedChanges"
            size="tiny"
            quaternary
            type="warning"
            @click="handleSave"
          >
            保存更改
          </n-button>
          <n-button size="small" type="primary" @click="handleSave">
            保存
          </n-button>
        </div>
      </div>
    </div>

    <!-- 无章节提示 -->
    <div v-else style="flex: 1; display: flex; align-items: center; justify-content: center;">
      <n-empty description="请在左侧选择章节" />
    </div>
  </div>
</template>
