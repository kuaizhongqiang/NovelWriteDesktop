#!/usr/bin/env node
import { Command } from 'commander'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { initDb, getDb, closeDb, persistDb } from '../db/index.js'
import { queryFirst, queryAll, execute } from '../db/query.js'
import { createId, nowISO } from '../types/index.js'
import { getStoredHash, savePasswordHash, hashPassword, generateRandomPassword } from '../db/password.js'
import { clearAllSessions } from '../db/session.js'

// ============ 工具函数 ============
const API_KEY_PREFIX = 'nw_'

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(32).toString('hex')
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

function getNovelById(id: string): Record<string, any> | null {
  const row = queryFirst(
    'SELECT * FROM novels WHERE id = ?',
    [id],
  )
  return row ? parseNovelRow(row) : null
}

/** 更新小说的 JSON 列，在事务中读取→修改→写回 */
function patchNovelJSON(novelId: string, field: string, mutator: (data: any) => any): void {
  const db = getDb()
  db.run('BEGIN')
  try {
    const stmt = db.prepare(`SELECT ${field} FROM novels WHERE id = ?`)
    stmt.bind([novelId])
    if (!stmt.step()) {
      stmt.free()
      db.run('ROLLBACK')
      throw new Error('Novel not found')
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
    await withDb(() => {
      const rawKey = generateApiKey()
      const keyHash = hashKey(rawKey)
      const id = createId()
      execute(
        'INSERT INTO auth_keys (id, name, key_hash, created_at, last_used_at, revoked) VALUES (?, ?, ?, datetime(\'now\'), NULL, 0)',
        [id, name, keyHash],
      )
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
    await withDb(() => {
      const results = queryAll<{ id: string; name: string; created_at: string; last_used_at: string | null; revoked: number }>(
        'SELECT id, name, created_at, last_used_at, revoked FROM auth_keys ORDER BY created_at DESC',
      )
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
        console.log(`      Created: ${k.created_at} | Last used: ${k.last_used_at ?? 'never'}`)
      }
    })
  })

auth
  .command('revoke')
  .argument('<id>', 'Key ID')
  .option('-j, --json', 'JSON 输出')
  .description('吊销 API Key')
  .action(async (id: string, opts: { json?: boolean }) => {
    await withDb(() => {
      execute('UPDATE auth_keys SET revoked = 1 WHERE id = ?', [id])
      if (opts.json) {
        outputJSON({ revoked: id })
      } else {
        console.log(`API Key ${id.slice(0, 8)}... revoked.`)
      }
    })
  })

auth
  .command('password')
  .option('--reset', '重置密码')
  .option('-j, --json', 'JSON 输出')
  .description('查看或重置登录密码')
  .action(async (opts: { reset?: boolean; json?: boolean }) => {
    await withDb(() => {
      if (opts.reset) {
        const newPassword = generateRandomPassword()
        const hash = hashPassword(newPassword)
        savePasswordHash(hash)
        clearAllSessions()
        if (opts.json) {
          outputJSON({ password: newPassword })
        } else {
          console.log(`\n  新密码: ${newPassword}\n`)
        }
      } else {
        const hash = getStoredHash()
        if (hash) {
          if (opts.json) {
            outputJSON({ passwordSet: true })
          } else {
            console.log('✅ 密码已设置')
          }
        } else {
          if (opts.json) {
            outputJSON({ passwordSet: false })
          } else {
            console.log('❌ 密码未设置，启动服务端时自动生成')
          }
        }
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
    await withDb(() => {
      const rows = queryAll<{ id: string; title: string; chapter_list: string; created: string; updated: string; is_open: number }>(
        'SELECT id, title, chapter_list, created, updated, is_open FROM novels ORDER BY updated DESC',
      )
      const items = rows.map(r => {
        const cl = JSON.parse(r.chapter_list || '{}')
        const words = (cl.chapters || []).reduce((s: number, ch: any) => s + (ch.content?.length || 0), 0)
        return { id: r.id, title: r.title, wordCount: words, chapterCount: (cl.chapters || []).length, created: r.created, updated: r.updated, isOpen: Boolean(r.is_open) }
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
    await withDb(() => {
      const n = getNovelById(id)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) { outputJSON(n) }
      else { console.log(JSON.stringify(n, null, 2)) }
    })
  })

novel
  .command('create')
  .argument('<title>', '小说标题')
  .option('-j, --json', 'JSON 输出')
  .description('创建新小说')
  .action(async (title: string, opts: { json?: boolean }) => {
    await withDb(() => {
      const now = nowISO()
      const id = createId()
      const wsId = createId()
      execute(
        `INSERT INTO novels (id, title, novel_base_data, role_list, outline, chapter_list, writing_style, created, updated, is_open)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, title,
          JSON.stringify({ description: '', oneWord: '', genre: '', tags: [] }),
          JSON.stringify({ mainRole: { roleName: '', roleDescription: '', relationshipToMainRole: '自身' }, femaleRoles: [], supportingRoles: [] }),
          JSON.stringify({ mainRoleSuperpower: '', worldView: '', writingKeyPoints: '', outlinePhases: [] }),
          JSON.stringify({ chapters: [] }),
          JSON.stringify({ id: wsId, name: '默认风格', charPerChapter: { min: 1000, max: 3000 }, fullStoryLength: 100000, baseTone: '' }),
          now, now, 1,
        ],
      )
      if (opts.json) { outputJSON({ id, title }) }
      else { console.log(`Created novel "${title}" (${id})`) }
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
    await withDb(() => {
      const n = getNovelById(id)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      if (opts.title) {
        execute("UPDATE novels SET title = ?, updated = datetime('now') WHERE id = ?", [opts.title, id])
      }
      if (opts.genre || opts.tags || opts.description) {
        const bd = n.novelBaseData
        if (opts.genre) { bd.genre = opts.genre }
        if (opts.tags) { bd.tags = opts.tags.split(',').map((t: string) => t.trim()) }
        if (opts.description) { bd.description = opts.description }
        execute("UPDATE novels SET novel_base_data = ?, updated = datetime('now') WHERE id = ?", [JSON.stringify(bd), id])
      }
      if (opts.json) { outputJSON({ updated: id }) }
      else { console.log(`Novel ${id.slice(0, 8)}... updated.`) }
    })
  })

novel
  .command('delete')
  .argument('<id>', '小说 ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除小说')
  .action(async (id: string, opts: { json?: boolean }) => {
    await withDb(() => {
      if (!getNovelById(id)) { console.error('Novel not found'); process.exit(1) }
      execute('DELETE FROM novels WHERE id = ?', [id])
      if (opts.json) { outputJSON({ deleted: id }) }
      else { console.log(`Novel ${id.slice(0, 8)}... deleted.`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) { outputJSON(n.roleList) }
      else { console.log(JSON.stringify(n.roleList, null, 2)) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const role = { roleName: opts.name, roleDescription: opts.desc || '', relationshipToMainRole: opts.relation || '' }

      patchNovelJSON(novelId, 'role_list', (rl: any) => {
        if (opts.type === 'main') { rl.mainRole = role }
        else if (opts.type === 'female') { rl.femaleRoles.push(role) }
        else if (opts.type === 'supporting') { rl.supportingRoles.push(role) }
        else { throw new Error('Invalid type. Use: main/female/supporting') }
        return rl
      })

      if (opts.json) { outputJSON({ added: opts.type }) }
      else { console.log(`Added ${opts.type} role: ${opts.name}`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'role_list', (rl: any) => {
        const allRoles = [rl.mainRole, ...rl.femaleRoles, ...rl.supportingRoles]
        const target = allRoles.find((r: any) => r.roleName === opts.roleName)
        if (!target) { throw new Error('Role not found') }
        if (opts.name) { target.roleName = opts.name }
        if (opts.desc) { target.roleDescription = opts.desc }
        if (opts.relation) { target.relationshipToMainRole = opts.relation }
        return rl
      })

      if (opts.json) { outputJSON({ updated: opts.roleName }) }
      else { console.log(`Role updated: ${opts.roleName}`) }
    })
  })

roles
  .command('delete')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--role-name <name>', '要删除的角色名')
  .option('-j, --json', 'JSON 输出')
  .description('删除角色')
  .action(async (novelId: string, opts: any) => {
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (n.roleList.mainRole.roleName === opts.roleName) {
        console.error('Cannot delete main role'); process.exit(1)
      }

      patchNovelJSON(novelId, 'role_list', (rl: any) => {
        rl.femaleRoles = rl.femaleRoles.filter((r: any) => r.roleName !== opts.roleName)
        rl.supportingRoles = rl.supportingRoles.filter((r: any) => r.roleName !== opts.roleName)
        return rl
      })

      if (opts.json) { outputJSON({ deleted: opts.roleName }) }
      else { console.log(`Role deleted: ${opts.roleName}`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) { outputJSON(n.outline) }
      else { console.log(JSON.stringify(n.outline, null, 2)) }
    })
  })

outline
  .command('add-phase')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--title <title>', '幕/卷标题')
  .option('-j, --json', 'JSON 输出')
  .description('添加幕/卷')
  .action(async (novelId: string, opts: any) => {
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      let phaseId = ''
      patchNovelJSON(novelId, 'outline', (ol: any) => {
        phaseId = createId()
        ol.outlinePhases.push({ id: phaseId, sort: ol.outlinePhases.length + 1, title: opts.title, description: '', chapterOutlines: [] })
        return ol
      })

      if (opts.json) { outputJSON({ id: phaseId }) }
      else { console.log(`Phase added: ${opts.title} (${phaseId})`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'outline', (ol: any) => {
        const phase = ol.outlinePhases.find((p: any) => p.id === opts.phaseId)
        if (!phase) { throw new Error('Phase not found') }
        if (opts.title) { phase.title = opts.title }
        if (opts.desc) { phase.description = opts.desc }
        return ol
      })

      if (opts.json) { outputJSON({ updated: opts.phaseId }) }
      else { console.log(`Phase updated: ${opts.phaseId}`) }
    })
  })

outline
  .command('delete-phase')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--phase-id <id>', 'Phase ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除幕/卷')
  .action(async (novelId: string, opts: any) => {
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'outline', (ol: any) => {
        ol.outlinePhases = ol.outlinePhases.filter((p: any) => p.id !== opts.phaseId)
        ol.outlinePhases.forEach((p: any, i: number) => { p.sort = i + 1 })
        return ol
      })

      if (opts.json) { outputJSON({ deleted: opts.phaseId }) }
      else { console.log(`Phase deleted: ${opts.phaseId}`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      let chId = ''
      patchNovelJSON(novelId, 'outline', (ol: any) => {
        const phase = ol.outlinePhases.find((p: any) => p.id === opts.phaseId)
        if (!phase) { throw new Error('Phase not found') }
        chId = createId()
        phase.chapterOutlines.push({ id: chId, sort: phase.chapterOutlines.length + 1, chapterTitle: opts.title || '', chapterDescription: '', hook: '' })
        return ol
      })

      if (opts.json) { outputJSON({ id: chId }) }
      else { console.log(`Chapter outline added: ${opts.title || chId}`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'outline', (ol: any) => {
        let target: any = null
        for (const p of ol.outlinePhases) {
          target = p.chapterOutlines.find((c: any) => c.id === opts.chapterId)
          if (target) { break }
        }
        if (!target) { throw new Error('Chapter outline not found') }
        if (opts.title) { target.chapterTitle = opts.title }
        if (opts.desc) { target.chapterDescription = opts.desc }
        if (opts.hook) { target.hook = opts.hook }
        return ol
      })

      if (opts.json) { outputJSON({ updated: opts.chapterId }) }
      else { console.log(`Chapter outline updated: ${opts.chapterId}`) }
    })
  })

outline
  .command('delete-chapter')
  .argument('<novelId>', '小说 ID')
  .requiredOption('--chapter-id <id>', '章节大纲 ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除章节大纲')
  .action(async (novelId: string, opts: any) => {
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'outline', (ol: any) => {
        for (const p of ol.outlinePhases) {
          p.chapterOutlines = p.chapterOutlines.filter((c: any) => c.id !== opts.chapterId)
          p.chapterOutlines.forEach((c: any, i: number) => { c.sort = i + 1 })
        }
        return ol
      })

      if (opts.json) { outputJSON({ deleted: opts.chapterId }) }
      else { console.log(`Chapter outline deleted: ${opts.chapterId}`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      const ch = n.chapterList.chapters.find((c: any) => c.id === opts.chapterId)
      if (!ch) { console.error('Chapter not found'); process.exit(1) }
      if (opts.json) { outputJSON(ch) }
      else { console.log(JSON.stringify(ch, null, 2)) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'chapter_list', (cl: any) => {
        const ch = cl.chapters.find((c: any) => c.id === opts.chapterId)
        if (!ch) { throw new Error('Chapter not found') }

        switch (opts.op) {
          case 'replace':
            if (!opts.target) { throw new Error('--target required') }
            ch.content = ch.content.replace(opts.target, opts.new ?? '')
            break
          case 'append':
            ch.content = ch.content + (opts.new ?? '')
            break
          case 'prepend':
            ch.content = (opts.new ?? '') + ch.content
            break
          case 'insert_after':
            if (!opts.target) { throw new Error('--target required') }
            ch.content = ch.content.replace(opts.target, opts.target + (opts.new ?? ''))
            break
          case 'delete_range':
            if (opts.start !== undefined && opts.end !== undefined) {
              ch.content = ch.content.slice(0, opts.start) + ch.content.slice(opts.end)
            } else if (opts.target) {
              ch.content = ch.content.replace(opts.target, '')
            } else {
              throw new Error('--target or --start/--end required')
            }
            break
          default:
            throw new Error('Invalid op')
        }
        return cl
      })

      if (opts.json) { outputJSON({ updated: opts.chapterId }) }
      else { console.log(`Chapter patched`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'chapter_list', (cl: any) => {
        const ch = cl.chapters.find((c: any) => c.id === opts.chapterId)
        if (!ch) { throw new Error('Chapter not found') }
        ch.content = opts.content
        return cl
      })

      if (opts.json) { outputJSON({ replaced: opts.chapterId }) }
      else { console.log(`Chapter ${opts.chapterId.slice(0, 8)}... replaced.`) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }
      if (opts.json) { outputJSON(n.writingStyle) }
      else { console.log(JSON.stringify(n.writingStyle, null, 2)) }
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
    await withDb(() => {
      const n = getNovelById(novelId)
      if (!n) { console.error('Novel not found'); process.exit(1) }

      patchNovelJSON(novelId, 'writing_style', (ws: any) => {
        if (opts.min !== undefined) { ws.charPerChapter.min = opts.min }
        if (opts.max !== undefined) { ws.charPerChapter.max = opts.max }
        if (opts.tone) { ws.baseTone = opts.tone }
        if (opts.length) { ws.fullStoryLength = opts.length }
        return ws
      })

      if (opts.json) { outputJSON({ updated: novelId }) }
      else { console.log(`Writing style updated for ${novelId.slice(0, 8)}...`) }
    })
  })

// ============ preset ============
const preset = program.command('preset').description('写作风格预设管理')

preset
  .command('list')
  .option('-j, --json', 'JSON 输出')
  .description('列出所有预设')
  .action(async (opts: { json?: boolean }) => {
    await withDb(() => {
      const items = queryAll('SELECT * FROM writing_styles ORDER BY created DESC')
      if (opts.json) { outputJSON(items) }
      else { console.log(JSON.stringify(items, null, 2)) }
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
    await withDb(() => {
      const now = nowISO()
      const id = createId()
      execute(
        `INSERT INTO writing_styles (id, name, char_per_chapter_min, char_per_chapter_max, full_story_length, base_tone, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, opts.name, opts.min ?? 1000, opts.max ?? 3000, opts.length ?? 100000, opts.tone || '', now, now],
      )
      if (opts.json) { outputJSON({ id }) }
      else { console.log(`Preset created: ${opts.name} (${id})`) }
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
    await withDb(() => {
      // #65: 验证记录存在
      const existing = queryFirst<{ id: string }>('SELECT id FROM writing_styles WHERE id = ?', [opts.id])
      if (!existing) { console.error('Preset not found'); process.exit(1) }

      const sets: string[] = ["updated = ?"]
      const params: unknown[] = [nowISO()]
      if (opts.name) { sets.push('name = ?'); params.push(opts.name) }
      if (opts.min !== undefined) { sets.push('char_per_chapter_min = ?'); params.push(opts.min) }
      if (opts.max !== undefined) { sets.push('char_per_chapter_max = ?'); params.push(opts.max) }
      if (opts.length) { sets.push('full_story_length = ?'); params.push(opts.length) }
      if (opts.tone !== undefined) { sets.push('base_tone = ?'); params.push(opts.tone) }
      params.push(opts.id)

      execute(`UPDATE writing_styles SET ${sets.join(', ')} WHERE id = ?`, params)
      if (opts.json) { outputJSON({ updated: opts.id }) }
      else { console.log(`Preset ${opts.id.slice(0, 8)}... updated.`) }
    })
  })

preset
  .command('delete')
  .requiredOption('--id <id>', '预设 ID')
  .option('-j, --json', 'JSON 输出')
  .description('删除预设')
  .action(async (opts: any) => {
    await withDb(() => {
      // #65: 验证记录存在
      const existing = queryFirst<{ id: string }>('SELECT id FROM writing_styles WHERE id = ?', [opts.id])
      if (!existing) { console.error('Preset not found'); process.exit(1) }
      execute('DELETE FROM writing_styles WHERE id = ?', [opts.id])
      if (opts.json) { outputJSON({ deleted: opts.id }) }
      else { console.log(`Preset ${opts.id.slice(0, 8)}... deleted.`) }
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
const isMainModule = process.argv[1]?.includes('cli') || process.argv[1]?.includes('novelwrite')
if (isMainModule) {
  program.parse(process.argv)
}

export default program
