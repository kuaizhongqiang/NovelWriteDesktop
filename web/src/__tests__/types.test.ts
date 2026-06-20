/**
 * 核心类型和工厂函数测试
 */
import { describe, it, expect } from 'vitest'
import {
  createId,
  createDefaultNovel,
  createDefaultWritingStyle,
  calcTotalCharCount,
  calcChapterCount,
} from '../types/index'

describe('createId', () => {
  it('should generate a UUID string', () => {
    const id = createId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()))
    expect(ids.size).toBe(100)
  })
})

describe('createDefaultWritingStyle', () => {
  it('should create a valid WritingStyle with defaults', () => {
    const style = createDefaultWritingStyle()
    expect(style.id).toBeTruthy()
    expect(style.name).toBe('默认风格')
    expect(style.charPerChapter.min).toBe(1000)
    expect(style.charPerChapter.max).toBe(3000)
    expect(style.fullStoryLength).toBe(100000)
    expect(style.baseTone).toBe('')
  })
})

describe('createDefaultNovel', () => {
  it('should create a novel with default values', () => {
    const novel = createDefaultNovel()
    expect(novel.id).toBeTruthy()
    expect(novel.title).toBe('未命名小说')
    expect(novel.isOpen).toBe(true)
    expect(novel.outline.outlinePhases).toEqual([])
    expect(novel.chapterList.chapters).toEqual([])
    expect(novel.roleList.mainRole.relationshipToMainRole).toBe('自身')
    expect(novel.created).toBeInstanceOf(Date)
    expect(novel.updated).toBeInstanceOf(Date)
  })
})

describe('calcTotalCharCount', () => {
  it('should return 0 for empty novel', () => {
    const novel = createDefaultNovel()
    expect(calcTotalCharCount(novel)).toBe(0)
  })

  it('should sum content lengths across all chapters', () => {
    const novel = createDefaultNovel()
    novel.chapterList.chapters = [
      { id: '1', sort: 1, content: 'Hello' },
      { id: '2', sort: 2, content: 'World!' },
    ]
    expect(calcTotalCharCount(novel)).toBe(11)
  })
})

describe('calcChapterCount', () => {
  it('should return 0 for empty novel', () => {
    const novel = createDefaultNovel()
    expect(calcChapterCount(novel)).toBe(0)
  })

  it('should count chapters correctly', () => {
    const novel = createDefaultNovel()
    novel.chapterList.chapters = [
      { id: '1', sort: 1, content: '' },
      { id: '2', sort: 2, content: '' },
      { id: '3', sort: 3, content: '' },
    ]
    expect(calcChapterCount(novel)).toBe(3)
  })
})
