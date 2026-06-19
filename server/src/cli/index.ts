#!/usr/bin/env node
import { Command } from 'commander'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { initDb, getDb, closeDb } from '../db/index.js'
import { createId, nowISO } from '../types/index.js'

// ============ 工具函数 ============
const API_KEY_PREFIX = 'nw_'

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(32).toString('hex')
}

function sqEscape(s: string): string {
  return s.replace(/'/g, "''")
}

function parseNovelRow(row: Record<string, any>) {
  return {
    ...row,
    novelBaseData: JSON.parse(row.novel_base_data || '{}'),
    roleList: JSON.parse(row.role_list || '{}'),
    outline: JSON.parse(row.outline || '{}'),
    chapterList: JSON.parse(row.chapter_list || '{}'),
    writingStyle: JSON.parse(row.writing_style || '{}'),
    isOpen: Boolean(row.is_open),
  }
}

function outputJSON(data: any): void {
  console.log(JSON.stringify(data))
}

async function withDb(action: (db: any) => void): Promise<void> {
  await initDb()
  try { action(getDb()) } finally { closeDb() }
}

function getNovelById(db: any, id: string): Record<string, any> | null {
  const rows = db.exec(`SELECT * FROM novels WHERE id = '${sqEscape(id)}'`)
  if (!rows[0]?.values?.length) { return null }
  const cols = rows[0].columns
  const vals = rows[0].values[0]
  const row: Record<string, any> = {}
  cols.forEach((c: string, i: number) => { row[c] = vals[i] })
  return parseNovelRow(row)
}

// ============ Commander ============
const program = new Command()
  .name('novelwrite')
  .description('NovelWrite Desktop - CLI')
  .version('0.1.0-alpha')

// ============ init ============
program
  .command('init')
  .argument('[dir]', 'Data directory', '.')
  .description('初始化数据库')
  .action(async (dir: string) => {
    const dbPath = path.resolve(dir, 'novelwrite.db')
    await initDb(dbPath)
    console.log(`Initialized database at ${dbPath}`)
    closeDb()
  })

// ============ auth ============
const auth = program.command('auth').description('API Key 管理')

auth
  .command('generate')
  .argument('<name>', 'Key 名称')
  .option('-j, --json', 'JSON 输出')
  .description('生成新的 API Key')
  .action(async (name: string, opts: { json?: boolean }) => {
    await withDb(db => {
      const rawKey = generateApiKey()
      const keyHash = hashKey(rawKey)
      const id = createId()
      db.run(`INSERT INTO auth_keys (id, name, key_hash, created_at, last_used_at, revoked)
        VALUES ('${id}', '${sqEscape(name)}', '${keyHash}', datetime('now'), NULL, 0)`)
      if (opts.json) {
        outputJSON({ id, name, key: rawKey })
      } else {
        console.log(`API Key generated:\n  Name: ${name}\n  Key:  ${rawKey}\n  ID:   ${id}`)
      }
    })
  })

auth
  .command('list')
  .option('-j, --json', 'JSON 输出')
  .description('列出所有 API Key')
  .action(async (opts: { json?: boolean }) => {
    await withDb(db => {
      const rows = db.exec('SELECT id, name, created_at, last_used_at, revoked FROM auth_keys ORDER BY created_at DESC')
      const results = (rows[0]?.values ?? []).map((v: any[]) => ({
        id: v[0], name: v[1], createdAt: v[2], lastUsedAt: v[3], revoked: Boolean(v[4]),
      }))
      if (opts.json) {
        outputJSON(results)
        return
      }
      if (!results.length) {
        console.log('No API keys found.')
        return
      }
      for (const k of results) {
        console.log(`[${k.revoked ? '🔴 Revoked' : '🟢 Active'}] ${k.name} (${k.id.slice(0, 8)}...)`)
        console.log(`      Created: ${k.createdAt} | Last used: ${k.lastUsedAt ?? 'never'}`)
      }
    })
  })

auth
  .command('revoke')
  .argument('<id>', 'Key ID')
  .option('-j, --json', 'JSON 输出')
  .description('吊销 API Key')
  .action(async (id: string, opts: { json?: boolean }) => {
    await withDb(db => {
      db.run(`UPDATE auth_keys SET revoked = 1 WHERE id = '${sqEscape(id)}'`)
      if (opts.json) {
        outputJSON({ revoked: id })
      } else {
        console.log(`API Key ${id.slice(0, 8)}... revoked.`)
      }
    })
  })

// ============ novel ============
const novel = program.command('novel').description('小说操作')

novel
  .command('list')
  .option('-j, --json', 'JSON 输出')
  .description('列出所有小说')
  .action(async (opts: { json?: boolean }) => {
    await withDb(db => {
      const rows = db.exec('SELECT id, title, chapter_list, created, updated, is_open FROM novels ORDER BY updated DESC')
      const items = (rows[0]?.values ?? []).map((v: any[]) => {
        const cl = JSON.parse(v[2] || '{}')
        const words = (cl.chapters || []).reduce((s: number, ch: any) => s + (ch.content?.length || 0), 0)
        return { id: v[0], title: v[1], wordCount: words, chapterCount: (cl.chapters || []).length, created: v[3], updated: v[4], isOpen: Boolean(v[5]) }
      })
      if (opts.json) {
        outputJSON(items)
        return
      }
      for (const n of items) {
        console.log(`${n.isOpen ? '📖' : '🔒'} ${n.title} | ${n.wordCount}字 ${n.chapterCount}章 | ${n.updated}`)
      }
    })
  })

novel
  .command('get')
  .argument('<id>', '小说 ID')
  .option('-j, --json', 'JSON 输出')
  .description('获取小说完整数据')
  .action(async (id: string, opts: { json?: boolean }) => {
    await withDb(db => {
      const n = getNovelById(db, id)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) {
        outputJSON(n)
      } else {
        console.log(JSON.stringify(n, null, 2))
      }
    })
  })

