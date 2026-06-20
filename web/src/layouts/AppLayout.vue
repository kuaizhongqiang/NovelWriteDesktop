<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import AgentBar from '@/components/AgentBar.vue'

const route = useRoute()
const router = useRouter()
const { isDark, toggleTheme } = useTheme()

const agentCollapsed = ref(false)

const novelId = computed(() => route.params.id as string | undefined)
const currentPage = computed(() => route.name as string | undefined)

const navItems = computed(() => {
  const id = novelId.value
  const base = id ? `/novel/${id}` : ''
  return [
    { name: 'dashboard', label: 'Dashboard', to: '/', enabled: true },
    { name: 'read', label: '阅读', to: `${base}/read`, enabled: !!id },
    { name: 'settings', label: '基础设定', to: `${base}/settings`, enabled: !!id },
    { name: 'roles', label: '角色设定', to: `${base}/roles`, enabled: !!id },
    { name: 'outline', label: '大纲设定', to: `${base}/outline`, enabled: !!id },
    { name: 'write', label: '写作', to: `${base}/write`, enabled: !!id },
    { name: 'style', label: '写作风格', to: `${base}/style`, enabled: !!id },
  ]
})

function handleNavClick(item: { to: string; enabled: boolean }) {
  if (item.enabled && item.to) {
    router.push(item.to)
  }
}
</script>

<template>
  <n-layout position="absolute" style="height: 100%">
    <!-- 顶部导航 -->
    <n-layout-header
      bordered
      style="
        height: 48px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        gap: 4px;
      "
    >
      <span style="font-weight: 700; font-size: 16px; margin-right: 16px; white-space: nowrap;">
        📖 NovelWrite
      </span>
      <n-space size="small">
        <n-button
          v-for="item in navItems"
          :key="item.name"
          :type="route.name === item.name ? 'primary' : 'default'"
          :disabled="!item.enabled"
          size="tiny"
          @click="handleNavClick(item)"
        >
          {{ item.label }}
        </n-button>
      </n-space>
      <div style="margin-left: auto;">
        <n-button text size="small" @click="toggleTheme" style="font-size: 18px;">
          {{ isDark ? '☀️' : '🌙' }}
        </n-button>
      </div>
    </n-layout-header>

    <!-- 主体：内容区 + Agent Bar -->
    <n-layout has-sider position="absolute" style="top: 48px; bottom: 0">
      <n-layout-content style="padding: 24px; overflow-y: auto;">
        <router-view />
      </n-layout-content>

      <!-- Agent Bar -->
      <AgentBar
        :collapsed="agentCollapsed"
        :novel-id="novelId"
        :current-page="currentPage"
        @toggle="agentCollapsed = !agentCollapsed"
      />
    </n-layout>
  </n-layout>
</template>
