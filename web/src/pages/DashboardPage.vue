<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAllDataStore } from '@/stores/allData'
import NovelCard from '@/components/NovelCard.vue'

const store = useAllDataStore()
const router = useRouter()

function createNewNovel() {
  const novel = store.addNovel()
  router.push(`/novel/${novel.id}/settings`)
}
</script>

<template>
  <div>
    <n-h2>我的小说</n-h2>

    <n-grid v-if="store.data.novels.length" cols="1 400:2 700:3 1000:4" :x-gap="16" :y-gap="16">
      <n-grid-item v-for="novel in store.data.novels" :key="novel.id">
        <NovelCard :novel="novel" />
      </n-grid-item>

      <!-- 新建卡片 -->
      <n-grid-item>
        <n-card
          hoverable
          style="height: 100%; display: flex; align-items: center; justify-content: center;"
          :content-style="{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer' }"
          @click="createNewNovel"
        >
          <div style="text-align: center; padding: 32px 0;">
            <div style="font-size: 40px; line-height: 1; color: #aaa;">+</div>
            <div style="margin-top: 8px; color: #888;">新建小说</div>
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 空状态 -->
    <div v-else style="text-align: center; padding: 80px 0;">
      <n-empty description="还没有小说，开始创作你的第一部作品吧！">
        <template #icon>
          <span style="font-size: 48px;">📝</span>
        </template>
      </n-empty>
      <n-button type="primary" size="large" style="margin-top: 24px;" @click="createNewNovel">
        新建小说
      </n-button>
    </div>
  </div>
</template>
