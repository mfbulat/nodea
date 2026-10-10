// Движок раскладок. Каждая структура раскладывает поддерево в «блок» —
// координаты относительно левого верхнего угла самой темы. Блоки детей
// сдвигаются и вкладываются в блок родителя, поэтому у любой ветки может
// быть своя структура.
import type { Sheet, StructureId, Topic } from './model'

export interface Pt { x: number; y: number }
export interface Box { id: string; x: number; y: number; w: number; h: number; cell?: boolean }
export type EdgeKind = 'h' | 'v' | 'tree' | 'brace' | 'vbrace' | 'line'
export interface Edge { from: string; to: string; kind: EdgeKind; pts: Pt[]; /** ветка от центральной темы — выходит из-под неё */ fromRoot?: boolean }
export interface Deco { kind: 'grid' | 'spine' | 'callout'; pts: Pt[]; owner: string }
export interface BoundaryGeom { id: string; owner: string; x: number; y: number; w: number; h: number; title?: string; color?: string; lineStyle?: string; fill?: string }
export interface Toggle { id: string; x: number; y: number; collapsed: boolean; count: number }

interface Block {
  boxes: Box[]; edges: Edge[]; decos: Deco[]; toggles: Toggle[]
  minX: number; minY: number; maxX: number; maxY: number
}

export interface LayoutResult {
  boxes: Map<string, Box>
  edges: Edge[]
  decos: Deco[]
  toggles: Toggle[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  boundaries: BoundaryGeom[]
  /** структура, в которой лежат дети темы (для перетаскивания) */
  childAxis: Map<string, 'x' | 'y'>
}

export interface SizeInfo { w: number; h: number; underline: boolean; /** высота фигуры без меток */ shapeH?: number }
type SizeFn = (t: Topic) => SizeInfo

// отступы; «компактная карта» уменьшает их (задаются в layoutSheet)
let SIB_GAP = 5
let H_GAP = 30
let ROOT_GAP = 50
let V_GAP = 36
let MAIN_GAP = 40
let BALANCE = false

export const STRUCTURES: { id: StructureId; name: string }[] = [
  { id: 'mindmap', name: 'Mind Map (сбалансированная)' },
  { id: 'mindmap-cw', name: 'Mind Map (по часовой)' },
  { id: 'mindmap-acw', name: 'Mind Map (против часовой)' },
  { id: 'logic-right', name: 'Logic Chart (вправо)' },
  { id: 'logic-left', name: 'Logic Chart (влево)' },
  { id: 'brace-right', name: 'Brace Map (вправо)' },
  { id: 'brace-left', name: 'Brace Map (влево)' },
  { id: 'org-down', name: 'Org Chart (вниз)' },
  { id: 'org-up', name: 'Org Chart (вверх)' },
  { id: 'tree-right', name: 'Tree Chart (вправо)' },
  { id: 'tree-left', name: 'Tree Chart (влево)' },
  { id: 'timeline-h', name: 'Timeline (горизонтальная)' },
  { id: 'timeline-v', name: 'Timeline (вертикальная)' },
  { id: 'fishbone-left', name: 'Fishbone (голова слева)' },
  { id: 'fishbone-right', name: 'Fishbone (голова справа)' },
  { id: 'tree-table', name: 'Tree Table' },
  { id: 'matrix', name: 'Matrix' },
]

type Internal = StructureId | 'tree-right-up'

class Engine {
  childAxis = new Map<string, 'x' | 'y'>()
  constructor(private size: SizeFn) {}

  kids(t: Topic) { return t.collapsed ? [] : t.children ?? [] }

  leaf(t: Topic): Block {
    const s = this.size(t)
    return { boxes: [{ id: t.id, x: 0, y: 0, w: s.w, h: s.h }], edges: [], decos: [], toggles: [],
      minX: 0, minY: 0, maxX: s.w, maxY: s.h }
  }

