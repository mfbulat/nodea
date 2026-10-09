// Документ карты ↔ Y.Doc. Схема совпадает с backend/app/ydoc.py:
//   nodes: id → Y.Map { поле: JSON, children: Y.Array<id>, callouts: Y.Array<id> }
//   sheets: id → Y.Map { поле: JSON, root: JSON(id), floating: Y.Array<id> }
//   order: Y.Array<id листа>
import * as Y from 'yjs'
import type { MapDocument, Sheet, Topic } from '../editor/model'

interface FlatNode { fields: Record<string, string>; children: string[]; callouts: string[] }
interface FlatSheet { fields: Record<string, string>; floating: string[] }
export interface Flat { nodes: Map<string, FlatNode>; sheets: Map<string, FlatSheet>; order: string[] }

const TOPIC_STRUCT = new Set(['id', 'children', 'callouts', 'summaries'])
const SHEET_STRUCT = new Set(['id', 'rootTopic', 'floatingTopics'])
const ARRAYS = new Set(['children', 'callouts', 'floating'])

export function flatten(doc: MapDocument): Flat {
  const nodes = new Map<string, FlatNode>()
  const add = (t: Topic): string => {
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(t)) if (!TOPIC_STRUCT.has(k) && v !== undefined) fields[k] = JSON.stringify(v)
    if (t.summaries?.length) fields.summaries = JSON.stringify(t.summaries.map(s => ({ id: s.id, ids: s.ids, topicId: add(s.topic) })))
    nodes.set(t.id, { fields, children: (t.children ?? []).map(add), callouts: (t.callouts ?? []).map(add) })
    return t.id
  }
  const sheets = new Map<string, FlatSheet>()
  for (const sh of doc.sheets) {
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(sh)) if (!SHEET_STRUCT.has(k) && v !== undefined) fields[k] = JSON.stringify(v)
    fields.root = JSON.stringify(add(sh.rootTopic))
    sheets.set(sh.id, { fields, floating: (sh.floatingTopics ?? []).map(add) })
  }
  return { nodes, sheets, order: doc.sheets.map(s => s.id) }
}

/** Минимальная правка Y.Array: общий префикс/суффикс сохраняются (одновременные вставки сливаются) */
function patchArray(arr: Y.Array<string>, next: string[]) {
  const cur = arr.toArray()
  let a = 0
  while (a < cur.length && a < next.length && cur[a] === next[a]) a++
  let b = 0
  while (b < cur.length - a && b < next.length - a && cur[cur.length - 1 - b] === next[next.length - 1 - b]) b++
  const del = cur.length - a - b
  if (del) arr.delete(a, del)
  const ins = next.slice(a, next.length - b)
  if (ins.length) arr.insert(a, ins)
}

function patchMap(m: Y.Map<unknown>, prev: Record<string, string> | undefined, next: Record<string, string>) {
  for (const [k, v] of Object.entries(next)) if (prev?.[k] !== v || m.get(k) !== v) m.set(k, v)
  for (const k of [...m.keys()]) if (!ARRAYS.has(k) && !(k in next)) m.delete(k)
}

function newEntry(fields: Record<string, string>, arrays: Record<string, string[]>) {
  const m = new Y.Map<unknown>()
  for (const [k, v] of Object.entries(fields)) m.set(k, v)
  for (const [k, v] of Object.entries(arrays)) { const a = new Y.Array<string>(); a.insert(0, v); m.set(k, a) }
  return m
}

export const roots = (ydoc: Y.Doc) => ({
  nodes: ydoc.getMap<Y.Map<unknown>>('nodes'),
  sheets: ydoc.getMap<Y.Map<unknown>>('sheets'),
  order: ydoc.getArray<string>('order'),
})

/** Применить разницу prev → next к Y.Doc одной транзакцией */
export function applyFlat(ydoc: Y.Doc, prev: Flat | null, next: Flat, origin: unknown) {
  const { nodes, sheets, order } = roots(ydoc)
  ydoc.transact(() => {
    for (const [id, n] of next.nodes) {
      const p = prev?.nodes.get(id)
      const m = nodes.get(id)
      if (!m) { nodes.set(id, newEntry(n.fields, { children: n.children, callouts: n.callouts })); continue }
      patchMap(m, p?.fields, n.fields)
      if (!p || p.children.join() !== n.children.join()) patchArray(m.get('children') as Y.Array<string>, n.children)
      if (!p || p.callouts.join() !== n.callouts.join()) patchArray(m.get('callouts') as Y.Array<string>, n.callouts)
    }
    if (prev) for (const id of prev.nodes.keys()) if (!next.nodes.has(id)) nodes.delete(id)
    for (const [id, s] of next.sheets) {
      const p = prev?.sheets.get(id)
      const m = sheets.get(id)
      if (!m) { sheets.set(id, newEntry(s.fields, { floating: s.floating })); continue }
      patchMap(m, p?.fields, s.fields)
      if (!p || p.floating.join() !== s.floating.join()) patchArray(m.get('floating') as Y.Array<string>, s.floating)
    }
    if (prev) for (const id of prev.sheets.keys()) if (!next.sheets.has(id)) sheets.delete(id)
    if (!prev || prev.order.join() !== next.order.join()) patchArray(order, next.order)
  }, origin)
}

export function toDocument(ydoc: Y.Doc): MapDocument {
  const { nodes, sheets, order } = roots(ydoc)
  const topic = (id: string, seen: Set<string>): Topic | null => {
    const m = nodes.get(id)
    if (!m || seen.has(id)) return null
    seen.add(id)
    const t: Topic = { id, title: '' }
    let summaries: { id: string; ids: string[]; topicId: string }[] | null = null
    for (const [k, v] of m.entries()) {
      if (k === 'children' || k === 'callouts') continue
      if (k === 'summaries') { summaries = JSON.parse(v as string); continue }
      t[k] = JSON.parse(v as string)
    }
    const list = (k: string) => ((m.get(k) as Y.Array<string> | undefined)?.toArray() ?? []).map(c => topic(c, seen)).filter((x): x is Topic => !!x)
    t.children = list('children')
    const callouts = list('callouts')
    if (callouts.length) t.callouts = callouts
    if (summaries) {
      const out = summaries.map(s => { const st = topic(s.topicId, seen); return st ? { id: s.id, ids: s.ids, topic: st } : null })
        .filter((x): x is NonNullable<typeof x> => !!x)
      if (out.length) t.summaries = out
    }
    return t
  }
  const out: Sheet[] = []
  const seenSheets = new Set<string>()
  for (const sid of order.toArray()) {
    const m = sheets.get(sid)
    if (!m || seenSheets.has(sid)) continue
    seenSheets.add(sid)
    const sh: Record<string, unknown> = { id: sid }
    for (const [k, v] of m.entries()) if (k !== 'root' && k !== 'floating') sh[k] = JSON.parse(v as string)
    const seen = new Set<string>()
    const root = topic(JSON.parse(m.get('root') as string), seen)
    if (!root) continue
    sh.rootTopic = root
    const fl = ((m.get('floating') as Y.Array<string>)?.toArray() ?? []).map(f => topic(f, seen)).filter((x): x is Topic => !!x)
    if (fl.length) sh.floatingTopics = fl
    out.push(sh as Sheet)
  }
  return { version: 1, sheets: out }
}
