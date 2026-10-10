// Перетаскивание тем как в веб-версии (замерено на app.xmind.com):
//  • у каждой видимой колонки детей есть зоны «вставить перед/после»: от края родителя до внешнего
//    края колонки, по вертикали — рамка каждого ребёнка ±30 px; верхняя половина — «перед», нижняя — «после»;
//  • у темы без видимых детей (или свёрнутой) — зона «дочерняя»: 48 px за внешним краем, рамка ±30 px;
//  • с ⌘/Ctrl — отпускание на теме делает её родителем;
//  • иначе пустое место: основная ветка при «свободном положении» остаётся веткой на новом месте,
//    всё остальное становится плавающей темой.
// Пороги заданы в экранных пикселях — одинаковое поведение при любом масштабе.
import type { Sheet, Topic } from './model'
import { indexSheet, isAncestor, type TopicRef } from './model'
import type { Box, LayoutResult, Pt } from './layout'

export type DropTarget =
  | { kind: 'insert'; parentId: string; beforeId: string | null; side?: 'r' | 'l'; ph: Box; from: Pt; to: Pt }
  | { kind: 'floating'; pos: Pt }
  | { kind: 'free'; pos: Pt }

const MARGIN = 30, CHILD_ZONE = 48, CHILD_GAP = 26, PH_W = 50, PH_H = 18

interface Col { parent: TopicRef; pb: Box; dir: 1 | -1; axis: 'x' | 'y'; kids: { t: Topic; b: Box }[] }

const cx = (b: Box) => b.x + b.w / 2, cy = (b: Box) => b.y + b.h / 2

export function findDrop(sheet: Sheet, layout: LayoutResult, p: Pt, ids: string[], o: { zoom: number; meta: boolean }): DropTarget {
  const idx = indexSheet(sheet)
  const m = MARGIN / o.zoom, cz = CHILD_ZONE / o.zoom
  const excluded = (id: string) => ids.some(x => x === id || isAncestor(idx, x, id))
  const boxes = layout.boxes
  const cand: { t: DropTarget & { kind: 'insert' }; d: number }[] = []

  // ⌘/Ctrl: отпущено прямо на теме — сделать её родителем
  if (o.meta) {
    for (const b of boxes.values()) {
      const ref = idx.get(b.id)
      if (!ref || excluded(b.id) || ref.kind === 'callout') continue
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return childTarget(ref, b, layout, idx, true)
    }
  }

  for (const b of boxes.values()) {
    const ref = idx.get(b.id)
    if (!ref || excluded(b.id) || ref.kind === 'callout') continue
    const axis = layout.childAxis.get(b.id) ?? 'y'
    const vis = (ref.topic.children ?? []).filter(k => boxes.has(k.id))
    const kids = ref.topic.collapsed ? [] : vis
    if (!kids.length) {
      // зона «дочерняя» за внешним краем темы
      const ct = childTarget(ref, b, layout, idx, false)
      const dir = growDir(ref, b, layout, idx)
      const inZone = axis === 'y'
        ? (dir > 0 ? p.x >= b.x + b.w && p.x <= b.x + b.w + cz : p.x <= b.x && p.x >= b.x - cz) && p.y >= b.y - m && p.y <= b.y + b.h + m
        : (dir > 0 ? p.y >= b.y + b.h && p.y <= b.y + b.h + cz : p.y <= b.y && p.y >= b.y - cz) && p.x >= b.x - m && p.x <= b.x + b.w + m
      if (inZone && ct.kind === 'insert') cand.push({ t: ct, d: dist(p, ct.ph) })
      if (ref.kind === 'root' && axis === 'y' && (sheet.structure ?? 'mindmap').startsWith('mindmap')) {
        const lt = childTarget(ref, b, layout, idx, false, -1)
        if (p.x <= b.x && p.x >= b.x - cz * 2.5 && p.y >= b.y - m * 2 && p.y <= b.y + b.h + m * 2 && lt.kind === 'insert') cand.push({ t: lt, d: dist(p, lt.ph) })
      }
      continue
    }
    // колонки детей по сторонам
    const cols = new Map<number, Col>()
    for (const k of kids) {
      const kb = boxes.get(k.id)!
      const dir: 1 | -1 = axis === 'y' ? (cx(kb) >= cx(b) ? 1 : -1) : (cy(kb) >= cy(b) ? 1 : -1)
      if (!cols.has(dir)) cols.set(dir, { parent: ref, pb: b, dir, axis, kids: [] })
      cols.get(dir)!.kids.push({ t: k, b: kb })
    }
    for (const col of cols.values()) {
      const t = colTarget(col, p, m, idx, sheet)
      if (t) cand.push({ t, d: dist(p, t.ph) })
    }
    // у центральной темы интеллект-карты пустая сторона тоже принимает темы (все ветки справа → можно перенести влево)
    if (ref.kind === 'root' && axis === 'y' && (sheet.structure ?? 'mindmap').startsWith('mindmap')) {
      for (const dir of [1, -1] as const) {
        if (cols.has(dir)) continue
        const ct = childTarget(ref, b, layout, idx, false, dir)
        const zone = cz * 2.5
        const inZone = (dir > 0 ? p.x >= b.x + b.w && p.x <= b.x + b.w + zone : p.x <= b.x && p.x >= b.x - zone) && p.y >= b.y - m * 2 && p.y <= b.y + b.h + m * 2
        if (inZone && ct.kind === 'insert') cand.push({ t: ct, d: dist(p, ct.ph) })
      }
    }
  }
  if (cand.length) return cand.sort((a, b) => a.d - b.d)[0].t

  // пустое место
  const moving = ids.map(id => idx.get(id)).filter(Boolean) as TopicRef[]
  const grabbed = moving[0]
  const st = sheet.structure ?? 'mindmap'
  if (sheet.freeBranch && moving.length === 1 && grabbed?.kind === 'child' && grabbed.parent?.id === sheet.rootTopic.id && st.startsWith('mindmap'))
    return { kind: 'free', pos: p }
  return { kind: 'floating', pos: p }
}

