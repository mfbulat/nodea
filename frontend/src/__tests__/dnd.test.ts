import { beforeEach, describe, expect, it } from 'vitest'
import { useDoc } from '../store/doc'
import { useEditor } from '../editor/store'
import { layoutSheet } from '../editor/layout'
import { findDrop } from '../editor/dnd'
import type { MapDocument, Sheet, Topic } from '../editor/model'

const ed = () => useEditor.getState()
const sh = () => useDoc.getState().doc!.sheets[0] as Sheet
const kids = () => (sh().rootTopic.children ?? []).map(k => k.title).join(',')
const size = (x: Topic) => ({ w: 40 + x.title.length * 8, h: 24, underline: false })
const lay = () => layoutSheet(sh(), size)
const center = (id: string) => { const b = lay().boxes.get(id)!; return { x: b.x + b.w / 2, y: b.y + b.h / 2, b } }
const side = (id: string) => center(id).x > center('r').x ? 'r' : 'l'

beforeEach(() => {
  const main = [1, 2, 3, 4, 5].map(i => ({ id: 'm' + i, title: String(i), children: i === 1 ? [{ id: 'c1', title: 'C1' }, { id: 'c2', title: 'C2' }] : [] }))
  const document: MapDocument = { version: 1, sheets: [{ id: 's', title: 'L', structure: 'mindmap-cw', rootTopic: { id: 'r', title: 'Центр', children: main } }] }
  useDoc.setState({ mapId: null, doc: document, title: 'T', revision: 1 })
  ed().reset()
})

describe('перетаскивание как в веб-версии', () => {
  it('баланс: стороны делятся по количеству (3 справа, 2 слева)', () => {
    expect(['m1', 'm2', 'm3'].map(side)).toEqual(['r', 'r', 'r'])
    expect(['m4', 'm5'].map(side)).toEqual(['l', 'l'])
  })

  it('зона «перед/после» в колонке детей: верхняя половина — перед', () => {
    const c2 = center('c2')
    const t = findDrop(sh(), lay(), { x: c2.x, y: c2.b.y + 2 }, ['m3'], { zoom: 1, meta: false })
    expect(t).toMatchObject({ kind: 'insert', parentId: 'm1', beforeId: 'c2' })
    const t2 = findDrop(sh(), lay(), { x: c2.x, y: c2.b.y + c2.b.h - 2 }, ['m3'], { zoom: 1, meta: false })
    expect(t2).toMatchObject({ kind: 'insert', parentId: 'm1', beforeId: null })
  })

  it('зона «дочерняя» за внешним краем темы без детей', () => {
    const m2 = center('m2')
    const t = findDrop(sh(), lay(), { x: m2.b.x + m2.b.w + 20, y: m2.y }, ['c1'], { zoom: 1, meta: false })
    expect(t).toMatchObject({ kind: 'insert', parentId: 'm2', beforeId: null })
  })

  it('пустое место — плавающая тема; ⌘ на теме — дочерняя', () => {
    const far = { x: center('r').x, y: center('r').y + 2000 }
    expect(findDrop(sh(), lay(), far, ['m2'], { zoom: 1, meta: false }).kind).toBe('floating')
    const m4 = center('m4')
    expect(findDrop(sh(), lay(), { x: m4.x, y: m4.y }, ['m2'], { zoom: 1, meta: true })).toMatchObject({ kind: 'insert', parentId: 'm4' })
  })

  it('нельзя бросить в себя или в своего потомка', () => {
    const c1 = center('c1')
    const t = findDrop(sh(), lay(), { x: c1.x, y: c1.y }, ['m1'], { zoom: 1, meta: true })
    expect(t.kind === 'insert' && ['m1', 'c1', 'c2'].includes(t.parentId)).toBe(false)
  })

  it('drop: вставка, копия (Alt), плавающая, отмена', () => {
    ed().drop(['m5'], { kind: 'insert', parentId: 'r', beforeId: 'm2', ph: { id: 'ph', x: 0, y: 0, w: 0, h: 0 }, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } })
    expect(kids()).toBe('1,5,2,3,4')
    ed().drop(['m4'], { kind: 'insert', parentId: 'm1', beforeId: null, ph: { id: 'ph', x: 0, y: 0, w: 0, h: 0 }, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }, true)
    expect(kids()).toBe('1,5,2,3,4')
    expect(sh().rootTopic.children![0].children!.map(k => k.title)).toEqual(['C1', 'C2', '4'])
    expect(sh().rootTopic.children![0].children![2].id).not.toBe('m4')
    ed().drop(['m2', 'm3'], { kind: 'floating', pos: { x: 10, y: 20 } })
    expect(kids()).toBe('1,5,4')
    expect(sh().floatingTopics!.map(f => [f.title, f.position!.y])).toEqual([['2', 20], ['3', 80]])
    ed().undo()
    expect(kids()).toBe('1,5,2,3,4')
  })

  it('без баланса стороны фиксируются и сохраняются при вставке', () => {
    ed().setBalance(false)
    expect(sh().rootTopic.children!.map(k => k.side)).toEqual(['r', 'r', 'r', 'l', 'l'])
    // переносим «2» на левую сторону — справа остаются две
    ed().drop(['m2'], { kind: 'insert', parentId: 'r', beforeId: null, side: 'l', ph: { id: 'ph', x: 0, y: 0, w: 0, h: 0 }, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } })
    expect(['m1', 'm3'].map(side)).toEqual(['r', 'r'])
    expect(['m2', 'm4', 'm5'].map(side)).toEqual(['l', 'l', 'l'])
    // соседняя тема наследует сторону
    ed().select(['m2']); ed().addSibling(false); ed().stopEdit()
    expect(sh().rootTopic.children!.filter(k => k.side === 'l').length).toBe(4)
    ed().setBalance(true)
    expect(sh().rootTopic.children!.some(k => k.side)).toBe(false)
  })

  it('свободное положение ветки: остаётся основной и стоит, где отпустили', () => {
    useEditor.getState().setSheet({ freeBranch: true })
    const far = { x: center('r').x + 600, y: center('r').y - 400 }
    expect(findDrop(sh(), lay(), far, ['m2'], { zoom: 1, meta: false }).kind).toBe('free')
    ed().drop(['m2'], { kind: 'free', pos: { x: 600, y: -400 } })
    expect(kids()).toBe('1,2,3,4,5')
    const c = center('m2'), rc = center('r')
    expect(Math.round(c.x - rc.x)).toBe(600)
    expect(Math.round(c.y - rc.y)).toBe(-400)
    ed().select(['m2']); ed().resetPosition()
    expect(sh().rootTopic.children![1].freePos).toBeUndefined()
  })
})

describe('пустая сторона центральной темы', () => {
  it('все ветки справа — можно перенести тему влево', () => {
    ed().setBalance(false)
    // ставим все основные темы справа
    useEditor.getState().setTopic(['m4', 'm5'], { side: 'r' })
    expect(['m1', 'm2', 'm3', 'm4', 'm5'].map(side)).toEqual(['r', 'r', 'r', 'r', 'r'])
    const r = center('r')
    const t = findDrop(sh(), lay(), { x: r.b.x - 40, y: r.y }, ['m2'], { zoom: 1, meta: false })
    expect(t).toMatchObject({ kind: 'insert', parentId: 'r', side: 'l' })
    ed().drop(['m2'], t)
    expect(side('m2')).toBe('l')
    expect(['m1', 'm3', 'm4', 'm5'].map(side)).toEqual(['r', 'r', 'r', 'r'])
  })
})