novel
  .command('create')
  .argument('<title>', '小说标题')
  .option('-j, --json', 'JSON 输出')
  .description('创建新小说')
  .action(async (title: string, opts: { json?: boolean }) => {
    await withDb(db => {
      const now = nowISO()
      const n = {
        id: createId(), title,
        novelBaseData: { description: '', oneWord: '', genre: '', tags: [] },
        roleList: { mainRole: { roleName: '', roleDescription: '', relationshipToMainRole: '自身' }, femaleRoles: [], supportingRoles: [] },
        outline: { mainRoleSuperpower: '', worldView: '', writingKeyPoints: '', outlinePhases: [] },
        chapterList: { chapters: [] },
        writingStyle: { id: createId(), name: '默认风格', charPerChapter: { min: 1000, max: 3000 }, fullStoryLength: 100000, baseTone: '' },
        created: now, updated: now, isOpen: true,
      }
      const d = {
        id: n.id, title: sqEscape(n.title),
        novel_base_data: sqEscape(JSON.stringify(n.novelBaseData)),
        role_list: sqEscape(JSON.stringify(n.roleList)),
        outline: sqEscape(JSON.stringify(n.outline)),
        chapter_list: sqEscape(JSON.stringify(n.chapterList)),
        writing_style: sqEscape(JSON.stringify(n.writingStyle)),
        created: n.created, updated: n.updated, is_open: n.isOpen ? '1' : '0',
      }
      db.run(`INSERT INTO novels VALUES ('${d.id}','${d.title}','${d.novel_base_data}','${d.role_list}','${d.outline}','${d.chapter_list}','${d.writing_style}','${d.created}','${d.updated}',${d.is_open})`)
      if (opts.json) {
        outputJSON({ id: n.id, title })
      } else {
        console.log(`Created novel "${title}" (${n.id})`)
      }
    })
  })

novel
  .command('update')
  .argument('<id>', '小说 ID')
  .option('--title <title>', '新标题')
  .option('--genre <genre>', '题材')
  .option('--tags <tags>', '标签（逗号分隔）')
  .option('--description <desc>', '简介')
  .option('-j, --json', 'JSON 输出')
  .description('更新小说基础设定')
  .action(async (id: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, id)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.title) {
        db.run(`UPDATE novels SET title = '${sqEscape(opts.title)}', updated = '${nowISO()}' WHERE id = '${sqEscape(id)}'`)
      }
      if (opts.genre || opts.tags || opts.description) {
        const bd = n!.novelBaseData
        if (opts.genre) { bd.genre = opts.genre }
        if (opts.tags) { bd.tags = opts.tags.split(',').map((t: string) => t.trim()) }
        if (opts.description) { bd.description = opts.description }
        db.run(`UPDATE novels SET novel_base_data = '${sqEscape(JSON.stringify(bd))}', updated = '${nowISO()}' WHERE id = '${sqEscape(id)}'`)
      }
      if (opts.json) {
        outputJSON({ updated: id })
      } else {
        console.log(`Novel ${id.slice(0, 8)}... updated.`)
      }
    })
  })

