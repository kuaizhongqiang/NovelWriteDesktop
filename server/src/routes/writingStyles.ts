import { Router, type Request, type Response } from 'express'
import { queryFirst, queryAll, execute } from '../db/query.js'
import { createId, nowISO } from '../types/index.js'

const router = Router()

// GET /api/writing-styles
router.get('/', (_req: Request, res: Response) => {
  const rows = queryAll('SELECT * FROM writing_styles ORDER BY created DESC')
  res.json({ writingStyles: rows })
})

// POST /api/writing-styles
router.post('/', (req: Request, res: Response) => {
  const now = nowISO()
  const id = createId()
  const { name, charPerChapter, fullStoryLength, baseTone } = req.body

  execute(
    `INSERT INTO writing_styles (id, name, char_per_chapter_min, char_per_chapter_max, full_story_length, base_tone, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name || '未命名预设', charPerChapter?.min ?? 1000, charPerChapter?.max ?? 3000, fullStoryLength ?? 100000, baseTone ?? '', now, now],
    { tx: true, persist: true },
  )

  const created = queryFirst('SELECT * FROM writing_styles WHERE id = ?', [id])
  res.status(201).json(created)
})

// PUT /api/writing-styles/:id
router.put('/:id', (req: Request, res: Response) => {
  const existing = queryFirst<{ id: string }>('SELECT id FROM writing_styles WHERE id = ?', [req.params.id])
  if (!existing) { res.status(404).json({ error: 'Writing style not found' }); return }

  const sets: string[] = ["updated = ?"]
  const params: unknown[] = [nowISO()]

  const body = req.body
  if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name) }
  if (body.charPerChapter?.min !== undefined) { sets.push('char_per_chapter_min = ?'); params.push(body.charPerChapter.min) }
  if (body.charPerChapter?.max !== undefined) { sets.push('char_per_chapter_max = ?'); params.push(body.charPerChapter.max) }
  if (body.fullStoryLength !== undefined) { sets.push('full_story_length = ?'); params.push(body.fullStoryLength) }
  if (body.baseTone !== undefined) { sets.push('base_tone = ?'); params.push(body.baseTone) }

  params.push(req.params.id)
  execute(
    `UPDATE writing_styles SET ${sets.join(', ')} WHERE id = ?`,
    params,
    { tx: true, persist: true },
  )

  const updated = queryFirst('SELECT * FROM writing_styles WHERE id = ?', [req.params.id])
  res.json(updated)
})

// DELETE /api/writing-styles/:id
router.delete('/:id', (req: Request, res: Response) => {
  const existing = queryFirst<{ id: string }>('SELECT id FROM writing_styles WHERE id = ?', [req.params.id])
  if (!existing) { res.status(404).json({ error: 'Writing style not found' }); return }

  execute('DELETE FROM writing_styles WHERE id = ?', [req.params.id], { tx: true, persist: true })
  res.json({ ok: true })
})

export default router
