<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNovel } from '@/composables/useNovel'
import { useAllDataStore } from '@/stores/allData'
import type { NovelBaseData } from '@/types'

const { novelId, novel } = useNovel()
const store = useAllDataStore()
const router = useRouter()
const message = useMessage()

// 本地编辑副本
const form = ref<NovelBaseData>({
  description: '',
  oneWord: '',
  genre: '',
  tags: [],
})

// 当前选中的预设 ID
const selectedPresetId = ref('')

// 标签管理
const newTag = ref('')

// 预设下拉选项
const presetOptions = computed(() =>
  store.data.writingStyles.map(s => ({
    label: s.name,
    value: s.id,
  })),
)

// 表单验证规则
const rules = {
  title: [
    { required: true, message: '请输入小说标题', trigger: 'blur' },
    { max: 100, message: '标题不超过 100 字', trigger: 'blur' },
  ],
  genre: [
    { max: 20, message: '题材不超过 20 字', trigger: 'blur' },
  ],
  oneWord: [
    { max: 200, message: '一句话概括不超过 200 字', trigger: 'blur' },
  ],
}

// 当 novel 加载后，初始化表单
watch(
  novel,
  (n) => {
    if (n) {
      form.value = { ...n.novelBaseData }
      selectedPresetId.value = n.writingStyle?.id ?? ''
    }
  },
  { immediate: true },
)

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !form.value.tags.includes(tag)) {
    form.value.tags.push(tag)
    newTag.value = ''
  }
}

function removeTag(tag: string) {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

function handlePresetChange(presetId: string) {
  if (!novel.value || !presetId) return
  store.applyPresetToNovel(novelId.value, presetId)
  selectedPresetId.value = presetId
  const preset = store.data.writingStyles.find(s => s.id === presetId)
  message.success(`已关联风格「${preset?.name}」`)
}

async function handleSave() {
  if (novel.value) {
    store.updateNovel(novelId.value, {
      novelBaseData: { ...form.value },
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
    <n-h2>小说基础设定</n-h2>

    <n-form
      :model="novel"
      :rules="rules"
      label-placement="top"
      style="margin-top: 16px;"
    >
      <n-form-item label="标题" path="title">
        <n-input v-model:value="novel.title" placeholder="输入小说标题" />
      </n-form-item>

      <n-form-item label="题材" path="genre">
        <n-input v-model:value="form.genre" placeholder="如：奇幻、都市、科幻..." />
      </n-form-item>

      <n-form-item label="标签">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
          <n-tag
            v-for="tag in form.tags"
            :key="tag"
            closable
            @close="removeTag(tag)"
          >
            {{ tag }}
          </n-tag>
        </div>
        <div style="display: flex; gap: 8px;">
          <n-input
            v-model:value="newTag"
            placeholder="输入标签后添加"
            style="width: 200px;"
            @keyup.enter="addTag"
          />
          <n-button size="small" @click="addTag">添加</n-button>
        </div>
      </n-form-item>

      <!-- 写作风格预设关联 -->
      <n-form-item label="写作风格">
        <n-select
          v-model:value="selectedPresetId"
          :options="presetOptions"
          placeholder="选择写作风格预设"
          @update:value="handlePresetChange"
        />
      </n-form-item>

      <n-form-item label="一句话概括" path="oneWord">
        <n-input v-model:value="form.oneWord" placeholder="用一句话概括你的小说" />
      </n-form-item>

      <n-form-item label="简介">
        <n-input
          v-model:value="form.description"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 20 }"
          placeholder="输入小说简介..."
        />
      </n-form-item>

      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" @click="handleSave">保存</n-button>
      </div>
    </n-form>
  </div>

  <div v-else>
    <n-empty description="小说不存在" />
  </div>
</template>