const dist = (p: Pt, b: Box) => Math.hypot(Math.max(b.x - p.x, 0, p.x - b.x - b.w), Math.max(b.y - p.y, 0, p.y - b.y - b.h))

/** направление роста детей темы: по стороне относительно родителя (для оси y) или вниз/вверх (для оси x) */
function growDir(ref: TopicRef, b: Box, layout: LayoutResult, idx: Map<string, TopicRef>): 1 | -1 {
  const par = ref.parent && layout.boxes.get(ref.parent.id)
  const axis = layout.childAxis.get(b.id) ?? 'y'
  if (!par) return 1
  if (axis === 'y') return cx(b) >= cx(par) ? 1 : -1
  void idx
  return cy(b) >= cy(par) ? 1 : -1
}

function childTarget(ref: TopicRef, b: Box, layout: LayoutResult, idx: Map<string, TopicRef>, append: boolean, forceDir?: 1 | -1): DropTarget {
  const axis = layout.childAxis.get(b.id) ?? 'y'
  const dir = forceDir ?? growDir(ref, b, layout, idx)
  const ph: Box = axis === 'y'
    ? { id: 'ph', x: dir > 0 ? b.x + b.w + CHILD_GAP : b.x - CHILD_GAP - PH_W, y: cy(b) - PH_H / 2, w: PH_W, h: PH_H }
    : { id: 'ph', x: cx(b) - PH_W / 2, y: dir > 0 ? b.y + b.h + CHILD_GAP : b.y - CHILD_GAP - PH_H, w: PH_W, h: PH_H }
  void append
  const from = axis === 'y' ? { x: dir > 0 ? b.x + b.w : b.x, y: cy(b) } : { x: cx(b), y: dir > 0 ? b.y + b.h : b.y }
  const to = axis === 'y' ? { x: dir > 0 ? ph.x : ph.x + PH_W, y: cy(ph) } : { x: cx(ph), y: dir > 0 ? ph.y : ph.y + PH_H }
  return { kind: 'insert', parentId: ref.topic.id, beforeId: null, side: ref.kind === 'root' ? (dir > 0 ? 'r' : 'l') : undefined, ph, from, to }
}

