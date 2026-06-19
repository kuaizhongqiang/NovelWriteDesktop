import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { title: '我的小说' },
  },
  {
    path: '/novel/:id/read',
    name: 'read',
    component: () => import('@/pages/ReadPage.vue'),
    meta: { title: '阅读' },
  },
  {
    path: '/novel/:id/settings',
    name: 'settings',
    component: () => import('@/pages/SettingsPage.vue'),
    meta: { title: '基础设定' },
  },
  {
    path: '/novel/:id/roles',
    name: 'roles',
    component: () => import('@/pages/RolesPage.vue'),
    meta: { title: '角色设定' },
  },
  {
    path: '/novel/:id/outline',
    name: 'outline',
    component: () => import('@/pages/OutlinePage.vue'),
    meta: { title: '大纲设定' },
  },
  {
    path: '/novel/:id/write',
    name: 'write',
    component: () => import('@/pages/WritePage.vue'),
    meta: { title: '写作' },
  },
  {
    path: '/novel/:id/style',
    name: 'style',
    component: () => import('@/pages/StylePage.vue'),
    meta: { title: '写作风格' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
