<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNovel } from '@/composables/useNovel'
import { useAllDataStore } from '@/stores/allData'
import type { RoleData } from '@/types'
import RoleEditor from '@/components/RoleEditor.vue'

const { novelId, novel } = useNovel()
const store = useAllDataStore()
const router = useRouter()
const message = useMessage()

function addFemaleRole() {
  if (!novel.value) return
  const newRole: RoleData = {
    roleName: '',
    roleDescription: '',
    relationshipToMainRole: '',
  }
  novel.value.roleList.femaleRoles.push(newRole)
  store.saveNow()
}

function removeFemaleRole(index: number) {
  if (!novel.value) return
  novel.value.roleList.femaleRoles.splice(index, 1)
  store.saveNow()
}

function addSupportingRole() {
  if (!novel.value) return
  const newRole: RoleData = {
    roleName: '',
    roleDescription: '',
    relationshipToMainRole: '',
  }
  novel.value.roleList.supportingRoles.push(newRole)
  store.saveNow()
}

function removeSupportingRole(index: number) {
  if (!novel.value) return
  novel.value.roleList.supportingRoles.splice(index, 1)
  store.saveNow()
}

function handleSave() {
  if (novel.value) {
    store.updateNovel(novelId.value, {
      roleList: { ...novel.value.roleList },
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
    <n-h2>角色设定</n-h2>

    <!-- 男主角 -->
    <n-divider>男主角</n-divider>
    <RoleEditor
      :role-data="novel.roleList.mainRole"
      :is-main-role="true"
    />

    <!-- 女主角 -->
    <n-divider>女主角</n-divider>
    <div v-if="novel.roleList.femaleRoles.length === 0" style="color: #888; font-size: 13px; margin-bottom: 12px;">
      暂无女主角
    </div>
    <RoleEditor
      v-for="(role, idx) in novel.roleList.femaleRoles"
      :key="idx"
      :role-data="role"
      :deletable="true"
      @delete="removeFemaleRole(idx)"
    />
    <n-button size="small" secondary @click="addFemaleRole">
      + 新增女主角
    </n-button>

    <!-- 配角 -->
    <n-divider>配角</n-divider>
    <div v-if="novel.roleList.supportingRoles.length === 0" style="color: #888; font-size: 13px; margin-bottom: 12px;">
      暂无配角
    </div>
    <RoleEditor
      v-for="(role, idx) in novel.roleList.supportingRoles"
      :key="idx"
      :role-data="role"
      :deletable="true"
      @delete="removeSupportingRole(idx)"
    />
    <n-button size="small" secondary @click="addSupportingRole">
      + 新增配角
    </n-button>

    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
      <n-button @click="handleCancel">取消</n-button>
      <n-button type="primary" @click="handleSave">保存</n-button>
    </div>
  </div>

  <div v-else>
    <n-empty description="小说不存在" />
  </div>
</template>
