import { Router, type Request, type Response } from 'express'
import { getDb, persistDb } from '../db/index.js'
import { createId, nowISO, type Novel } from '../types/index.js'

const router = Router()

// ============ 类型转换 ============

function rowToNovel(row: Record<string, any>): Novel {
  return {
    id: row.id,
    title: row.title,
    novelBaseData: JSON.parse(row.novel_base_data || '{}'),
    roleList: JSON.parse(row.role_list || '{}'),
    outline: JSON.parse(row.outline || '{}'),
    chapterList: JSON.parse(row.chapter_list || '{}'),
    writingStyle: JSON.parse(row.writing_style || '{}'),
    created: row.created,
    updated: row.updated,
    isOpen: Boolean(row.is_open),
  }
}

function execGet(db: any, sql: string): Record<string, any> | null {
  const rows = db.exec(sql)
  if (!rows[0]?.values?.length) { return null }
  const cols = rows[0].columns
  const vals = rows[0].values[0]
  const row: Record<string, any> = {}
  cols.forEach((c: string, i: number) => { row[c] = vals[i] })
  return row
}

function execAll(db: any, sql: string): Record<string, any>[] {
  const rows = db.exec(sql)
  if (!rows[0]?.values?.length) { return [] }
  const cols = rows[0].columns
  return rows[0].values.map((vals: any[]) => {
    const row: Record<string, any> = {}
    cols.forEach((c: string, i: number) => { row[c] = vals[i] })
    return row
  })
}

function sq(s: string): string {
  return s.replace(/'/g, "''")
}

// ============ GET /api/novels — 小说列表（摘要） ============

router.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const rows = execAll(db, 'SELECT id, title, chapter_list, created, updated, is_open FROM novels ORDER BY updated DESC')

  const novels = rows.map(r => {
    const cl = JSON.parse(r.chapter_list || '{}')
    const words = (cl.chapters || []).reduce((s: number, ch: any) => s + (ch.content?.length || 0), 0)
    return {
      id: r.id,
      title: r.title,
      wordCount: words,
      chapterCount: (cl.chapters || []).length,
      created: r.created,
      updated: r.updated,
      isOpen: Boolean(r.is_open),
    }
  })

  res.json({ novels })
})

// ============ GET /api/novels/:id — 完整小说 ============

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const row = execGet(db, `SELECT * FROM novels WHERE id = '${sq((req.params.id as string))}'`)
  if (!row) { res.status(404).json({ error: 'Novel not found' }); return }
  res.json(rowToNovel(row))
})

// ============ POST /api/novels — 新建 ============

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const now = nowISO()
  const id = createId()

  const novel = {
    id,
    title: req.body.title || '未命名小说',
    novel_base_data: JSON.stringify(req.body.novelBaseData ?? { description: '', oneWord: '', genre: '', tags: [] }),
    role_list: JSON.stringify(req.body.roleList ?? { mainRole: { roleName: '', roleDescription: '', relationshipToMainRole: '自身' }, femaleRoles: [], supportingRoles: [] }),
    outline: JSON.stringify(req.body.outline ?? { mainRoleSuperpower: '', worldView: '', writingKeyPoints: '', outlinePhases: [] }),
    chapter_list: JSON.stringify(req.body.chapterList ?? { chapters: [] }),
    writing_style: JSON.stringify(req.body.writingStyle ?? { id: createId(), name: '默认风格', charPerChapter: { min: 1000, max: 3000 }, fullStoryLength: 100000, baseTone: '' }),
    created: now,
    updated: now,
    is_open: req.body.isOpen !== false ? 1 : 0,
  }

  db.run(`INSERT INTO novels VALUES ('${sq(novel.id)}','${sq(novel.title)}','${sq(novel.novel_base_data)}','${sq(novel.role_list)}','${sq(novel.outline)}','${sq(novel.chapter_list)}','${sq(novel.writing_style)}','${novel.created}','${novel.updated}',${novel.is_open})`)
  persistDb()

  const created = execGet(db, `SELECT * FROM novels WHERE id = '${sq(id)}'`)
  res.status(201).json(rowToNovel(created!))
})

// ============ PUT /api/novels/:id — 更新 ============

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const row = execGet(db, `SELECT * FROM novels WHERE id = '${sq((req.params.id as string))}'`)
  if (!row) { res.status(404).json({ error: 'Novel not found' }); return }

  const existing = rowToNovel(row)
  const body = req.body
  const now = nowISO()

  // Merge base data
  if (body.title !== undefined) { existing.title = body.title }
  if (body.novelBaseData) {
    Object.assign(existing.novelBaseData, body.novelBaseData)
  }
  if (body.roleList) {
    Object.assign(existing.roleList, body.roleList)
  }
  if (body.outline) {
    Object.assign(existing.outline, body.outline)
  }
  if (body.chapterList) {
    existing.chapterList = body.chapterList
  }
  if (body.writingStyle) {
    Object.assign(existing.writingStyle, body.writingStyle)
  }
  if (body.isOpen !== undefined) { existing.isOpen = body.isOpen }

  const sql = `UPDATE novels SET
    title = '${sq(existing.title)}',
    novel_base_data = '${sq(JSON.stringify(existing.novelBaseData))}',
    role_list = '${sq(JSON.stringify(existing.roleList))}',
    outline = '${sq(JSON.stringify(existing.outline))}',
    chapter_list = '${sq(JSON.stringify(existing.chapterList))}',
    writing_style = '${sq(JSON.stringify(existing.writingStyle))}',
    updated = '${now}',
    is_open = ${existing.isOpen ? 1 : 0}
    WHERE id = '${sq((req.params.id as string))}'`
  db.run(sql)
  persistDb()

  const updated = execGet(db, `SELECT * FROM novels WHERE id = '${sq((req.params.id as string))}'`)
  res.json(rowToNovel(updated!))
})

// ============ DELETE /api/novels/:id — 删除 ============

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const row = execGet(db, `SELECT id FROM novels WHERE id = '${sq((req.params.id as string))}'`)
  if (!row) { res.status(404).json({ error: 'Novel not found' }); return }
  db.run(`DELETE FROM novels WHERE id = '${sq((req.params.id as string))}'`)
  persistDb()
  res.json({ ok: true })
})

export default router
