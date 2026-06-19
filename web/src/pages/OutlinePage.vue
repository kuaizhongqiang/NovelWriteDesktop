<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNovel } from '@/composables/useNovel'
import { useAllDataStore } from '@/stores/allData'
import { createId, type OutlinePhase } from '@/types'
import PhaseAccordion from '@/components/PhaseAccordion.vue'

const { novelId, novel } = useNovel()
const store = useAllDataStore()
const router = useRouter()
const message = useMessage()

// 直接编辑 novel.outline 的属性
const form = reactive({
  mainRoleSuperpower: '',
  worldView: '',
  writingKeyPoints: '',
})

watch(
  () => novel.value?.outline,
  (o) => {
    if (o) {
      form.mainRoleSuperpower = o.mainRoleSuperpower
      form.worldView = o.worldView
      form.writingKeyPoints = o.writingKeyPoints
    }
  },
  { immediate: true },
)

function syncOutline() {
  if (!novel.value) return
  novel.value.outline.mainRoleSuperpower = form.mainRoleSuperpower
  novel.value.outline.worldView = form.worldView
  novel.value.outline.writingKeyPoints = form.writingKeyPoints
}

function addPhase() {
  if (!novel.value) return
  const phase: OutlinePhase = {
    id: createId(),
    sort: novel.value.outline.outlinePhases.length + 1,
    title: '',
    description: '',
    chapterOutlines: [],
  }
  novel.value.outline.outlinePhases.push(phase)
}

function removePhase(index: number) {
  if (!novel.value) return
  novel.value.outline.outlinePhases.splice(index, 1)
  novel.value.outline.outlinePhases.forEach((p, i) => { p.sort = i + 1 })
}

function handleSave() {
  if (novel.value) {
    syncOutline()
    store.updateNovel(novelId.value, {
      outline: { ...novel.value.outline },
    })
    message.success('已保存')
  }
}

function handleCancel() {
  router.push('/')
}
</script>

<template>
  <div v-if="novel" style="max-width: 720px;">
    <n-h2>大纲设定</n-h2>

    <n-form label-placement="top">
      <n-form-item label="主角金手指">
        <n-input
          v-model:value="form.mainRoleSuperpower"
          placeholder="如：重生、系统、异能..."
          @update:value="syncOutline"
        />
      </n-form-item>
      <n-form-item label="世界观">
        <n-input
          v-model:value="form.worldView"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="世界观设定..."
          @update:value="syncOutline"
        />
      </n-form-item>
      <n-form-item label="写作要点">
        <n-input
          v-model:value="form.writingKeyPoints"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="写作中要注意的要点..."
          @update:value="syncOutline"
        />
      </n-form-item>
    </n-form>

    <n-divider>大纲结构</n-divider>

    <n-collapse accordion>
      <PhaseAccordion
        v-for="(phase, idx) in novel.outline.outlinePhases"
        :key="phase.id"
        :phase="phase"
        :phase-index="idx"
        @delete="removePhase(idx)"
      />
    </n-collapse>

    <div style="margin-top: 12px;">
      <n-button secondary @click="addPhase">
        + 添加新幕/卷
      </n-button>
    </div>

    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
      <n-button @click="handleCancel">取消</n-button>
      <n-button type="primary" @click="handleSave">保存</n-button>
    </div>
  </div>

  <div v-else>
    <n-empty description="小说不存在" />
  </div>
</template>
