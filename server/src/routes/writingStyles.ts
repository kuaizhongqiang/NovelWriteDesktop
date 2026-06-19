import { Router, type Request, type Response } from 'express'
import { getDb, persistDb } from '../db/index.js'
import { createId, nowISO } from '../types/index.js'

const router = Router()

function sq(s: string): string {
  return s.replace(/'/g, "''")
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

function execGet(db: any, sql: string): Record<string, any> | null {
  const rows = db.exec(sql)
  if (!rows[0]?.values?.length) { return null }
  const cols = rows[0].columns
  const vals = rows[0].values[0]
  const row: Record<string, any> = {}
  cols.forEach((c: string, i: number) => { row[c] = vals[i] })
  return row
}

// GET /api/writing-styles
router.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const rows = execAll(db, 'SELECT * FROM writing_styles ORDER BY created DESC')
  res.json({ writingStyles: rows })
})

// POST /api/writing-styles
router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const now = nowISO()
  const id = createId()
  const { name, charPerChapter, fullStoryLength, baseTone } = req.body

  db.run(`INSERT INTO writing_styles (id, name, char_per_chapter_min, char_per_chapter_max, full_story_length, base_tone, created, updated)
    VALUES ('${id}', '${sq(name || '未命名预设')}', ${charPerChapter?.min ?? 1000}, ${charPerChapter?.max ?? 3000}, ${fullStoryLength ?? 100000}, '${sq(baseTone ?? '')}', '${now}', '${now}')`)
  persistDb()

  const created = execGet(db, `SELECT * FROM writing_styles WHERE id = '${sq(id)}'`)
  res.status(201).json(created)
})

// PUT /api/writing-styles/:id
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const existing = execGet(db, `SELECT id FROM writing_styles WHERE id = '${sq((req.params.id as string))}'`)
  if (!existing) { res.status(404).json({ error: 'Writing style not found' }); return }

  const sets: string[] = [`updated = '${nowISO()}'`]
  const body = req.body
  if (body.name !== undefined) { sets.push(`name = '${sq(body.name)}'`) }
  if (body.charPerChapter?.min !== undefined) { sets.push(`char_per_chapter_min = ${body.charPerChapter.min}`) }
  if (body.charPerChapter?.max !== undefined) { sets.push(`char_per_chapter_max = ${body.charPerChapter.max}`) }
  if (body.fullStoryLength !== undefined) { sets.push(`full_story_length = ${body.fullStoryLength}`) }
  if (body.baseTone !== undefined) { sets.push(`base_tone = '${sq(body.baseTone)}'`) }

  db.run(`UPDATE writing_styles SET ${sets.join(', ')} WHERE id = '${sq((req.params.id as string))}'`)
  persistDb()

  const updated = execGet(db, `SELECT * FROM writing_styles WHERE id = '${sq((req.params.id as string))}'`)
  res.json(updated)
})

// DELETE /api/writing-styles/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const existing = execGet(db, `SELECT id FROM writing_styles WHERE id = '${sq((req.params.id as string))}'`)
  if (!existing) { res.status(404).json({ error: 'Writing style not found' }); return }
  db.run(`DELETE FROM writing_styles WHERE id = '${sq((req.params.id as string))}'`)
  persistDb()
  res.json({ ok: true })
})

export default router
