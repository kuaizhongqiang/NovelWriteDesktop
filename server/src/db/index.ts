import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { createAllTables } from './schema.js'

let db: SqlJsDatabase | null = null
let dbPath: string = ''

/**
 * 初始化数据库连接（异步，sql.js 需要加载 WASM）
 * 首次调用时创建表结构
 */
export async function initDb(filePath?: string): Promise<SqlJsDatabase> {
  dbPath = filePath || process.env.NOVELWRITE_DB_PATH || './novelwrite.db'

  const SQL = await initSqlJs()

  const fullPath = path.resolve(dbPath)
  if (fs.existsSync(fullPath)) {
    const buffer = fs.readFileSync(fullPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  createAllTables(db)
  persistDb()
  return db
}

/**
 * 获取当前数据库实例
 */
export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

/**
 * 将内存中的数据库写入磁盘
 */
export function persistDb(): void {
  if (!db || !dbPath) return
  const data = db.export()
  const fullPath = path.resolve(dbPath)
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(fullPath, Buffer.from(data))
}

/**
 * 关闭数据库连接（自动保存）
 */
export function closeDb(): void {
  if (db) {
    persistDb()
    db.close()
    db = null
  }
}

/**
 * 检查数据库是否已初始化
 */
export function isInitialized(): boolean {
  return db !== null
}

export type { SqlJsDatabase }