novel
  .command('delete')
  .argument('<id>', '小说 ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除小说')
  .action(async (id: string, opts: { json?: boolean }) => {
    await withDb(db => {
      db.run(`DELETE FROM novels WHERE id = '${sqEscape(id)}'`)
      if (opts.json) {
        outputJSON({ deleted: id })
      } else {
        console.log(`Novel ${id.slice(0, 8)}... deleted.`)
      }
    })
  })

// ============ roles ============
const roles = program.command('roles').description('角色操作')

roles
  .command('list')
  .argument('<novelId>', '小说 ID')
  .option('-j, --json', 'JSON 输出')
  .description('获取角色列表')
  .action(async (novelId: string, opts: { json?: boolean }) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) {
        outputJSON(n.roleList)
      } else {
        console.log(JSON.stringify(n.roleList, null, 2))
      }
    })
  })

roles
  .command('add')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--type <type>', '角色类型: main/female/supporting')
  .requiredOption('--name <name>', '角色名')
  .option('--desc <desc>', '角色描述', '')
  .option('--relation <relation>', '与主角关系', '')
  .option('-j, --json', 'JSON 输出')
  .description('添加角色')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const rl = n.roleList
      const role = { roleName: opts.name, roleDescription: opts.desc || '', relationshipToMainRole: opts.relation || '' }
      if (opts.type === 'main') {
        rl.mainRole = role
      } else if (opts.type === 'female') {
        rl.femaleRoles.push(role)
      } else if (opts.type === 'supporting') {
        rl.supportingRoles.push(role)
      } else {
        console.error('Invalid type. Use: main/female/supporting'); process.exit(1)
      }
      db.run(`UPDATE novels SET role_list = '${sqEscape(JSON.stringify(rl))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ added: opts.type })
      } else {
        console.log(`Added ${opts.type} role: ${opts.name}`)
      }
    })
  })

roles
  .command('update')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--role-name <name>', '角色名（用于定位）')
  .option('--name <name>', '新名称')
  .option('--desc <desc>', '新描述')
  .option('--relation <relation>', '与主角关系')
  .option('-j, --json', 'JSON 输出')
  .description('更新角色')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const allRoles = [n.roleList.mainRole, ...n.roleList.femaleRoles, ...n.roleList.supportingRoles]
      const target = allRoles.find(r => r.roleName === opts.roleName)
      if (!target) { console.error('Role not found'); process.exit(1) }
      if (opts.name) { target.roleName = opts.name }
      if (opts.desc) { target.roleDescription = opts.desc }
      if (opts.relation) { target.relationshipToMainRole = opts.relation }
      db.run(`UPDATE novels SET role_list = '${sqEscape(JSON.stringify(n.roleList))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ updated: opts.roleName })
      } else {
        console.log(`Role updated: ${opts.roleName}`)
      }
    })
  })

roles
  .command('delete')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--role-name <name>', '要删除的角色名')
  .option('-j, --json', 'JSON 输出')
  .description('删除角色')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (n.roleList.mainRole.roleName === opts.roleName) {
        console.error('Cannot delete main role'); process.exit(1)
      }
      n.roleList.femaleRoles = n.roleList.femaleRoles.filter((r: any) => r.roleName !== opts.roleName)
      n.roleList.supportingRoles = n.roleList.supportingRoles.filter((r: any) => r.roleName !== opts.roleName)
      db.run(`UPDATE novels SET role_list = '${sqEscape(JSON.stringify(n.roleList))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ deleted: opts.roleName })
      } else {
        console.log(`Role deleted: ${opts.roleName}`)
      }
    })
  })

// ============ outline ============
const outline = program.command('outline').description('大纲操作')

outline
  .command('get')
  .argument('<novelId>', '小说 ID')
  .option('-j, --json', 'JSON 输出')
  .description('获取完整大纲')
  .action(async (novelId: string, opts: { json?: boolean }) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) {
        outputJSON(n.outline)
      } else {
        console.log(JSON.stringify(n.outline, null, 2))
      }
    })
  })

outline
  .command('add-phase')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--title <title>', '幕/卷标题')
  .option('-j, --json', 'JSON 输出')
  .description('添加幕/卷')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const ol = n.outline
      const phase = { id: createId(), sort: ol.outlinePhases.length + 1, title: opts.title, description: '', chapterOutlines: [] }
      ol.outlinePhases.push(phase)
      db.run(`UPDATE novels SET outline = '${sqEscape(JSON.stringify(ol))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ id: phase.id })
      } else {
        console.log(`Phase added: ${opts.title} (${phase.id})`)
      }
    })
  })

