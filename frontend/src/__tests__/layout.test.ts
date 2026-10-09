import { describe, expect, it } from 'vitest'
import { layoutSheet, STRUCTURES } from '../editor/layout'
import type { Sheet, StructureId, Topic } from '../editor/model'

let n = 0
const t = (title: string, children: Topic[] = []): Topic => ({ id: 't' + n++, title, children })
const sheet = (structure: StructureId): Sheet => ({
  id: 's', title: 'Лист', structure,
  rootTopic: t('Корень', [t('A', [t('A1'), t('A2', [t('A21')])]), t('B', [t('B1')]), t('C'), t('D', [t('D1'), t('D2')])]),
})
const size = (x: Topic) => ({ w: 40 + x.title.length * 8, h: 24, underline: false })
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5

describe('движок раскладок', () => {
  for (const { id } of STRUCTURES) {
    it(`${id}: все темы размещены без наложений`, () => {
      const sh = sheet(id)
      const l = layoutSheet(sh, size)
      expect(l.boxes.size).toBe(11)
      const boxes = [...l.boxes.values()]
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          if (!boxes[i].cell && !boxes[j].cell) expect(overlap(boxes[i], boxes[j]), `${boxes[i].id} × ${boxes[j].id}`).toBe(false)
      for (const b of boxes) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true)
        expect(b.x).toBeGreaterThanOrEqual(l.bounds.minX - 0.01)
        expect(b.x + b.w).toBeLessThanOrEqual(l.bounds.maxX + 0.01)
      }
    })
  }

  it('центральная тема в начале координат', () => {
    const l = layoutSheet(sheet('mindmap'), size)
    const r = l.boxes.get(sheet('mindmap').rootTopic.id) ?? [...l.boxes.values()][0]
    expect(r.x + r.w / 2).toBeCloseTo(0)
    expect(r.y + r.h / 2).toBeCloseTo(0)
  })

  it('свёрнутая ветка скрывает потомков и даёт счётчик', () => {
    const sh = sheet('logic-right')
    sh.rootTopic.children![0].collapsed = true
    const l = layoutSheet(sh, size)
    expect(l.boxes.size).toBe(8)
    expect(l.toggles.find(x => x.id === sh.rootTopic.children![0].id)).toMatchObject({ collapsed: true, count: 3 })
  })

  it('logic-right: дети правее родителя, порядок сохраняется', () => {
    const sh = sheet('logic-right')
    const l = layoutSheet(sh, size)
    const root = l.boxes.get(sh.rootTopic.id)!
    const ys = sh.rootTopic.children!.map(c => l.boxes.get(c.id)!)
    for (const b of ys) expect(b.x).toBeGreaterThan(root.x + root.w)
    for (let i = 1; i < ys.length; i++) expect(ys[i].y).toBeGreaterThan(ys[i - 1].y)
  })

  it('отдельная раскладка ветки: org-down внутри mind map', () => {
    const sh = sheet('mindmap')
    const a = sh.rootTopic.children![0]
    a.structure = 'org-down'
    const l = layoutSheet(sh, size)
    const pa = l.boxes.get(a.id)!
    for (const c of a.children!) expect(l.boxes.get(c.id)!.y).toBeGreaterThan(pa.y + pa.h)
  })

  it('сводка, граница и выноска', () => {
    const sh = sheet('logic-right')
    const a = sh.rootTopic.children![0]
    a.summaries = [{ id: 'sm', ids: a.children!.map(c => c.id), topic: t('Итог') }]
    a.boundaries = [{ id: 'bd', ids: [a.children![0].id] }]
    a.callouts = [t('Выноска')]
    const l = layoutSheet(sh, size)
    const sm = l.boxes.get(a.summaries[0].topic.id)!
    for (const c of a.children!) expect(sm.x).toBeGreaterThan(l.boxes.get(c.id)!.x)
    expect(l.edges.some(e => e.kind === 'brace' && e.to === a.summaries![0].topic.id)).toBe(true)
    expect(l.boundaries).toHaveLength(1)
    expect(l.boxes.has(a.callouts[0].id)).toBe(true)
  })
})
