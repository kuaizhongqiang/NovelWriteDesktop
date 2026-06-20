/**
 * 参数化查询模块测试
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDb, closeDb } from '../db/index.js'
import { queryFirst, queryAll, execute } from '../db/query.js'

beforeAll(async () => {
  // 用内存数据库测试（不传路径 = 默认）
  await initDb(':memory:')
})

afterAll(() => {
  closeDb()
})

describe('execute - INSERT', () => {
  it('should insert a writing style', () => {
    execute(
      'INSERT INTO writing_styles (id, name, char_per_chapter_min, char_per_chapter_max, full_story_length, base_tone, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['test-id-1', '测试风格', 1000, 3000, 100000, '热血', '2026-01-01', '2026-01-01'],
    )

    const row = queryFirst<{ name: string; base_tone: string }>(
      'SELECT name, base_tone FROM writing_styles WHERE id = ?',
      ['test-id-1'],
    )
    expect(row).not.toBeNull()
    expect(row!.name).toBe('测试风格')
    expect(row!.base_tone).toBe('热血')
  })
})

describe('execute - UPDATE', () => {
  it('should update a writing style', () => {
    execute(
      'UPDATE writing_styles SET name = ? WHERE id = ?',
      ['更新后的风格', 'test-id-1'],
    )

    const row = queryFirst<{ name: string }>('SELECT name FROM writing_styles WHERE id = ?', ['test-id-1'])
    expect(row!.name).toBe('更新后的风格')
  })
})

describe('queryAll', () => {
  it('should return all matching rows', () => {
    execute(
      'INSERT INTO writing_styles (id, name, char_per_chapter_min, char_per_chapter_max, full_story_length, base_tone, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['test-id-2', '风格2', 2000, 4000, 200000, '轻松', '2026-01-02', '2026-01-02'],
    )

    const rows = queryAll<{ name: string }>('SELECT name FROM writing_styles ORDER BY created ASC')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })
})

describe('execute - DELETE', () => {
  it('should delete a record', () => {
    execute('DELETE FROM writing_styles WHERE id = ?', ['test-id-1'])
    const row = queryFirst('SELECT id FROM writing_styles WHERE id = ?', ['test-id-1'])
    expect(row).toBeNull()
  })
})

describe('SQL injection prevention', () => {
  it('should not allow SQL injection via params', () => {
    const malicious = "'; DROP TABLE writing_styles; --"
    execute(
      'INSERT INTO writing_styles (id, name, char_per_chapter_min, char_per_chapter_max, full_story_length, base_tone, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['inj-test', malicious, 1000, 3000, 100000, '', '2026-01-01', '2026-01-01'],
    )

    // 表仍然存在
    const tableCheck = queryFirst("SELECT name FROM sqlite_master WHERE type='table' AND name='writing_styles'")
    expect(tableCheck).not.toBeNull()

    // 数据正确插入（含恶意字符串本身，没有被当作 SQL 执行）
    const row = queryFirst<{ name: string }>('SELECT name FROM writing_styles WHERE id = ?', ['inj-test'])
    expect(row!.name).toBe(malicious)

    // 清理
    execute('DELETE FROM writing_styles WHERE id = ?', ['inj-test'])
  })
})
