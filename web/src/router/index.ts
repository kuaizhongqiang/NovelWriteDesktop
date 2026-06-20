import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { isLoggedIn } from '@/api'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { title: '登录', guest: true },
  },
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

// ============ 全局导航守卫：未保存更改提示 + 登录检查 ============

let _isDirty = false

export function setNavigationDirty(dirty: boolean) {
  _isDirty = dirty
}

export function isNavigationDirty(): boolean {
  return _isDirty
}

router.beforeEach((to, _from) => {
  // 未登录且不是 guest 页面 → 跳转登录
  if (!isLoggedIn() && to.name !== 'login') {
    return { name: 'login' }
  }
  // 已登录且访问登录页 → 跳转首页
  if (isLoggedIn() && to.name === 'login') {
    return { name: 'dashboard' }
  }

  // 未保存更改提示
  if (_isDirty && to.name !== 'login') {
    const ok = window.confirm('有未保存的更改，确定离开吗？')
    if (!ok) return false
    _isDirty = false
  }
  return true
})

// 浏览器关闭/刷新提示
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (_isDirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}

export default router
