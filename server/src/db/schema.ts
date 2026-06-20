import type { Database as SqlJsDatabase } from 'sql.js'

export function createAllTables(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS novels (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL DEFAULT '未命名小说',
      novel_base_data TEXT NOT NULL DEFAULT '{}',
      role_list       TEXT NOT NULL DEFAULT '{}',
      outline         TEXT NOT NULL DEFAULT '{}',
      chapter_list    TEXT NOT NULL DEFAULT '{}',
      writing_style   TEXT NOT NULL DEFAULT '{}',
      created         TEXT NOT NULL,
      updated         TEXT NOT NULL,
      is_open         INTEGER NOT NULL DEFAULT 1
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS writing_styles (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL DEFAULT '默认风格',
      char_per_chapter_min INTEGER NOT NULL DEFAULT 1000,
      char_per_chapter_max INTEGER NOT NULL DEFAULT 3000,
      full_story_length    INTEGER NOT NULL DEFAULT 100000,
      base_tone            TEXT NOT NULL DEFAULT '',
      created              TEXT NOT NULL,
      updated              TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS auth_keys (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      key_hash    TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      revoked     INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_password (
      id            INTEGER PRIMARY KEY DEFAULT 1,
      password_hash TEXT NOT NULL,
      created       TEXT NOT NULL,
      updated       TEXT NOT NULL
    )
  `)
}
