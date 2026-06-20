<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNovel } from '@/composables/useNovel'
import { useAllDataStore } from '@/stores/allData'
import { createId, createDefaultWritingStyle, type WritingStyle } from '@/types'

const { novel } = useNovel()
const store = useAllDataStore()
const router = useRouter()
const message = useMessage()

// 编辑状态：null=未编辑, 'new'=新建, WritingStyle=编辑某个预设
const editingState = ref<WritingStyle | 'new' | null>(null)
const editingForm = reactive({
  name: '',
  minChars: 1000,
  maxChars: 3000,
  fullStoryLength: 100000,
  baseTone: '',
})

function startEdit(preset: WritingStyle) {
  editingState.value = preset
  editingForm.name = preset.name
  editingForm.minChars = preset.charPerChapter.min
  editingForm.maxChars = preset.charPerChapter.max
  editingForm.fullStoryLength = preset.fullStoryLength
  editingForm.baseTone = preset.baseTone
}

function startCreate() {
  editingState.value = 'new'
  editingForm.name = ''
  editingForm.minChars = 1000
  editingForm.maxChars = 3000
  editingForm.fullStoryLength = 100000
  editingForm.baseTone = ''
}

function cancelEdit() {
  editingState.value = null
}

function isEditing(): boolean {
  return editingState.value !== null
}

function savePreset() {
  if (!editingForm.name.trim()) {
    message.warning('请输入预设名称')
    return
  }

  if (editingState.value === 'new') {
    // 新建
    const preset: WritingStyle = {
      id: createId(),
      name: editingForm.name,
      charPerChapter: { min: editingForm.minChars, max: editingForm.maxChars },
      fullStoryLength: editingForm.fullStoryLength,
      baseTone: editingForm.baseTone,
    }
    store.addWritingStylePreset(preset)
    message.success(`预设「${editingForm.name}」已创建`)
  } else if (editingState.value) {
    // 更新
    store.updateWritingStylePreset(editingState.value.id, {
      name: editingForm.name,
      charPerChapter: { min: editingForm.minChars, max: editingForm.maxChars },
      fullStoryLength: editingForm.fullStoryLength,
      baseTone: editingForm.baseTone,
    })
    message.success(`预设「${editingForm.name}」已更新`)
  }
  editingState.value = null
}

function deletePreset(id: string) {
  const preset = store.data.writingStyles.find(s => s.id === id)
  if (!preset) return

  const novelsUsing = store.data.novels.filter(n => n.writingStyle.id === id)
  if (novelsUsing.length > 0) {
    const ok = window.confirm(
      `有 ${novelsUsing.length} 部小说正在使用「${preset.name}」，删除后会自动切换到其他预设。确定删除？`,
    )
    if (!ok) return
    const fallback = store.data.writingStyles.find(s => s.id !== id)
    for (const n of novelsUsing) {
      n.writingStyle = fallback ? { ...fallback } : createDefaultWritingStyle()
    }
  }

  store.deleteWritingStylePreset(id)
  message.success(`预设「${preset.name}」已删除`)
}

function handleCancel() {
  router.push('/')
}
</script>

<template>
  <div v-if="novel" style="max-width: 800px;">
    <n-h2>写作风格预设</n-h2>
    <p style="color: #888; font-size: 13px; margin-bottom: 16px;">
      管理全局风格预设，在「基础设定」中为每部小说选择预设
    </p>

    <!-- 预设列表 -->
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <n-card
        v-for="preset in store.data.writingStyles"
        :key="preset.id"
        size="small"
      >
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">{{ preset.name }}</div>
            <div style="font-size: 13px; color: #666; margin-top: 4px;">
              {{ preset.charPerChapter.min }}-{{ preset.charPerChapter.max }} 字/章
              · 预计 {{ preset.fullStoryLength.toLocaleString() }} 字
              <template v-if="preset.baseTone"> · {{ preset.baseTone }}</template>
            </div>
          </div>
          <n-space>
            <n-button size="tiny" secondary @click="startEdit(preset)">
              编辑
            </n-button>
            <n-button
              size="tiny"
              secondary
              type="error"
              :disabled="store.data.writingStyles.length <= 1"
              @click="deletePreset(preset.id)"
            >
              删除
            </n-button>
          </n-space>
        </div>
      </n-card>
    </div>

    <!-- 编辑/新建面板 -->
    <n-card
      v-if="isEditing()"
      :title="editingState === 'new' ? '新建预设' : '编辑预设'"
      size="small"
      style="margin-top: 16px;"
    >
      <n-form label-placement="top">
        <n-form-item
          label="预设名称"
          :rule="[{ required: true, message: '请输入预设名称', trigger: 'blur' }]"
        >
          <n-input v-model:value="editingForm.name" placeholder="如：短篇快节奏、史诗慢热..." />
        </n-form-item>
        <n-form-item label="每章字数范围">
          <div style="display: flex; gap: 12px; align-items: center;">
            <n-input-number v-model:value="editingForm.minChars" :min="100" :max="100000" :step="500" style="width: 150px;" />
            <span>—</span>
            <n-input-number v-model:value="editingForm.maxChars" :min="100" :max="100000" :step="500" style="width: 150px;" />
          </div>
        </n-form-item>
        <n-form-item label="全本预计总字数">
          <n-input-number v-model:value="editingForm.fullStoryLength" :min="10000" :max="10000000" :step="10000" style="width: 200px;" />
        </n-form-item>
        <n-form-item label="基调">
          <n-input v-model:value="editingForm.baseTone" placeholder="如：热血、轻松、虐心、悬疑、治愈..." />
        </n-form-item>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <n-button @click="cancelEdit">取消</n-button>
          <n-button type="primary" @click="savePreset">保存</n-button>
        </div>
      </n-form>
    </n-card>

    <!-- 新建按钮 -->
    <div v-if="!isEditing()" style="margin-top: 16px;">
      <n-button secondary @click="startCreate">
        + 新建预设
      </n-button>
    </div>

    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px;">
      <n-button @click="handleCancel">返回</n-button>
    </div>
  </div>

  <div v-else>
    <n-empty description="小说不存在" />
  </div>
</template>