outline
  .command('update-phase')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--phase-id <id>', 'Phase ID')
  .option('--title <title>', '新标题')
  .option('--desc <desc>', '新描述')
  .option('-j, --json', 'JSON 输出')
  .description('更新幕/卷')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const phase = n.outline.outlinePhases.find((p: any) => p.id === opts.phaseId)
      if (!phase) { console.error('Phase not found'); process.exit(1) }
      if (opts.title) { phase.title = opts.title }
      if (opts.desc) { phase.description = opts.desc }
      db.run(`UPDATE novels SET outline = '${sqEscape(JSON.stringify(n.outline))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ updated: opts.phaseId })
      } else {
        console.log(`Phase updated: ${opts.phaseId}`)
      }
    })
  })

outline
  .command('delete-phase')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--phase-id <id>', 'Phase ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除幕/卷')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      n.outline.outlinePhases = n.outline.outlinePhases.filter((p: any) => p.id !== opts.phaseId)
      n.outline.outlinePhases.forEach((p: any, i: number) => { p.sort = i + 1 })
      db.run(`UPDATE novels SET outline = '${sqEscape(JSON.stringify(n.outline))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ deleted: opts.phaseId })
      } else {
        console.log(`Phase deleted: ${opts.phaseId}`)
      }
    })
  })

outline
  .command('add-chapter')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--phase-id <id>', '所属 Phase ID')
  .option('--title <title>', '章节标题', '')
  .option('-j, --json', 'JSON 输出')
  .description('添加章节大纲')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const phase = n.outline.outlinePhases.find((p: any) => p.id === opts.phaseId)
      if (!phase) { console.error('Phase not found'); process.exit(1) }
      const ch = { id: createId(), sort: phase.chapterOutlines.length + 1, chapterTitle: opts.title || '', chapterDescription: '', hook: '' }
      phase.chapterOutlines.push(ch)
      db.run(`UPDATE novels SET outline = '${sqEscape(JSON.stringify(n.outline))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ id: ch.id })
      } else {
        console.log(`Chapter outline added: ${opts.title || ch.id}`)
      }
    })
  })

outline
  .command('update-chapter')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--chapter-id <id>', '章节大纲 ID')
  .option('--title <title>', '新标题')
  .option('--desc <desc>', '新描述')
  .option('--hook <hook>', '钩子')
  .option('-j, --json', 'JSON 输出')
  .description('更新章节大纲')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      let target: any = null
      for (const p of n.outline.outlinePhases) {
        target = p.chapterOutlines.find((c: any) => c.id === opts.chapterId)
        if (target) { break }
      }
      if (!target) { console.error('Chapter outline not found'); process.exit(1) }
      if (opts.title) { target.chapterTitle = opts.title }
      if (opts.desc) { target.chapterDescription = opts.desc }
      if (opts.hook) { target.hook = opts.hook }
      db.run(`UPDATE novels SET outline = '${sqEscape(JSON.stringify(n.outline))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ updated: opts.chapterId })
      } else {
        console.log(`Chapter outline updated: ${opts.chapterId}`)
      }
    })
  })