/** зона колонки детей: перед/после ребёнка по положению курсора */
function colTarget(col: Col, p: Pt, m: number, idx: Map<string, TopicRef>, sheet: Sheet): (DropTarget & { kind: 'insert' }) | null {
  const { pb, dir, axis, parent } = col
  const along = (b: Box) => (axis === 'y' ? b.y : b.x), alongEnd = (b: Box) => (axis === 'y' ? b.y + b.h : b.x + b.w)
  const kids = [...col.kids].sort((a, b) => along(a.b) - along(b.b))
  // поперечный диапазон: от края родителя до внешнего края колонки
  const cross = (b: Box) => (axis === 'y' ? [b.x, b.x + b.w] : [b.y, b.y + b.h])
  const pEdge = axis === 'y' ? (dir > 0 ? pb.x + pb.w : pb.x) : (dir > 0 ? pb.y + pb.h : pb.y)
  const outer = dir > 0 ? Math.max(...kids.map(k => cross(k.b)[1])) : Math.min(...kids.map(k => cross(k.b)[0]))
  const pc = axis === 'y' ? p.x : p.y, pa = axis === 'y' ? p.y : p.x
  const lo = Math.min(pEdge, outer), hi = Math.max(pEdge, outer)
  if (pc < lo || pc > hi) return null
  if (pa < along(kids[0].b) - m || pa > alongEnd(kids[kids.length - 1].b) + m) return null
  // какой ребёнок «владеет» точкой: границы — середины промежутков между соседями
  let i = 0
  while (i < kids.length - 1 && pa > (alongEnd(kids[i].b) + along(kids[i + 1].b)) / 2) i++
  const k = kids[i]
  const before = pa < (along(k.b) + alongEnd(k.b)) / 2
  const prev = before ? kids[i - 1] : k, next = before ? k : kids[i + 1]
  // плашка: в промежутке между соседями, у внутреннего края колонки
  const innerEdge = dir > 0 ? Math.min(...kids.map(q => cross(q.b)[0])) : Math.max(...kids.map(q => cross(q.b)[1]))
  let a: number
  if (prev && next) a = (alongEnd(prev.b) + along(next.b)) / 2 - (axis === 'y' ? PH_H : PH_W) / 2
  else if (next) a = along(next.b) - 6 - (axis === 'y' ? PH_H : PH_W)
  else a = alongEnd(prev!.b) + 6
  const ph: Box = axis === 'y'
    ? { id: 'ph', x: dir > 0 ? innerEdge : innerEdge - PH_W, y: a, w: PH_W, h: PH_H }
    : { id: 'ph', x: a, y: dir > 0 ? innerEdge : innerEdge - PH_H, w: PH_W, h: PH_H }
  // порядок в массиве детей: колонка может идти по массиву в обратном порядке (левая сторона карты)
  const order = (parent.topic.children ?? []).map(c => c.id)
  const asc = kids.length < 2 || order.indexOf(kids[0].t.id) < order.indexOf(kids[kids.length - 1].t.id)
  let beforeId: string | null
  if (asc) beforeId = before ? k.t.id : (next ? next.t.id : nextInArray(order, k.t.id))
  else beforeId = before ? nextInArray(order, k.t.id) : k.t.id
  // «перед» соседом, следующим в массиве за последним элементом колонки, на другой стороне — значит в конец стороны
  const isRoot = parent.kind === 'root'
  const from = axis === 'y' ? { x: pEdge, y: cy(pb) } : { x: cx(pb), y: pEdge }
  const to = axis === 'y' ? { x: dir > 0 ? ph.x : ph.x + PH_W, y: cy(ph) } : { x: cx(ph), y: dir > 0 ? ph.y : ph.y + PH_H }
  void idx; void sheet
  return { kind: 'insert', parentId: parent.topic.id, beforeId, side: isRoot ? (dir > 0 ? 'r' : 'l') : undefined, ph, from, to }
}

function nextInArray(order: string[], id: string): string | null {
  const i = order.indexOf(id)
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null
}
