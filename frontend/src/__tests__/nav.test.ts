import { describe, expect, it } from 'vitest'
import { replaceInDoc, searchDoc, type SearchOpts } from '../editor/NavPanel'
import { tasksToIcs } from '../io/tasks'
import type { MapDocument } from '../editor/model'

const doc = (): MapDocument => ({ version: 1, sheets: [
  { id: 's1', title: 'Один', rootTopic: { id: 'r', title: 'План', children: [
    { id: 'a', title: 'Кот и котёнок', notes: { plain: 'про кота' }, labels: ['кот'] },
    { id: 'b', title: 'Задача', taskInfo: { start: '2026-10-10', end: '2026-10-12', progress: 50, assignee: 'Аня' } },
  ] }, relationships: [{ id: 'rel', end1: 'a', end2: 'b', title: 'Кот' }] },
  { id: 's2', title: 'Два', rootTopic: { id: 'r2', title: 'Кот' } },
] } as MapDocument)
const opts = (p: Partial<SearchOpts> = {}): SearchOpts => ({ replace: false, file: false, whole: false, matchCase: false, kinds: ['topic', 'note', 'relationship', 'boundary', 'label', 'link'], ...p })

describe('поиск в навигационной панели', () => {
  it('типы, область, регистр и целые слова', () => {
    const d = doc()
    expect(searchDoc(d, 's1', 'кот', opts()).map(h => h.kind)).toEqual(['topic', 'note', 'label', 'relationship'])
    expect(searchDoc(d, 's1', 'кот', opts({ file: true })).filter(h => h.sheetId === 's2')).toHaveLength(1)
    expect(searchDoc(d, 's1', 'Кот', opts({ matchCase: true, kinds: ['topic', 'relationship'] }))).toHaveLength(2)
    expect(searchDoc(d, 's1', 'кот', opts({ whole: true, kinds: ['topic'] }))).toHaveLength(1)
    expect(searchDoc(d, 's1', 'котён', opts({ whole: true, kinds: ['topic'] }))).toHaveLength(0)
  })
  it('замена всех и одного', () => {
    const d = doc()
    expect(replaceInDoc(d, 's1', 'кот', 'пёс', opts({ kinds: ['topic'] }))).toBe(2)
    expect(d.sheets[0].rootTopic.children![0].title).toBe('пёс и пёсёнок')
    const d2 = doc()
    const [hit] = searchDoc(d2, 's1', 'кот', opts({ kinds: ['label'] }))
    expect(replaceInDoc(d2, 's1', 'кот', 'пёс', opts(), hit)).toBe(1)
    expect(d2.sheets[0].rootTopic.children![0].labels).toEqual(['пёс'])
    expect(d2.sheets[0].rootTopic.children![0].title).toBe('Кот и котёнок')
  })
})

describe('календарь задач', () => {
  it('событие на весь день с исключающей датой окончания', () => {
    const ics = tasksToIcs(doc(), 'Карта')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261010')
    expect(ics).toContain('DTEND;VALUE=DATE:20261013')
    expect(ics).toContain('SUMMARY:Задача')
    expect(ics).toContain('Assignee: Аня')
  })
})