  /** точка крепления линии по горизонтали (у «подчёркнутых» тем — нижняя линия) */
  anchorY(t: Topic) { const s = this.size(t); const sh = s.shapeH ?? s.h; return s.underline ? sh : sh / 2 }

  layout(t: Topic, st: Internal): Block {
    const b = this.layoutStructure(t, st)
    this.decorate(t, b)
    return b
  }

  /** Сводки (скобка + тема сводки) и выноски вокруг уже разложенного поддерева */
  decorate(t: Topic, b: Block) {
    const own = b.boxes.find(x => x.id === t.id)!
    for (const sm of t.collapsed ? [] : t.summaries ?? []) {
      const ids = new Set<string>()
      for (const k of this.kids(t)) if (sm.ids.includes(k.id)) subtreeIds(k, ids, true)
      const covered = b.boxes.filter(x => ids.has(x.id))
      if (!covered.length) continue
      const minX = Math.min(...covered.map(c => c.x)), maxX = Math.max(...covered.map(c => c.x + c.w))
      const minY = Math.min(...covered.map(c => c.y)), maxY = Math.max(...covered.map(c => c.y + c.h))
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      const ocx = own.x + own.w / 2, ocy = own.y + own.h / 2
      const down = minY > own.y + own.h && cx > own.x - 4 && cx < own.x + own.w + 4 && Math.abs(cx - ocx) < Math.abs(cy - ocy) && (maxX - minX) > (maxY - minY)
      const sb = this.layout(sm.topic, 'logic-right')
      const ss = this.size(sm.topic)
      if (down) {
        const y0 = maxY + 6, tip = y0 + 16
        merge(b, sb, cx - ss.w / 2, tip + 12 - sb.minY)
        b.edges.push({ from: t.id, to: sm.topic.id, kind: 'vbrace', pts: [{ x: minX, y: tip }, { x: cx, y: y0 }, { x: maxX, y: tip }] })
      } else {
        const dir = cx >= ocx ? 1 : -1
        const x0 = dir > 0 ? maxX + 6 : minX - 6, tip = x0 + dir * 16
        const dx = dir > 0 ? tip + 12 - sb.minX : tip - 12 - sb.maxX
        merge(b, sb, dx, cy - this.anchorY(sm.topic))
        b.edges.push({ from: t.id, to: sm.topic.id, kind: 'brace', pts: [{ x: tip, y: minY }, { x: x0, y: cy }, { x: tip, y: maxY }] })
      }
    }
    for (const c of t.callouts ?? []) {
      const cb = this.layout(c, 'logic-right')
      const cs = this.size(c)
      const off = c.position ?? { x: 12, y: -(cs.h + 28) }
      const dx = own.x + own.w + off.x, dy = own.y + off.y
      // выноска не раздвигает соседние ветки: габариты блока не меняем
      const keep = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }
      merge(b, cb, dx, dy)
      Object.assign(b, keep)
      b.decos.push({ kind: 'callout', owner: c.id, pts: [{ x: own.x + own.w * 0.75, y: own.y + own.h / 2 }, { x: dx + cs.w / 2, y: dy + cs.h / 2 }] })
    }
  }

  layoutStructure(t: Topic, st: Internal): Block {
    const own = (t.structure as Internal | undefined) ?? st
    switch (own) {
      case 'mindmap': case 'mindmap-cw': case 'mindmap-acw': return this.mindmap(t, own)
      case 'logic-right': return this.logic(t, 1, false, own)
      case 'logic-left': return this.logic(t, -1, false, own)
      case 'brace-right': return this.logic(t, 1, true, own)
      case 'brace-left': return this.logic(t, -1, true, own)
      case 'org-down': return this.org(t, 1, own)
      case 'org-up': return this.org(t, -1, own)
      case 'tree-right': return this.tree(t, 1, 1, own)
      case 'tree-left': return this.tree(t, -1, 1, own)
      case 'tree-right-up': return this.tree(t, 1, -1, own)
      case 'timeline-h': return this.timelineH(t)
      case 'timeline-v': return this.timelineV(t)
      case 'fishbone-left': return this.fishbone(t, 1)
      case 'fishbone-right': return this.fishbone(t, -1)
      case 'tree-table': return this.treeTable(t)
      case 'matrix': return this.matrix(t)
    }
    return this.logic(t, 1, false, 'logic-right')
  }

