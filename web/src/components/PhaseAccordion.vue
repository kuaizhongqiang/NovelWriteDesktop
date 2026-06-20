<script setup lang="ts">
import type { OutlinePhase } from '@/types'
import { useAllDataStore } from '@/stores/allData'
import { useNovel } from '@/composables/useNovel'

const props = defineProps<{
  phase: OutlinePhase
  phaseIndex: number
}>()

const emit = defineEmits<{
  delete: []
}>()

const store = useAllDataStore()
const { novelId } = useNovel()

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
  { immediate: true },
)

function syncPhase() {
  store.updatePhase(novelId.value, props.phase.id, {
    title: data.title,
    description: data.description,
  })
}

function addChapterOutline() {
  store.addChapterOutlineToPhase(novelId.value, props.phase.id)
}

function removeChapterOutline(index: number) {
  store.removeChapterOutlineFromPhase(novelId.value, props.phase.id, index)
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
              @update:value="store.updateChapterOutline(novelId, phase.id, ch.id, { chapterTitle: ch.chapterTitle })"
            />
            <n-button text type="error" size="tiny" @click="removeChapterOutline(idx)">✕</n-button>
          </div>
          <n-input
            v-model:value="ch.chapterDescription"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 3 }"
            placeholder="章节大纲描述..."
            size="small"
            @update:value="store.updateChapterOutline(novelId, phase.id, ch.id, { chapterDescription: ch.chapterDescription })"
          />
          <n-input
            v-model:value="ch.hook"
            placeholder="钩子 / 悬念"
            size="small"
            @update:value="store.updateChapterOutline(novelId, phase.id, ch.id, { hook: ch.hook })"
          />
        </div>
      </div>

      <n-button size="tiny" secondary style="margin-top: 8px;" @click="addChapterOutline">
        + 添加章节
      </n-button>
    </div>
  </n-collapse-item>
</template>
