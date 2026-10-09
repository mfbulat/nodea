import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { applyFlat, flatten, toDocument } from '../collab/ydoc'
import type { MapDocument, Topic } from '../editor/model'

const titles = (t: Topic): string => t.title + (t.children?.length ? '[' + t.children.map(titles).join(',') + ']' : '')
const base = (): MapDocument => ({ version: 1, sheets: [{ id: 's', title: 'Л', structure: 'logic-right', relationships: [{ id: 'r', end1: 'a', end2: 'b' }],
  rootTopic: { id: 'root', title: 'R', children: [
    { id: 'a', title: 'A', markers: ['priority-1'], children: [{ id: 'a1', title: 'A1', children: [] }],
      summaries: [{ id: 'sm', ids: ['a1'], topic: { id: 'st', title: 'S', children: [] } }], callouts: [{ id: 'c', title: 'C', children: [] }] },
    { id: 'b', title: 'B', children: [] }] },
  floatingTopics: [{ id: 'f', title: 'F', position: { x: 1, y: 2 }, children: [] }] }] })

function peer(src?: Y.Doc) {
  const d = new Y.Doc()
  if (src) Y.applyUpdate(d, Y.encodeStateAsUpdate(src))
  return d
}
const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))
}
const edit = (d: Y.Doc, fn: (doc: MapDocument) => void) => {
  const before = toDocument(d)
  const next = structuredClone(before)
  fn(next)
  applyFlat(d, flatten(before), flatten(next), 'local')
}

describe('Y.Doc ↔ документ', () => {
  it('туда и обратно', () => {
    const d = new Y.Doc()
    applyFlat(d, null, flatten(base()), 'init')
    expect(toDocument(d)).toEqual(base())
  })

  it('одновременные правки разных тем и вставки в один список сливаются', () => {
    const a = new Y.Doc()
    applyFlat(a, null, flatten(base()), 'init')
    const b = peer(a)
    edit(a, d => { d.sheets[0].rootTopic.children![0].title = 'A от первого' ; d.sheets[0].rootTopic.children!.push({ id: 'x', title: 'X', children: [] }) })
    edit(b, d => { d.sheets[0].rootTopic.children![1].title = 'B от второго'; d.sheets[0].rootTopic.children!.unshift({ id: 'y', title: 'Y', children: [] }) })
    sync(a, b)
    expect(toDocument(a)).toEqual(toDocument(b))
    expect(titles(toDocument(a).sheets[0].rootTopic)).toBe('R[Y,A от первого[A1],B от второго,X]')
  })

  it('перенос темы и удаление сохраняют согласованность', () => {
    const a = new Y.Doc()
    applyFlat(a, null, flatten(base()), 'init')
    const b = peer(a)
    edit(a, d => { const r = d.sheets[0].rootTopic; const a1 = r.children![0].children!.pop()!; r.children![1].children!.push(a1); r.children![0].summaries = undefined })
    edit(b, d => { d.sheets[0].rootTopic.children![0].children![0].title = 'A1*' })
    sync(a, b)
    const r = toDocument(a).sheets[0].rootTopic
    expect(titles(r)).toBe('R[A,B[A1*]]')
    expect(toDocument(b)).toEqual(toDocument(a))
  })
})
