/**
 * API 客户端
 *
 * 认证由 Cookie Session 自动管理，前端不存储 Token。
 * 401 时跳转登录页。
 */
import type { Novel, WritingStyle } from '@/types'
import router from '@/router'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002/api'

// ============ HTTP 客户端 ============

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
    credentials: 'include',
  })

  if (res.status === 401) {
    router.push('/login')
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error || 'Request failed')
  }

  return res.json()
}

// ============ Auth 状态检测 ============

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' })
    if (!res.ok) return false
    const data = await res.json()
    return data.loggedIn === true
  } catch {
    return false
  }
}

// ============ Auth API ============

export const authApi = {
  login: (password: string) =>
    request<{ ok: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () =>
    request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
    }),
  status: () =>
    request<{ loggedIn: boolean }>('/auth/status'),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
}

// ============ Novels API ============

export interface NovelSummary {
  id: string
  title: string
  wordCount: number
  chapterCount: number
  created: string
  updated: string
  isOpen: boolean
}

export const novelsApi = {
  list: () =>
    request<{ novels: NovelSummary[] }>('/novels'),

  get: (id: string) =>
    request<Novel>(`/novels/${id}`),

  create: (data: Partial<Novel>) =>
    request<Novel>('/novels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Novel>) =>
    request<Novel>(`/novels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ ok: boolean }>(`/novels/${id}`, {
      method: 'DELETE',
    }),
}

// ============ Writing Styles API ============

export const writingStylesApi = {
  list: () =>
    request<{ writingStyles: WritingStyle[] }>('/writing-styles'),

  create: (data: Partial<WritingStyle>) =>
    request<WritingStyle>('/writing-styles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<WritingStyle>) =>
    request<WritingStyle>(`/writing-styles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ ok: boolean }>(`/writing-styles/${id}`, {
      method: 'DELETE',
    }),
}

export { ApiError }
