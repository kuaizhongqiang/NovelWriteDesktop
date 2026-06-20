<script setup lang="ts">
import type { Novel } from '@/types'
import { calcTotalCharCount } from '@/types'
import { useRouter } from 'vue-router'
import { useAllDataStore } from '@/stores/allData'

const props = defineProps<{ novel: Novel }>()
const router = useRouter()
const store = useAllDataStore()
const dialog = useDialog()
const message = useMessage()

const wordCount = computed(() => calcTotalCharCount(props.novel))
const displayTags = computed(() => props.novel.novelBaseData.tags.slice(0, 3))
const extraTagCount = computed(() => Math.max(0, props.novel.novelBaseData.tags.length - 3))

function goRead() {
  router.push(`/novel/${props.novel.id}/read`)
}

function goEdit() {
  router.push(`/novel/${props.novel.id}/settings`)
}

function handleDelete() {
  dialog.warning({
    title: '确认删除',
    content: `确定删除小说「${props.novel.title}」吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      store.deleteNovel(props.novel.id)
      message.success(`已删除「${props.novel.title}」`)
    },
  })
}
</script>

<template>
  <n-card
    :title="novel.title"
    hoverable
    style="height: 100%;"
  >
    <template #header-extra>
      <n-tag v-if="novel.isOpen" size="tiny" type="success">公开</n-tag>
      <n-tag v-else size="tiny" type="warning">私密</n-tag>
    </template>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div v-if="novel.novelBaseData.genre" style="font-size: 13px; color: #888;">
        题材：{{ novel.novelBaseData.genre }}
      </div>

      <div v-if="displayTags.length" style="display: flex; gap: 4px; flex-wrap: wrap;">
        <n-tag v-for="tag in displayTags" :key="tag" size="tiny" round>
          {{ tag }}
        </n-tag>
        <n-tag v-if="extraTagCount" size="tiny" round type="info">
          +{{ extraTagCount }}
        </n-tag>
      </div>

      <div style="font-size: 13px; color: #888;">
        {{ wordCount.toLocaleString() }} 字
      </div>

      <div style="font-size: 12px; color: #aaa;">
        更新于 {{ new Date(novel.updated).toLocaleDateString('zh-CN') }}
      </div>
    </div>

    <template #footer>
      <n-space justify="space-between">
        <n-button size="small" secondary @click.stop="goRead">
          阅读
        </n-button>
        <n-space>
          <n-button size="small" secondary type="error" @click.stop="handleDelete">
            删除
          </n-button>
          <n-button size="small" secondary type="primary" @click.stop="goEdit">
            编辑
          </n-button>
        </n-space>
      </n-space>
    </template>
  </n-card>
</template>
