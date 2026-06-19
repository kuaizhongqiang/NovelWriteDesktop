<script setup lang="ts">
</script>

<template>
  <n-message-provider>
    <n-dialog-provider>
      <n-notification-provider>
        <n-layout position="absolute">
          <n-layout-header bordered>
            <n-h1 style="margin: 0; padding: 16px 24px; font-size: 20px;">
              NovelWrite — 小说写作平台
            </n-h1>
          </n-layout-header>
          <n-layout-content
            position="absolute"
            style="top: 58px; bottom: 0; padding: 24px;"
          >
            <n-space vertical>
              <n-card title="欢迎">
                <n-empty description="项目初始化完成，敬请期待后续开发" />
              </n-card>
            </n-space>
          </n-layout-content>
        </n-layout>
      </n-notification-provider>
    </n-dialog-provider>
  </n-message-provider>
</template>