  addToggle(b: Block, t: Topic, x: number, y: number) {
    const n = t.children?.length ?? 0
    if (n) b.toggles.push({ id: t.id, x, y, collapsed: !!t.collapsed, count: countAll(t) })
  }

  // ---------- Logic / Brace ----------
  logic(t: Topic, dir: 1 | -1, brace: boolean, st: Internal): Block {
    const b = this.leaf(t)
    const s = this.size(t)
    const ay = this.anchorY(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'y')
    this.addToggle(b, t, dir > 0 ? s.w + 8 : -8, ay)
    if (!kids.length) return b
    const blocks = kids.map(k => this.layout(k, st))
    const gap = brace ? H_GAP + 16 : H_GAP
    const total = blocks.reduce((a, c) => a + (c.maxY - c.minY), 0) + SIB_GAP * (blocks.length - 1)
    let y = ay - total / 2
    const anchors: Pt[] = []
    blocks.forEach((cb, i) => {
      const k = kids[i], ks = this.size(k)
      const dx = dir > 0 ? s.w + gap - cb.minX : -gap - cb.maxX
      const dy = y - cb.minY
      merge(b, cb, dx, dy)
      const p2 = { x: dir > 0 ? dx : dx + ks.w, y: dy + this.anchorY(k) }
      anchors.push(p2)
      if (!brace) b.edges.push({ from: t.id, to: k.id, kind: 'h', pts: [{ x: dir > 0 ? s.w : 0, y: ay }, p2] })
      y += cb.maxY - cb.minY + SIB_GAP
    })
    if (brace) {
      const x = dir > 0 ? s.w + 10 : -10
      const top = anchors[0].y, bottom = anchors[anchors.length - 1].y
      b.edges.push({ from: t.id, to: kids[0].id, kind: 'brace',
        pts: [{ x, y: Math.min(top, ay - 8) }, { x: x + dir * (gap - 16), y: ay }, { x, y: Math.max(bottom, ay + 8) }] })
      b.toggles = b.toggles.filter(tg => tg.id !== t.id)
      this.addToggle(b, t, dir > 0 ? s.w + 4 : -4, ay)
    }
    return b
  }

