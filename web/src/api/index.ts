import type { Novel, WritingStyle } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002/api'

// ============ Token 管理 ============

const TOKEN_KEY = 'novelwrite-api-key'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return !!getStoredToken()
}

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
  const token = getStoredToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error || 'Request failed')
  }

  return res.json()
}

// ============ Auth API ============

export const authApi = {
  login: (key: string) =>
    request<{ ok: boolean; id: string; name: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ key }),
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