outline
  .command('delete-chapter')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--chapter-id <id>', '章节大纲 ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除章节大纲')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      for (const p of n.outline.outlinePhases) {
        p.chapterOutlines = p.chapterOutlines.filter((c: any) => c.id !== opts.chapterId)
        p.chapterOutlines.forEach((c: any, i: number) => { c.sort = i + 1 })
      }
      db.run(`UPDATE novels SET outline = '${sqEscape(JSON.stringify(n.outline))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ deleted: opts.chapterId })
      } else {
        console.log(`Chapter outline deleted: ${opts.chapterId}`)
      }
    })
  })

// ============ chapter ============
const chapter = program.command('chapter').description('章节正文操作')

chapter
  .command('get')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--chapter-id <id>', '章节 ID')
  .option('-j, --json', 'JSON 输出')
  .description('获取章节正文')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const ch = n.chapterList.chapters.find((c: any) => c.id === opts.chapterId)
      if (!ch) { console.error('Chapter not found'); process.exit(1) }
      if (opts.json) {
        outputJSON(ch)
      } else {
        console.log(JSON.stringify(ch, null, 2))
      }
    })
  })

chapter
  .command('patch')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--chapter-id <id>', '章节 ID')
  .requiredOption('--op <operation>', '操作: replace/append/prepend/insert_after/delete_range')
  .option('--target <text>', '定位文本')
  .option('--new <text>', '新文本')
  .option('--start <n>', '起始位置', parseInt)
  .option('--end <n>', '结束位置', parseInt)
  .option('-j, --json', 'JSON 输出')
  .description('局部修改正文')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const ch = n.chapterList.chapters.find((c: any) => c.id === opts.chapterId)
      if (!ch) { console.error('Chapter not found'); process.exit(1) }
      let newContent = ch.content
      switch (opts.op) {
        case 'replace':
          if (!opts.target) { console.error('--target required'); process.exit(1) }
          newContent = ch.content.replace(opts.target, opts.new ?? '')
          break
        case 'append':
          newContent = ch.content + (opts.new ?? '')
          break
        case 'prepend':
          newContent = (opts.new ?? '') + ch.content
          break
        case 'insert_after':
          if (!opts.target) { console.error('--target required'); process.exit(1) }
          newContent = ch.content.replace(opts.target, opts.target + (opts.new ?? ''))
          break
        case 'delete_range':
          if (opts.start !== undefined && opts.end !== undefined) {
            newContent = ch.content.slice(0, opts.start) + ch.content.slice(opts.end)
          } else if (opts.target) {
            newContent = ch.content.replace(opts.target, '')
          } else {
            console.error('--target or --start/--end required'); process.exit(1)
          }
          break
        default:
          console.error('Invalid op'); process.exit(1)
      }
      ch.content = newContent
      db.run(`UPDATE novels SET chapter_list = '${sqEscape(JSON.stringify(n.chapterList))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ updated: opts.chapterId, length: newContent.length })
      } else {
        console.log(`Chapter patched (${newContent.length} chars)`)
      }
    })
  })