  // ---------- Mind Map ----------
  mindmap(t: Topic, variant: Internal): Block {
    const b = this.leaf(t)
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'y')
    this.addToggle(b, t, s.w + 8, s.h / 2)
    if (!kids.length) return b
    const right: number[] = [], left: number[] = []
    const n = kids.length
    if (variant === 'mindmap') {
      const blocks = kids.map(k => this.layout(k, 'logic-right'))
      const hs = blocks.map(c => c.maxY - c.minY)
      const total = hs.reduce((a, c) => a + c, 0)
      let acc = 0
      kids.forEach((_, i) => { if (i === 0 || (acc < total / 2 && i < n - (n > 1 ? 1 : 0))) { right.push(i); acc += hs[i] } else left.push(i) })
      left.reverse()
    } else {
      // «баланс карты»: делим по суммарной высоте веток, а не по количеству
      let k = Math.ceil(n / 2)
      if (BALANCE && n > 1) {
        const hs = kids.map(kk => { const c = this.layout(kk, 'logic-right'); return c.maxY - c.minY })
        const total = hs.reduce((a, c) => a + c, 0)
        let acc = 0
        k = 0
        while (k < n - 1 && acc + hs[k] / 2 < total / 2) { acc += hs[k]; k++ }
        k = Math.max(1, k)
      }
      const first = [...Array(k).keys()], second = [...Array(n - k).keys()].map(i => i + k).reverse()
      if (variant === 'mindmap-cw') { right.push(...first); left.push(...second) }
      else { left.push(...first); right.push(...second) }
    }
    const side = (idx: number[], dir: 1 | -1) => {
      const blocks = idx.map(i => this.layout(kids[i], dir > 0 ? 'logic-right' : 'logic-left'))
      let gap = MAIN_GAP
      // XMind разводит крайние основные темы стороны минимум на две высоты центральной
      if (blocks.length > 1) {
        const first = this.size(kids[idx[0]]), last = this.size(kids[idx[idx.length - 1]])
        const span = blocks.reduce((a, c) => a + (c.maxY - c.minY), 0) + gap * (blocks.length - 1) - first.h / 2 - last.h / 2
        if (span < 2 * s.h) gap += (2 * s.h - span) / (blocks.length - 1)
      }
      const total = blocks.reduce((a, c) => a + (c.maxY - c.minY), 0) + gap * (blocks.length - 1)
      let y = s.h / 2 - total / 2
      blocks.forEach((cb, j) => {
        const k = kids[idx[j]], ks = this.size(k)
        const dx = dir > 0 ? s.w + ROOT_GAP - cb.minX : -ROOT_GAP - cb.maxX
        const dy = y - cb.minY
        merge(b, cb, dx, dy)
        // как в XMind: ветка начинается внутри центральной темы — на её горизонтали, в 2/3 полуширины
        const end = { x: dir > 0 ? dx : dx + ks.w, y: dy + this.anchorY(k) }
        const start = { x: s.w / 2 + dir * (s.w / 2) * (2 / 3), y: s.h / 2 }
        b.edges.push({ from: t.id, to: k.id, kind: 'h', fromRoot: true, pts: [start, end] })
        y += cb.maxY - cb.minY + gap
      })
    }
    side(right, 1)
    side(left, -1)
    return b
  }

  // ---------- Org Chart ----------
  org(t: Topic, dir: 1 | -1, st: Internal): Block {
    const b = this.leaf(t)
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'x')
    this.addToggle(b, t, s.w / 2, dir > 0 ? s.h + 8 : -8)
    if (!kids.length) return b
    const blocks = kids.map(k => this.layout(k, st))
    const total = blocks.reduce((a, c) => a + (c.maxX - c.minX), 0) + 20 * (blocks.length - 1)
    let x = s.w / 2 - total / 2
    blocks.forEach((cb, i) => {
      const k = kids[i], ks = this.size(k)
      const dx = x - cb.minX
      const dy = dir > 0 ? s.h + V_GAP - cb.minY : -V_GAP - cb.maxY
      merge(b, cb, dx, dy)
      b.edges.push({ from: t.id, to: k.id, kind: 'v',
        pts: [{ x: s.w / 2, y: dir > 0 ? s.h : 0 }, { x: dx + ks.w / 2, y: dir > 0 ? dy : dy + ks.h }] })
      x += cb.maxX - cb.minX + 20
    })
    return b
  }

  // ---------- Tree Chart ----------
  tree(t: Topic, dir: 1 | -1, vdir: 1 | -1, st: Internal): Block {
    const b = this.leaf(t)
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'y')
    const indent = Math.min(24, s.w / 2)
    const px = dir > 0 ? indent : s.w - indent
    this.addToggle(b, t, px, vdir > 0 ? s.h + 8 : -8)
    if (!kids.length) return b
    let y = vdir > 0 ? s.h + SIB_GAP : -SIB_GAP
    const list = kids.map((k, i) => ({ k, cb: this.layout(k, st), i }))
    for (const { k, cb } of list) {
      const ks = this.size(k)
      const dx = dir > 0 ? px + 20 - cb.minX : px - 20 - cb.maxX
      const dy = vdir > 0 ? y - cb.minY : y - cb.maxY
      merge(b, cb, dx, dy)
      b.edges.push({ from: t.id, to: k.id, kind: 'tree',
        pts: [{ x: px, y: vdir > 0 ? s.h : 0 }, { x: dir > 0 ? dx : dx + ks.w, y: dy + this.anchorY(k) }] })
      y += vdir * (cb.maxY - cb.minY + SIB_GAP)
    }
    return b
  }

  // ---------- Timeline ----------
  timelineH(t: Topic): Block {
    const b = this.leaf(t)
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'x')
    this.addToggle(b, t, s.w + 8, s.h / 2)
    if (!kids.length) return b
    let x = s.w + H_GAP
    let prev = { x: s.w, id: t.id }
    kids.forEach((k, i) => {
      const cb = this.layout(k, i % 2 === 0 ? 'tree-right' : 'tree-right-up')
      const ks = this.size(k)
      const dx = x - cb.minX
      const dy = s.h / 2 - ks.h / 2
      merge(b, cb, dx, dy)
      b.edges.push({ from: t.id, to: k.id, kind: 'line', pts: [{ x: prev.x, y: s.h / 2 }, { x: dx, y: s.h / 2 }] })
      prev = { x: dx + ks.w, id: k.id }
      x += cb.maxX - cb.minX + H_GAP
    })
    return b
  }

  timelineV(t: Topic): Block {
    const b = this.leaf(t)
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'y')
    this.addToggle(b, t, s.w / 2, s.h + 8)
    if (!kids.length) return b
    let y = s.h + V_GAP
    let prevY = s.h
    kids.forEach((k, i) => {
      const cb = this.layout(k, i % 2 === 0 ? 'logic-right' : 'logic-left')
      const ks = this.size(k)
      const dx = s.w / 2 - ks.w / 2
      const dy = y - cb.minY
      merge(b, cb, dx, dy)
      b.edges.push({ from: t.id, to: k.id, kind: 'line', pts: [{ x: s.w / 2, y: prevY }, { x: s.w / 2, y: dy }] })
      prevY = dy + ks.h
      y += cb.maxY - cb.minY + SIB_GAP + 10
    })
    return b
  }

  // ---------- Fishbone ----------
  // dir = 1: голова слева, хребет уходит вправо; dir = -1 — наоборот.
  fishbone(t: Topic, dir: 1 | -1): Block {
    const b = this.leaf(t)
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'x')
    this.addToggle(b, t, dir > 0 ? s.w + 8 : -8, s.h / 2)
    if (!kids.length) return b
    const sy = s.h / 2
    const K = 0.55 // наклон кости: dx = K * dy
    const sub = dir > 0 ? 'logic-right' : 'logic-left'
    // раскладываем каждую кость относительно точки на хребте (0,0)
    const bones = kids.map((k, i) => {
      const side = i % 2 === 0 ? -1 : 1 // -1 сверху
      const ks = this.size(k)
      const bb: Block = { boxes: [], edges: [], decos: [], toggles: [], minX: 0, minY: 0, maxX: 0, maxY: 0 }
      const subs = this.kids(k)
      this.childAxis.set(k.id, 'y')
      const blocks = subs.map(c => this.layout(c, sub))
      let dist = 24
      const placed: { cb: Block; d: number }[] = []
      // ближние к хребту — последние
      for (let j = blocks.length - 1; j >= 0; j--) {
        const cb = blocks[j]
        const h = cb.maxY - cb.minY
        placed[j] = { cb, d: dist + h / 2 }
        dist += h + 10
      }
      const L = dist + 10
      const end = { x: dir * L * K, y: side * L }
      // основная тема у дальнего конца кости
      const mx = end.x - ks.w / 2, my = side < 0 ? end.y - ks.h : end.y
      const mb = this.leaf(k)
      this.addToggle(mb, k, ks.w / 2, side < 0 ? ks.h + 8 : -8)
      merge(bb, mb, mx, my)
      bb.edges.push({ from: t.id, to: k.id, kind: 'line', pts: [{ x: 0, y: 0 }, end] })
      placed.forEach(({ cb, d }, j) => {
        const c = subs[j], cs = this.size(c)
        const dy = side * d - (cb.minY + cb.maxY) / 2
        const by = dy + this.anchorY(c)
        const bx = dir * Math.abs(by) * K
        const dx = dir > 0 ? bx + 14 - cb.minX : bx - 14 - cb.maxX
        merge(bb, cb, dx, dy)
        bb.edges.push({ from: k.id, to: c.id, kind: 'line',
          pts: [{ x: bx, y: by }, { x: dir > 0 ? dx : dx + cs.w, y: dy + this.anchorY(c) }] })
      })
      bb.minX = Math.min(bb.minX, 0); bb.maxX = Math.max(bb.maxX, 0)
      return { bb, side }
    })
    // пары костей (сверху/снизу) делят один участок хребта
    let x = dir > 0 ? s.w + 30 : -30
    let tail = x
    for (let i = 0; i < bones.length; i += 2) {
      const pair = bones.slice(i, i + 2)
      const head = Math.min(...pair.map(p => (dir > 0 ? p.bb.minX : -p.bb.maxX)))
      const sx = x - dir * head
      for (const p of pair) merge(b, p.bb, sx, sy)
      const far = Math.max(...pair.map(p => (dir > 0 ? p.bb.maxX : -p.bb.minX)))
      x = sx + dir * (far + 30)
      tail = x
    }
    b.decos.push({ kind: 'spine', owner: t.id, pts: [{ x: dir > 0 ? s.w : 0, y: sy }, { x: tail, y: sy }] })
    b.minX = Math.min(b.minX, tail); b.maxX = Math.max(b.maxX, tail)
    return b
  }

  // ---------- Tree Table ----------
  treeTable(t: Topic): Block {
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'y')
    const colW: number[] = []
    const heights = new Map<string, number>()
    const scan = (n: Topic, d: number): number => {
      this.childAxis.set(n.id, 'y')
      const ns = this.size(n)
      colW[d] = Math.max(colW[d] ?? 0, ns.w)
      const ch = this.kids(n)
      const sum = ch.reduce((a, c) => a + scan(c, d + 1), 0)
      const h = Math.max(ns.h, sum)
      heights.set(n.id, h)
      return h
    }
    const bodyH = kids.reduce((a, k) => a + scan(k, 0), 0)
    const totalW = Math.max(s.w, colW.reduce((a, c) => a + c, 0))
    if (colW.length) colW[colW.length - 1] += totalW - colW.reduce((a, c) => a + c, 0)
    const b: Block = { boxes: [{ id: t.id, x: 0, y: 0, w: totalW, h: s.h, cell: true }], edges: [], decos: [], toggles: [],
      minX: 0, minY: 0, maxX: totalW, maxY: s.h + bodyH }
    this.addToggle(b, t, totalW / 2, s.h + 2)
    const place = (n: Topic, d: number, x: number, y: number, h: number) => {
      const w = d === colW.length - 1 || !this.kids(n).length ? colW.slice(d).reduce((a, c) => a + c, 0) : colW[d]
      b.boxes.push({ id: n.id, x, y, w, h, cell: true })
      this.addToggle(b, n, x + w, y + h / 2)
      const ch = this.kids(n)
      const sum = ch.reduce((a, c) => a + heights.get(c.id)!, 0)
      let cy = y
      ch.forEach((c, i) => {
        const ch2 = heights.get(c.id)! + (i === ch.length - 1 ? h - sum : 0)
        place(c, d + 1, x + colW[d], cy, ch2)
        cy += ch2
      })
    }
    let y = s.h
    for (const k of kids) { const h = heights.get(k.id)!; place(k, 0, 0, y, h); y += h }
    return b
  }

  // ---------- Matrix ----------
  // Строки — основные темы, ячейки — их подтемы по порядку (столбцы).
  matrix(t: Topic): Block {
    const s = this.size(t)
    const kids = this.kids(t)
    this.childAxis.set(t.id, 'y')
    const rows = kids.map(k => ({ k, cells: this.kids(k).map(c => this.layout(c, 'logic-right')) }))
    rows.forEach(r => this.childAxis.set(r.k.id, 'x'))
    const PAD = 12
    const col0 = Math.max(s.w, ...kids.map(k => this.size(k).w)) + PAD * 2
    const ncol = Math.max(0, ...rows.map(r => r.cells.length))
    const colW = [...Array(ncol).keys()].map(j => Math.max(80, ...rows.map(r => r.cells[j] ? r.cells[j].maxX - r.cells[j].minX : 0)) + PAD * 2)
    const headH = s.h + PAD * 2
    const b: Block = { boxes: [{ id: t.id, x: PAD, y: PAD, w: s.w, h: s.h }], edges: [], decos: [], toggles: [],
      minX: 0, minY: 0, maxX: col0 + colW.reduce((a, c) => a + c, 0), maxY: headH }
    this.addToggle(b, t, PAD + s.w / 2, PAD + s.h + 6)
    let y = headH
    const hLines: number[] = [0, headH]
    for (const r of rows) {
      const ks = this.size(r.k)
      const rowH = Math.max(ks.h, ...r.cells.map(c => c.maxY - c.minY)) + PAD * 2
      const kb = this.leaf(r.k)
      this.addToggle(kb, r.k, ks.w + 8, ks.h / 2)
      merge(b, kb, PAD, y + (rowH - ks.h) / 2)
      let x = col0
      r.cells.forEach((cb, j) => {
        merge(b, cb, x + PAD - cb.minX, y + (rowH - (cb.maxY - cb.minY)) / 2 - cb.minY)
        x += colW[j]
      })
      y += rowH
      hLines.push(y)
    }
    const W = b.maxX
    b.maxY = y
    for (const ly of hLines) b.decos.push({ kind: 'grid', owner: t.id, pts: [{ x: 0, y: ly }, { x: W, y: ly }] })
    let x = 0
    for (const w of [0, col0, ...colW]) { x += w; b.decos.push({ kind: 'grid', owner: t.id, pts: [{ x, y: 0 }, { x, y }] }) }
    return b
  }
}

