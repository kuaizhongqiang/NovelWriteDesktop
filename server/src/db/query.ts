/**
 * 参数化查询辅助模块
 *
 * 替代所有 `sq()` 字符串拼接，使用 sql.js 的参数化查询 API。
 * 支持事务包裹、自动持久化。
 */
import type { Database as SqlJsDatabase } from 'sql.js'
import { getDb, persistDb } from './index.js'

// ============ 单行查询 ============

/**
 * 参数化 SELECT 查询，返回第一行（或 null）
 *
 * @example
 * ```ts
 * const row = queryFirst<{ id: string; title: string }>(
 *   'SELECT id, title FROM novels WHERE id = ?',
 *   [novelId],
 * )
 * ```
 */
export function queryFirst<T extends Record<string, any>>(
  sql: string,
  params: unknown[] = [],
): T | null {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject() as T
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

// ============ 多行查询 ============

/**
 * 参数化 SELECT 查询，返回所有匹配行
 */
export function queryAll<T extends Record<string, any>>(
  sql: string,
  params: unknown[] = [],
): T[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

// ============ 写操作 ============

/**
 * 参数化 INSERT / UPDATE / DELETE，支持事务和自动持久化
 *
 * @param sql — SQL 语句，参数用 ? 占位
 * @param params — 参数数组
 * @param options.persist — 是否立即持久化到磁盘（默认 false，依赖定时器）
 * @param options.txPrefix — 是否在语句前加 BEGIN/COMMIT
 */
export function execute(
  sql: string,
  params: unknown[] = [],
  options?: { persist?: boolean; tx?: boolean },
): void {
  const db = getDb()

  if (options?.tx) {
    db.run('BEGIN')
    try {
      db.run(sql, params)
      db.run('COMMIT')
    } catch (err) {
      db.run('ROLLBACK')
      throw err
    }
  } else {
    db.run(sql, params)
  }

  if (options?.persist) {
    persistDb()
  }
}

/**
 * 在事务中执行多个写操作
 */
export function executeInTransaction(queries: { sql: string; params: unknown[] }[]): void {
  const db = getDb()
  db.run('BEGIN')
  try {
    for (const { sql, params } of queries) {
      db.run(sql, params)
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}

// ============ 批量更新（用于 CLI 的 JSON 字段修改模式） ==========

/**
 * 更新小说的 JSON 列（如 outline, role_list, chapter_list）
 * 读取 → 内存修改 → 写回的流程包裹在事务中
 */
export function patchNovelJsonField(
  novelId: string,
  field: string, // 数据库列名，如 outline, role_list
  mutator: (data: Record<string, unknown>) => Record<string, unknown>,
): void {
  const db = getDb()
  db.run('BEGIN')
  try {
    const stmt = db.prepare(`SELECT ${field} FROM novels WHERE id = ?`)
    stmt.bind([novelId])
    if (!stmt.step()) {
      stmt.free()
      db.run('ROLLBACK')
      throw new Error(`Novel not found: ${novelId}`)
    }
    const row = stmt.getAsObject() as Record<string, string>
    const current = JSON.parse(row[field] || '{}')
    const updated = mutator(current)
    db.run(`UPDATE novels SET ${field} = ?, updated = datetime('now') WHERE id = ?`, [
      JSON.stringify(updated), novelId,
    ])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}