chapter
  .command('replace')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--chapter-id <id>', '章节 ID')
  .requiredOption('--content <content>', '完整内容')
  .option('-j, --json', 'JSON 输出')
  .description('全量替换正文')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const ch = n.chapterList.chapters.find((c: any) => c.id === opts.chapterId)
      if (!ch) { console.error('Chapter not found'); process.exit(1) }
      ch.content = opts.content
      db.run(`UPDATE novels SET chapter_list = '${sqEscape(JSON.stringify(n.chapterList))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ replaced: opts.chapterId })
      } else {
        console.log(`Chapter ${opts.chapterId.slice(0, 8)}... replaced.`)
      }
    })
  })

// ============ style ============
const styleCmd = program.command('style').description('小说写作风格操作')

styleCmd
  .command('get')
  .argument('<novelId>', '小说 ID')
  .option('-j, --json', 'JSON 输出')
  .description('获取小说当前风格')
  .action(async (novelId: string, opts: { json?: boolean }) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) {
        outputJSON(n.writingStyle)
      } else {
        console.log(JSON.stringify(n.writingStyle, null, 2))
      }
    })
  })

styleCmd
  .command('update')
  .argument('<novelId>', '小说 ID')
  .option('--min <n>', '每章最少字数', parseInt)
  .option('--max <n>', '每章最多字数', parseInt)
  .option('--tone <tone>', '基调')
  .option('--length <n>', '全本预计总字数', parseInt)
  .option('-j, --json', 'JSON 输出')
  .description('更新写作风格')
  .action(async (novelId: string, opts: any) => {
    await withDb(db => {
      const n = getNovelById(db, novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const ws = n.writingStyle
      if (opts.min !== undefined) { ws.charPerChapter.min = opts.min }
      if (opts.max !== undefined) { ws.charPerChapter.max = opts.max }
      if (opts.tone) { ws.baseTone = opts.tone }
      if (opts.length) { ws.fullStoryLength = opts.length }
      db.run(`UPDATE novels SET writing_style = '${sqEscape(JSON.stringify(ws))}', updated = '${nowISO()}' WHERE id = '${sqEscape(novelId)}'`)
      if (opts.json) {
        outputJSON({ updated: novelId })
      } else {
        console.log(`Writing style updated for ${novelId.slice(0, 8)}...`)
      }
    })
  })

// ============ preset ============
const preset = program.command('preset').description('写作风格预设管理')

preset
  .command('list')
  .option('-j, --json', 'JSON 输出')
  .description('列出所有预设')
  .action(async (opts: { json?: boolean }) => {
    await withDb(db => {
      const rows = db.exec('SELECT * FROM writing_styles ORDER BY created DESC')
      const items = (rows[0]?.values ?? []).map((v: any[]) => {
        const cols = rows[0].columns
        const row: Record<string, any> = {}
        cols.forEach((c: string, i: number) => { row[c] = v[i] })
        return row
      })
      if (opts.json) {
        outputJSON(items)
      } else {
        console.log(JSON.stringify(items, null, 2))
      }
    })
  })

preset
  .command('create')
  .requiredOption('--name <name>', '预设名称')
  .option('--min <n>', '每章最少字数', parseInt)
  .option('--max <n>', '每章最多字数', parseInt)
  .option('--length <n>', '总字数', parseInt)
  .option('--tone <tone>', '基调', '')
  .option('-j, --json', 'JSON 输出')
  .description('新建预设')
  .action(async (opts: any) => {
    await withDb(db => {
      const now = nowISO()
      const id = createId()
      db.run(`INSERT INTO writing_styles (id, name, char_per_chapter_min, char_per_chapter_max, full_story_length, base_tone, created, updated)
        VALUES ('${id}', '${sqEscape(opts.name)}', ${opts.min ?? 1000}, ${opts.max ?? 3000}, ${opts.length ?? 100000}, '${sqEscape(opts.tone || '')}', '${now}', '${now}')`)
      if (opts.json) {
        outputJSON({ id })
      } else {
        console.log(`Preset created: ${opts.name} (${id})`)
      }
    })
  })

preset
  .command('update')
  .requiredOption('--id <id>', '预设 ID')
  .option('--name <name>', '新名称')
  .option('--min <n>', '每章最少字数', parseInt)
  .option('--max <n>', '每章最多字数', parseInt)
  .option('--length <n>', '总字数', parseInt)
  .option('--tone <tone>', '基调')
  .option('-j, --json', 'JSON 输出')
  .description('更新预设')
  .action(async (opts: any) => {
    await withDb(db => {
      const sets: string[] = [`updated = '${nowISO()}'`]
      if (opts.name) { sets.push(`name = '${sqEscape(opts.name)}'`) }
      if (opts.min !== undefined) { sets.push(`char_per_chapter_min = ${opts.min}`) }
      if (opts.max !== undefined) { sets.push(`char_per_chapter_max = ${opts.max}`) }
      if (opts.length) { sets.push(`full_story_length = ${opts.length}`) }
      if (opts.tone !== undefined) { sets.push(`base_tone = '${sqEscape(opts.tone)}'`) }
      db.run(`UPDATE writing_styles SET ${sets.join(', ')} WHERE id = '${sqEscape(opts.id)}'`)
      if (opts.json) {
        outputJSON({ updated: opts.id })
      } else {
        console.log(`Preset ${opts.id.slice(0, 8)}... updated.`)
      }
    })
  })

preset
  .command('delete')
  .requiredOption('--id <id>', '预设 ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除预设')
  .action(async (opts: any) => {
    await withDb(db => {
      db.run(`DELETE FROM writing_styles WHERE id = '${sqEscape(opts.id)}'`)
      if (opts.json) {
        outputJSON({ deleted: opts.id })
      } else {
        console.log(`Preset ${opts.id.slice(0, 8)}... deleted.`)
      }
    })
  })

// ============ tool-list ============
program
  .command('tool-list')
  .description('输出机器可读的工具定义 (JSON)')
  .action(async () => {
    function describeArgs(cmd: Command): any[] {
      return ((cmd as any).registeredArguments ?? []).map((a: any) => ({
        name: a.name?.() ?? a._name ?? 'unknown',
        required: a.required ?? false,
        description: a.description ?? '',
      }))
    }
    const tools = program.commands.map(cmd => ({
      name: cmd.name(),
      description: cmd.description(),
      subcommands: (cmd as any).commands?.()?.map((sub: Command) => ({
        name: sub.name(),
        description: sub.description(),
        arguments: describeArgs(sub),
      })) ?? [],
    }))
    console.log(JSON.stringify({ tools }, null, 2))
  })

// ============ 运行 ============
const isMainModule = process.argv[1]?.includes('cli')
if (isMainModule) {
  program.parse(process.argv)
}

export default program