function merge(into: Block, b: Block, dx: number, dy: number) {
  const mv = (p: Pt) => ({ x: p.x + dx, y: p.y + dy })
  for (const bx of b.boxes) into.boxes.push({ ...bx, x: bx.x + dx, y: bx.y + dy })
  for (const e of b.edges) into.edges.push({ ...e, pts: e.pts.map(mv) })
  for (const d of b.decos) into.decos.push({ ...d, pts: d.pts.map(mv) })
  for (const tg of b.toggles) into.toggles.push({ ...tg, x: tg.x + dx, y: tg.y + dy })
  into.minX = Math.min(into.minX, b.minX + dx); into.maxX = Math.max(into.maxX, b.maxX + dx)
  into.minY = Math.min(into.minY, b.minY + dy); into.maxY = Math.max(into.maxY, b.maxY + dy)
}

/** id темы и всех её потомков (с темами сводок и выносками) */
export function subtreeIds(t: Topic, into = new Set<string>(), extras = true): Set<string> {
  into.add(t.id)
  if (!t.collapsed) t.children?.forEach(c => subtreeIds(c, into, extras))
  if (extras) {
    if (!t.collapsed) t.summaries?.forEach(s => subtreeIds(s.topic, into, extras))
    t.callouts?.forEach(c => subtreeIds(c, into, extras))
  }
  return into
}

