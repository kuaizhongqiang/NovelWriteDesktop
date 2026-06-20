<script setup lang="ts">
import type { RoleData } from '@/types'
import { useAllDataStore } from '@/stores/allData'
import { useNovel } from '@/composables/useNovel'

const props = defineProps<{
  roleData: RoleData
  deletable?: boolean
  isMainRole?: boolean
}>()

const emit = defineEmits<{
  delete: []
}>()

const store = useAllDataStore()
const { novelId } = useNovel()

// 本地响应式副本
const data = reactive<RoleData>({
  roleName: props.roleData.roleName,
  roleDescription: props.roleData.roleDescription,
  relationshipToMainRole: props.roleData.relationshipToMainRole,
})

watch(
  () => props.roleData,
  (r) => {
    if (r) {
      data.roleName = r.roleName
      data.roleDescription = r.roleDescription
      data.relationshipToMainRole = r.relationshipToMainRole
    }
  },
  { immediate: true },
)

function syncToParent() {
  store.updateMainRole(novelId.value, {
    roleName: data.roleName,
    roleDescription: data.roleDescription,
    relationshipToMainRole: data.relationshipToMainRole,
  })
}
</script>

<template>
  <n-card size="small" style="margin-bottom: 12px;">
    <n-space vertical>
      <n-form-item label="姓名" label-placement="left">
        <n-input
          v-model:value="data.roleName"
          placeholder="角色姓名"
          @update:value="syncToParent"
        />
      </n-form-item>
      <n-form-item label="描述" label-placement="left">
        <n-input
          v-model:value="data.roleDescription"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="角色描述"
          @update:value="syncToParent"
        />
      </n-form-item>
      <n-form-item label="与主角关系" label-placement="left">
        <n-input
          v-model:value="data.relationshipToMainRole"
          :disabled="isMainRole"
          placeholder="如：青梅竹马、宿敌、师傅..."
          @update:value="syncToParent"
        />
      </n-form-item>
    </n-space>
    <template #header-extra>
      <n-button
        v-if="deletable"
        text
        type="error"
        size="small"
        @click="emit('delete')"
      >
        ✕
      </n-button>
    </template>
  </n-card>
</template>
