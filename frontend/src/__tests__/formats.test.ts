import { describe, expect, it } from 'vitest'
import { fromFreeMind, fromMarkdown, fromOpml, toFreeMind, toMarkdown, toOpml } from '../io/text'
import { fromXmind, fromXMarker, toXmind, toXMarker } from '../io/xmind'
import type { MapDocument, Topic } from '../editor/model'

const titles = (t: Topic): string => t.title + (t.children?.length ? '[' + t.children.map(titles).join(',') + ']' : '')
const doc: MapDocument = { version: 1, sheets: [{ id: 's', title: 'Лист', structure: 'logic-right', rootTopic: {
  id: 'r', title: 'Проект', children: [
    { id: 'a', title: 'Цели', notes: { plain: 'заметка', html: 'заметка' }, markers: ['priority-1', 'task-8'], labels: ['важно'],
      children: [{ id: 'a1', title: 'Выручка', task: { done: true } }] },
    { id: 'b', title: 'Риски', href: 'https://example.com', children: [] }],
} }] }

describe('форматы', () => {
  it('Markdown туда и обратно', () => {
    const back = fromMarkdown(toMarkdown(doc))
    expect(titles(back.sheets[0].rootTopic)).toBe(titles(doc.sheets[0].rootTopic))
    expect(back.sheets[0].rootTopic.children![0].children![0].task).toEqual({ done: true })
    expect(back.sheets[0].rootTopic.children![1].href).toBe('https://example.com')
  })
  it('OPML туда и обратно', () => {
    const back = fromOpml(toOpml(doc, 'T'))
    expect(titles(back.sheets[0].rootTopic)).toBe(titles(doc.sheets[0].rootTopic))
    expect(back.sheets[0].rootTopic.children![0].notes!.plain).toBe('заметка')
  })
  it('FreeMind туда и обратно', () => {
    const back = fromFreeMind(toFreeMind(doc))
    expect(titles(back.sheets[0].rootTopic)).toBe(titles(doc.sheets[0].rootTopic))
  })
  it('маркеры ↔ XMind', () => {
    for (const m of ['priority-3', 'task-4', 'month-2', 'week-7', 'smiley-sad', 'symbol-check', 'person-red', 'flag-blue', 'tag-purple', 'tag-gray', 'symbol-heart', 'symbol-pin'])
      expect(fromXMarker(toXMarker(m))).toBe(m)
  })
  it('.xmind туда и обратно', async () => {
    const back = await fromXmind(await toXmind(doc))
    const r = back.sheets[0].rootTopic
    expect(titles(r)).toBe(titles(doc.sheets[0].rootTopic))
    expect(back.sheets[0].structure).toBe('logic-right')
    expect(r.children![0]).toMatchObject({ markers: ['priority-1', 'task-8'], labels: ['важно'] })
    expect(r.children![0].children![0].task).toEqual({ done: true })
  })
  it('.xmind сохраняет зоны и настройки листа', async () => {
    const d = structuredClone(doc)
    Object.assign(d.sheets[0], { zones: [{ id: 'z', x: 1, y: 2, w: 30, h: 40, title: 'Идеи' }], palette: 'iris', pitchTheme: 'light', taskSkipWeekends: true })
    const back = await fromXmind(await toXmind(d))
    expect(back.sheets[0]).toMatchObject({ zones: [{ id: 'z', title: 'Идеи', w: 30 }], palette: 'iris', pitchTheme: 'light', taskSkipWeekends: true, structure: 'logic-right' })
  })
})