export function countAll(t: Topic): number {
  return (t.children ?? []).reduce((a, c) => a + 1 + countAll(c), 0)
}

/** Раскладка листа. Начало координат — центр центральной темы. */
export function layoutSheet(sheet: Sheet, size: SizeFn): LayoutResult {
  const c = !!sheet.compact
  SIB_GAP = c ? 2 : 6; H_GAP = c ? 16 : 27; ROOT_GAP = c ? 32 : 51; V_GAP = c ? 22 : 36; MAIN_GAP = c ? 14 : 35
  // как в веб-версии: «баланс карты» делит основные темы поровну по сторонам (по умолчанию включён)
  BALANCE = false
  const eng = new Engine(size)
  const root = sheet.rootTopic
  const rs = size(root)
  const all: Block = { boxes: [], edges: [], decos: [], toggles: [], minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const rb = eng.layout({ ...root, structure: undefined, collapsed: false }, sheet.structure ?? 'mindmap')
  rb.toggles = rb.toggles.filter(t => t.id !== root.id)
  // структура задаётся листом; собственная structure у центральной темы не используется
  merge(all, rb, -rs.w / 2, -rs.h / 2)
  all.minX = rb.minX - rs.w / 2; all.minY = rb.minY - rs.h / 2
  for (const f of sheet.floatingTopics ?? []) {
    const fb = eng.layout(f, 'logic-right')
    const p = f.position ?? { x: 0, y: 0 }
    merge(all, fb, p.x, p.y)
  }
  // свободное положение веток: сдвигаем поддерево темы вместе со всем содержимым
  if (sheet.freeBranch) {
    const shiftTopic = (t: Topic) => {
      t.children?.forEach(shiftTopic)
      if (!t.offset || t === root) return
      const ids = subtreeIds(t)
      const { x: ox, y: oy } = t.offset
      for (const b of all.boxes) if (ids.has(b.id)) { b.x += ox; b.y += oy }
      for (const e of all.edges) {
        if (ids.has(e.from)) e.pts = e.pts.map(p => ({ x: p.x + ox, y: p.y + oy }))
        else if (e.to === t.id) e.pts = e.pts.map((p, i) => (i === e.pts.length - 1 ? { x: p.x + ox, y: p.y + oy } : p))
      }
      for (const tg of all.toggles) if (ids.has(tg.id)) { tg.x += ox; tg.y += oy }
      for (const d of all.decos) if (ids.has(d.owner)) d.pts = d.pts.map(p => ({ x: p.x + ox, y: p.y + oy }))
    }
    shiftTopic(root)
  }
  const boxes = new Map(all.boxes.map(b => [b.id, b]))
  for (const b of all.boxes) {
    all.minX = Math.min(all.minX, b.x); all.minY = Math.min(all.minY, b.y)
    all.maxX = Math.max(all.maxX, b.x + b.w); all.maxY = Math.max(all.maxY, b.y + b.h)
  }
  // границы: прямоугольник вокруг поддеревьев выбранных детей
  const boundaries: BoundaryGeom[] = []
  const visit = (t: Topic) => {
    if (t.collapsed && t !== root) return
    for (const bd of t.boundaries ?? []) {
      const ids = new Set<string>()
      for (const k of t.children ?? []) if (bd.ids.includes(k.id)) subtreeIds(k, ids)
      if (bd.ids.includes(t.id)) subtreeIds(t, ids)
      const bs = [...ids].map(i => boxes.get(i)).filter((x): x is Box => !!x)
      if (!bs.length) continue
      const pad = 10
      const x = Math.min(...bs.map(c => c.x)) - pad, y = Math.min(...bs.map(c => c.y)) - pad - (bd.title ? 18 : 0)
      const x2 = Math.max(...bs.map(c => c.x + c.w)) + pad, y2 = Math.max(...bs.map(c => c.y + c.h)) + pad
      boundaries.push({ id: bd.id, owner: t.id, x, y, w: x2 - x, h: y2 - y, title: bd.title, color: bd.color, lineStyle: bd.lineStyle, fill: bd.fill })
      all.minX = Math.min(all.minX, x); all.minY = Math.min(all.minY, y); all.maxX = Math.max(all.maxX, x2); all.maxY = Math.max(all.maxY, y2)
    }
    t.children?.forEach(visit)
    t.summaries?.forEach(s => visit(s.topic))
  }
  visit(root)
  sheet.floatingTopics?.forEach(visit)
  return {
    boxes, edges: all.edges, decos: all.decos, toggles: all.toggles, boundaries,
    bounds: { minX: all.minX, minY: all.minY, maxX: all.maxX, maxY: all.maxY },
    childAxis: eng.childAxis,
  }
}
