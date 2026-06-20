/**
 * 错误报告工具
 *
 * 在 Naive UI provider 上下文中使用 useNotification 显示错误通知。
 * 组件中推荐直接使用 useMessage() / useNotification()，
 * 此工具用于非组件上下文（如 Store action 中的 catch）。
 */

import type { NotificationApiInjection } from 'naive-ui/es/notification/src/NotificationProvider'

let _notify: NotificationApiInjection | null = null

export function setNotificationHandler(handler: NotificationApiInjection) {
  _notify = handler
}

export function reportError(title: string, content: string, duration = 5000) {
  console.error(`[Error] ${title}: ${content}`)
  try {
    _notify?.error({ title, content, duration })
  } catch {
    // 静默失败
  }
}

export function reportWarning(title: string, content: string, duration = 4000) {
  console.warn(`[Warning] ${title}: ${content}`)
  try {
    _notify?.warning({ title, content, duration })
  } catch {
    // 静默失败
  }
}
