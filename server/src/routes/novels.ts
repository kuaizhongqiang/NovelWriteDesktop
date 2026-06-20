import { Router, type Request, type Response } from 'express'
import { getDb } from '../db/index.js'
import { queryFirst, queryAll, execute } from '../db/query.js'
import { createId, nowISO, type Novel } from '../types/index.js'

const router = Router()

// ============ 类型转换 ============

interface NovelRow {
  id: string
  title: string
  novel_base_data: string
  role_list: string
  outline: string
  chapter_list: string
  writing_style: string
  created: string
  updated: string
  is_open: number
  [key: string]: unknown
}

function rowToNovel(row: NovelRow): Novel {
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

// ============ 输入校验 ============

function validateNovelInput(body: any): string | null {
  if (body.title !== undefined && typeof body.title === 'string' && body.title.length > 200) {
    return 'Title must be 200 characters or less'
  }
  if (body.novelBaseData?.description && body.novelBaseData.description.length > 10000) {
    return 'Description must be 10000 characters or less'
  }
  if (body.chapterList?.chapters) {
    for (const ch of body.chapterList.chapters) {
      if (ch.content && ch.content.length > 500_000) {
        return 'Each chapter content must be 500KB or less'
      }
    }
  }
  return null
}

function novelToParams(novel: Partial<Novel & { id?: string }>) {
  return [
    novel.id ?? '',
    novel.title ?? '未命名小说',
    JSON.stringify(novel.novelBaseData ?? { description: '', oneWord: '', genre: '', tags: [] }),
    JSON.stringify(novel.roleList ?? { mainRole: { roleName: '', roleDescription: '', relationshipToMainRole: '自身' }, femaleRoles: [], supportingRoles: [] }),
    JSON.stringify(novel.outline ?? { mainRoleSuperpower: '', worldView: '', writingKeyPoints: '', outlinePhases: [] }),
    JSON.stringify(novel.chapterList ?? { chapters: [] }),
    JSON.stringify(novel.writingStyle ?? { id: createId(), name: '默认风格', charPerChapter: { min: 1000, max: 3000 }, fullStoryLength: 100000, baseTone: '' }),
  ]
}

// ============ GET /api/novels — 小说列表（摘要） ============

router.get('/', (_req: Request, res: Response) => {
  const rows = queryAll<NovelRow>('SELECT id, title, chapter_list, created, updated, is_open FROM novels ORDER BY updated DESC')

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
  const row = queryFirst<NovelRow>('SELECT * FROM novels WHERE id = ?', [req.params.id])
  if (!row) { res.status(404).json({ error: 'Novel not found' }); return }
  res.json(rowToNovel(row))
})

// ============ POST /api/novels — 新建 ============

router.post('/', (req: Request, res: Response) => {
  const validationError = validateNovelInput(req.body)
  if (validationError) { res.status(400).json({ error: validationError }); return }

  const now = nowISO()
  const id = createId()
  const params = novelToParams({ ...req.body, id })

  execute(
    `INSERT INTO novels (id, title, novel_base_data, role_list, outline, chapter_list, writing_style, created, updated, is_open)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...params, now, now, req.body.isOpen !== false ? 1 : 0],
    { tx: true, persist: true },
  )

  const created = queryFirst<NovelRow>('SELECT * FROM novels WHERE id = ?', [id])
  res.status(201).json(rowToNovel(created!))
})

// ============ PUT /api/novels/:id — 更新 ============

router.put('/:id', (req: Request, res: Response) => {
  const validationError = validateNovelInput(req.body)
  if (validationError) { res.status(400).json({ error: validationError }); return }

  const existing = queryFirst<NovelRow>('SELECT * FROM novels WHERE id = ?', [req.params.id])
  if (!existing) { res.status(404).json({ error: 'Novel not found' }); return }

  const novel = rowToNovel(existing)
  const body = req.body

  if (body.title !== undefined) { novel.title = body.title }
  if (body.novelBaseData) { Object.assign(novel.novelBaseData, body.novelBaseData) }
  if (body.roleList) { Object.assign(novel.roleList, body.roleList) }
  if (body.outline) { Object.assign(novel.outline, body.outline) }
  if (body.chapterList) { novel.chapterList = body.chapterList }
  if (body.writingStyle) { Object.assign(novel.writingStyle, body.writingStyle) }
  if (body.isOpen !== undefined) { novel.isOpen = body.isOpen }

  execute(
    `UPDATE novels SET title = ?, novel_base_data = ?, role_list = ?, outline = ?,
     chapter_list = ?, writing_style = ?, updated = ?, is_open = ? WHERE id = ?`,
    [
      novel.title,
      JSON.stringify(novel.novelBaseData),
      JSON.stringify(novel.roleList),
      JSON.stringify(novel.outline),
      JSON.stringify(novel.chapterList),
      JSON.stringify(novel.writingStyle),
      nowISO(),
      novel.isOpen ? 1 : 0,
      req.params.id,
    ],
    { tx: true, persist: true },
  )

  const updated = queryFirst<NovelRow>('SELECT * FROM novels WHERE id = ?', [req.params.id])
  res.json(rowToNovel(updated!))
})

// ============ DELETE /api/novels/:id — 删除 ============

router.delete('/:id', (req: Request, res: Response) => {
  const existing = queryFirst<{ id: string }>('SELECT id FROM novels WHERE id = ?', [req.params.id])
  if (!existing) { res.status(404).json({ error: 'Novel not found' }); return }

  execute('DELETE FROM novels WHERE id = ?', [req.params.id], { tx: true, persist: true })
  res.json({ ok: true })
})

export default router
