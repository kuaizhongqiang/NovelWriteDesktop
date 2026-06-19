<script setup lang="ts">
import type { OutlinePhase, ChapterOutline } from '@/types'
import { createId } from '@/types'

const props = defineProps<{
  phase: OutlinePhase
  phaseIndex: number
}>()

const emit = defineEmits<{
  delete: []
}>()

// 本地编辑
const data = reactive({
  title: props.phase.title,
  description: props.phase.description,
})

watch(
  () => [props.phase.title, props.phase.description],
  ([t, d]) => {
    data.title = t
    data.description = d
  },
)

function syncPhase() {
  props.phase.title = data.title
  props.phase.description = data.description
}

function addChapterOutline() {
  const ch: ChapterOutline = {
    id: createId(),
    sort: props.phase.chapterOutlines.length + 1,
    chapterTitle: '',
    chapterDescription: '',
    hook: '',
  }
  props.phase.chapterOutlines.push(ch)
}

function removeChapterOutline(index: number) {
  props.phase.chapterOutlines.splice(index, 1)
  props.phase.chapterOutlines.forEach((ch, i) => { ch.sort = i + 1 })
}
</script>

<template>
  <n-collapse-item>
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
        <span style="font-size: 12px; color: #888; white-space: nowrap;">第{{ phaseIndex + 1 }}卷</span>
        <n-input
          v-model:value="data.title"
          placeholder="幕/卷标题"
          size="small"
          style="max-width: 300px;"
          @update:value="syncPhase"
          @click.stop
        />
        <n-button
          text
          type="error"
          size="tiny"
          style="margin-left: auto;"
          @click.stop="emit('delete')"
        >
          删除
        </n-button>
      </div>
    </template>

    <div style="padding: 8px 0 8px 16px;">
      <n-form-item label="描述" label-placement="top" style="margin-bottom: 12px;">
        <n-input
          v-model:value="data.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="本幕/卷的描述..."
          @update:value="syncPhase"
        />
      </n-form-item>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div
          v-for="(ch, idx) in phase.chapterOutlines"
          :key="ch.id"
          style="display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid #eee; border-radius: 6px;"
        >
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 12px; color: #888; min-width: 48px;">第{{ idx + 1 }}章</span>
            <n-input
              v-model:value="ch.chapterTitle"
              placeholder="章节标题"
              size="small"
              style="flex: 1;"
            />
            <n-button text type="error" size="tiny" @click="removeChapterOutline(idx)">✕</n-button>
          </div>
          <!-- 顺序：章节大纲（描述）在前，钩子在后 -->
          <n-input
            v-model:value="ch.chapterDescription"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 3 }"
            placeholder="章节大纲描述..."
            size="small"
          />
          <n-input
            v-model:value="ch.hook"
            placeholder="钩子 / 悬念"
            size="small"
          />
        </div>
      </div>

      <n-button size="tiny" secondary style="margin-top: 8px;" @click="addChapterOutline">
        + 添加章节
      </n-button>
    </div>
  </n-collapse-item>
</template>
