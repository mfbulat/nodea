import { describe, expect, it } from 'vitest'
import { cloneWithNewIds, indexSheet, topicsFromText, topicsToText, type Topic } from '../editor/model'

describe('модель', () => {
  it('текст с отступами ↔ темы', () => {
    const topics = topicsFromText('Один\n\tДва\n\t\tТри\n- Четыре\n  1. Пять')
    expect(topics.map(t => t.title)).toEqual(['Один', 'Четыре'])
    expect(topics[0].children![0].children![0].title).toBe('Три')
    expect(topics[1].children![0].title).toBe('Пять')
    expect(topicsToText(topicsFromText(topicsToText(topics)))).toBe(topicsToText(topics))
  })

  it('копия с новыми id переназначает ссылки сводок и границ', () => {
    const t: Topic = { id: 'p', title: 'P', children: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
      summaries: [{ id: 's', ids: ['a', 'b'], topic: { id: 'st', title: 'S' } }], boundaries: [{ id: 'bd', ids: ['b'] }] }
    const c = cloneWithNewIds(t)
    const kids = c.children!.map(k => k.id)
    expect(kids).not.toContain('a')
    expect(c.summaries![0].ids).toEqual(kids)
    expect(c.boundaries![0].ids).toEqual([kids[1]])
    expect(c.summaries![0].topic.id).not.toBe('st')
  })

  it('индекс включает сводки, выноски и плавающие темы', () => {
    const idx = indexSheet({ id: 's', title: 'L', rootTopic: { id: 'r', title: 'R', children: [{ id: 'a', title: 'A', callouts: [{ id: 'c', title: 'C' }] }],
      summaries: [{ id: 'x', ids: ['a'], topic: { id: 'st', title: 'S' } }] }, floatingTopics: [{ id: 'f', title: 'F' }] })
    expect(idx.get('c')!.kind).toBe('callout')
    expect(idx.get('st')!.kind).toBe('summary')
    expect(idx.get('f')!.kind).toBe('floating')
    expect(idx.get('a')!.branch).toBe(0)
  })
})
