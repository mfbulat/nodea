import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CommentLayer, nearestTopic } from './Comments'
import type { Sheet, Topic } from './model'
import { indexSheet, isAncestor, levelOf } from './model'
import type { Box, LayoutResult, Pt } from './layout'
import { layoutSheet } from './layout'
import { branchColor, FullStyle, isColored, resolveStyle, sheetBackground, WEIGHTS } from './themes'
import { Content, IconKind, layoutContent, onFontsChanged } from './measure'
import { edgePath } from './paths'
import { currentLayout, setCurrentLayout, topLevel, useEditor } from './store'
import { boxCenter, relGeometry } from './relations'
import { dashOf, TopicNode } from './TopicView'
import { followLink, pickFile, uploadToTopic } from './actions'
import Icon, { IconName } from '../ui/Icon'
import { collab, useCollab } from '../collab/session'

export interface Rendered {
  layout: LayoutResult
  styles: Map<string, FullStyle>
  contents: Map<string, Content>
}

export function renderSheet(sheet: Sheet): Rendered {
  const idx = indexSheet(sheet)
  const styles = new Map<string, FullStyle>()
  const contents = new Map<string, Content>()
  const sizes = new Map<string, { w: number; h: number; shapeH: number; underline: boolean }>()
  for (const [id, ref] of idx) {
    const st = resolveStyle(sheet, ref)
    // автоцвет плавающих тем: цвет из палитры по порядку
    // центральная тема без заливки закрашивается фоном, чтобы начало веток было скрыто (как в XMind)
    if (ref.kind === 'root' && st.fill === 'transparent') st.fill = sheetBackground(sheet)
    if (sheet.autoColorFloating && ref.kind === 'floating' && !ref.topic.style?.fill) { st.fill = branchColor(sheet, ref.index + 2); st.textColor = '#000000' }
    styles.set(id, st)
  }
  // одинаковая длина тем: ширина по самой широкой теме того же уровня
  if (sheet.uniformWidth) {
    const maxW = new Map<string, number>()
    for (const [id, ref] of idx) {
      const lv = levelOf(ref)
      const w = layoutContent(ref.topic, styles.get(id)!, false, { taskInTopic: sheet.taskInTopic, skipWeekends: sheet.taskSkipWeekends }).shapeW
      maxW.set(lv, Math.max(maxW.get(lv) ?? 0, w))
    }
    for (const [id, ref] of idx) { const st = styles.get(id)!; if (!st.width) st.width = maxW.get(levelOf(ref)) }
  }
  for (const [id, ref] of idx) {
    const st = styles.get(id)!
    const c = layoutContent(ref.topic, st, !!sheet.showNotes, { taskInTopic: sheet.taskInTopic, skipWeekends: sheet.taskSkipWeekends })
    contents.set(id, c)
    sizes.set(id, { w: c.w, h: c.h, shapeH: c.shapeH, underline: st.shape === 'underline' })
  }
  const layout = layoutSheet(sheet, (t: Topic) => sizes.get(t.id)!)
  return { layout, styles, contents }
}

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'marquee'; a: Pt; b: Pt; additive: boolean; base: string[] }
  | { kind: 'topic'; ids: string[]; start: Pt; cur: Pt; active: boolean; grab: Pt;
      target: { id: string; mode: 'child' | 'before' | 'after' } | null }
  | { kind: 'cp'; relId: string; which: 1 | 2; cur: Pt }

type LabelEdit = { kind: 'relationship' | 'boundary'; id: string; x: number; y: number; value: string }

/** Лист для показа: при «только ветке» центральной становится выбранная тема */
export function displaySheet(sheet: Sheet, drillId: string | null): Sheet {
  if (!drillId) return sheet
  const ref = indexSheet(sheet).get(drillId)
  if (!ref) return sheet
  const ids = new Set(indexSheet({ ...sheet, rootTopic: ref.topic, floatingTopics: [] }).keys())
  return { ...sheet, rootTopic: { ...ref.topic, collapsed: false }, floatingTopics: [],
    relationships: sheet.relationships?.filter(r => ids.has(r.end1) && ids.has(r.end2)) }
}

/** Темы, не прошедшие фильтр по маркерам/меткам (затемняются) */
function filteredOut(sheet: Sheet, filter: { markers: string[]; labels: string[] } | null): Set<string> {
  const out = new Set<string>()
  if (!filter) return out
  for (const [id, ref] of indexSheet(sheet)) {
    const t = ref.topic
    const ok = filter.markers.some(m => t.markers?.includes(m)) || filter.labels.some(l => t.labels?.includes(l))
    if (!ok) out.add(id)
  }
  return out
}

export default function MapCanvas({ sheet: realSheet, readOnly = false, focusIds }: {
  sheet: Sheet; readOnly?: boolean
  /** режим презентации: видимы только эти темы, остальные приглушены */
  focusIds?: Set<string> | null
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const { view, selection, editingId, element, relating, drillId, filter, search, commenting } = useEditor()
  const sheet = useMemo(() => displaySheet(realSheet, drillId), [realSheet, drillId])
  const ed = useEditor.getState
  const [fontEpoch, setFontEpoch] = useState(0)
  useEffect(() => onFontsChanged(() => setFontEpoch(e => e + 1)), [])
  const r = useMemo(() => renderSheet(sheet), [sheet, fontEpoch])
  setCurrentLayout(r.layout)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pointer, setPointer] = useState<Pt | null>(null)
  const [labelEdit, setLabelEdit] = useState<LabelEdit | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const spaceDown = useRef(false)
  const updateDrag = (d: Drag | null) => { dragRef.current = d; setDrag(d) }

  // начальное положение: центральная тема по центру, крупные карты — вписать
  useLayoutEffect(() => {
    fitToScreen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id, drillId])

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === ' ') && !isTyping(e)) spaceDown.current = true
      if (e.key === 'Escape' && ed().relating) ed().finishRelating(null)
      if (e.key === 'Escape' && ed().painting) useEditor.setState({ painting: false })
    }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === ' ') spaceDown.current = false }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [])

  // масштаб колесом с Ctrl/⌘ (и жест «щипок»), иначе прокрутка
  useEffect(() => {
    const el = wrap.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = ed().view
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        zoomAt(v.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else ed().setView({ x: v.x - e.deltaX, y: v.y - e.deltaY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const toWorld = (cx: number, cy: number): Pt => {
    const rect = wrap.current!.getBoundingClientRect()
    const v = ed().view
    return { x: (cx - rect.left - v.x) / v.zoom, y: (cy - rect.top - v.y) / v.zoom }
  }

  // режим комментирования: щелчок в любом месте — новое обсуждение у ближайшей темы
  function onCommentPointerDown(e: React.PointerEvent) {
    if (!ed().commenting || e.button !== 0 || (e.target as Element).closest('.cm-pop, .cm-pin')) return
    e.stopPropagation(); e.preventDefault()
    const p = toWorld(e.clientX, e.clientY)
    const b = nearestTopic(r.layout.boxes, p)
    if (!b) return
    const has = idx.get(b.id)?.topic.comments?.length
    ed().setThread(has ? { id: b.id } : { id: b.id, pos: { x: p.x - b.x, y: p.y - b.y } })
  }

  function onBgPointerDown(e: React.PointerEvent) {
    if (ed().thread) ed().setThread(null)
    if ((e.target as Element).closest('.topic, .toggle, .title-editor, .rel, .boundary, .cp-handle, .label-editor')) return
    wrap.current!.focus()
    if (ed().editingId) ed().stopEdit()
    if (ed().relating) { ed().finishRelating(null); return }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    if (e.button === 1 || e.button === 2 || spaceDown.current || readOnly) {
      updateDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx: ed().view.x, vy: ed().view.y })
    } else {
      const p = toWorld(e.clientX, e.clientY)
      const additive = e.shiftKey || e.metaKey || e.ctrlKey
      if (!additive) ed().select([])
      updateDrag({ kind: 'marquee', a: p, b: p, additive, base: additive ? ed().selection : [] })
    }
  }

  function onTopicPointerDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    wrap.current!.focus()
    if (ed().relating) { ed().finishRelating(id); return }
    if (ed().painting) { ed().select([id]); ed().pasteStyle(); useEditor.setState({ painting: false }); return }
    if (ed().editingId && ed().editingId !== id) ed().stopEdit()
    if (ed().editingId === id) return
    const sel = ed().selection
    if (e.metaKey || e.ctrlKey) { ed().toggleSelect(id); return }
    if (e.shiftKey) { if (!sel.includes(id)) ed().select([...sel, id]); return }
    if (!sel.includes(id)) ed().select([id])
    if (readOnly) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const p = toWorld(e.clientX, e.clientY)
    const box = r.layout.boxes.get(id)!
    const ids = ed().selection.includes(id) ? ed().selection : [id]
    updateDrag({ kind: 'topic', ids, start: p, cur: p, active: false, grab: { x: p.x - box.x, y: p.y - box.y }, target: null })
  }

  const lastCursor = useRef(0)
  function onPointerMove(e: React.PointerEvent) {
    if (ed().relating) setPointer(toWorld(e.clientX, e.clientY))
    const now = performance.now()
    if (collab() && now - lastCursor.current > 50) { lastCursor.current = now; collab()!.setPresence({ cursor: toWorld(e.clientX, e.clientY) }) }
    const d = dragRef.current
    if (!d) return
    if (d.kind === 'pan') {
      ed().setView({ x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy })
    } else if (d.kind === 'marquee') {
      const b = toWorld(e.clientX, e.clientY)
      const x1 = Math.min(d.a.x, b.x), x2 = Math.max(d.a.x, b.x), y1 = Math.min(d.a.y, b.y), y2 = Math.max(d.a.y, b.y)
      const hit = [...r.layout.boxes.values()].filter(bx => bx.x < x2 && bx.x + bx.w > x1 && bx.y < y2 && bx.y + bx.h > y1).map(bx => bx.id)
      ed().select([...new Set([...d.base, ...hit])])
      updateDrag({ ...d, b })
    } else if (d.kind === 'cp') {
      updateDrag({ ...d, cur: toWorld(e.clientX, e.clientY) })
    } else {
      const cur = toWorld(e.clientX, e.clientY)
      const active = d.active || Math.hypot(cur.x - d.start.x, cur.y - d.start.y) * ed().view.zoom > 4
      updateDrag({ ...d, cur, active, target: active ? findDropTarget(cur, d.ids) : null })
    }
  }

  function onPointerUp() {
    const d = dragRef.current
    updateDrag(null)
    if (!d) return
    if (d.kind === 'cp') {
      const rel = sheet.relationships?.find(x => x.id === d.relId)
      const b = rel && r.layout.boxes.get(d.which === 1 ? rel.end1 : rel.end2)
      if (rel && b) {
        const c = boxCenter(b)
        ed().updateRelationship(rel.id, { [d.which === 1 ? 'cp1' : 'cp2']: { x: d.cur.x - c.x, y: d.cur.y - c.y } })
        // вторая точка фиксируется текущим значением, чтобы кривая не «прыгала»
        const g = relGeometry(rel, r.layout.boxes)
        const other = d.which === 1 ? 'cp2' : 'cp1'
        if (g && !rel[other]) {
          const ob = r.layout.boxes.get(d.which === 1 ? rel.end2 : rel.end1)!
          const oc = boxCenter(ob), cp = d.which === 1 ? g.c2 : g.c1
          ed().updateRelationship(rel.id, { [other]: { x: cp.x - oc.x, y: cp.y - oc.y } })
        }
      }
      return
    }
    if (d.kind !== 'topic') return
    if (!d.active) {
      // простой щелчок по теме из мультивыделения — выделить только её
      const id = d.ids.find(i => { const b = r.layout.boxes.get(i); return b && d.start.x >= b.x && d.start.x <= b.x + b.w && d.start.y >= b.y && d.start.y <= b.y + b.h })
      if (id && d.ids.length > 1) ed().select([id])
      return
    }
    const idx = indexSheet(sheet)
    const ids = d.ids.filter(id => id !== sheet.rootTopic.id)
    if (!ids.length) return
    const pos = { x: d.cur.x - d.grab.x, y: d.cur.y - d.grab.y }
    // выноска перемещается относительно своей темы
    const one = idx.get(ids[0])
    if (ids.length === 1 && one?.kind === 'callout') {
      const ob = r.layout.boxes.get(one.parent!.id)!
      ed().setPosition(ids[0], { x: pos.x - (ob.x + ob.w), y: pos.y - ob.y })
      return
    }
    if (d.target) { ed().move(ids, d.target.id, d.target.mode); return }
    // свободное положение веток: перенос на пустое место сдвигает ветку
    if (sheet.freeBranch && ids.length === 1 && one?.kind === 'child') {
      const prev = one.topic.offset ?? { x: 0, y: 0 }
      ed().setTopic([ids[0]], { offset: { x: prev.x + d.cur.x - d.start.x, y: prev.y + d.cur.y - d.start.y } })
      return
    }
    // отпущено на пустом месте: плавающая тема двигается, обычная — становится плавающей
    if (ids.length === 1 && one?.kind === 'floating') ed().setPosition(ids[0], pos)
    else ed().detach(ids, pos)
  }

  function findDropTarget(p: Pt, ids: string[]): { id: string; mode: 'child' | 'before' | 'after' } | null {
    const idx = indexSheet(sheet)
    const excluded = (id: string) => ids.some(m => m === id || isAncestor(idx, m, id)) || idx.get(id)?.kind === 'callout'
    let best: { box: Box; dist: number } | null = null
    for (const box of r.layout.boxes.values()) {
      if (excluded(box.id)) continue
      const dx = Math.max(box.x - p.x, 0, p.x - box.x - box.w)
      const dy = Math.max(box.y - p.y, 0, p.y - box.y - box.h)
      const dist = Math.hypot(dx, dy)
      if (dist < 40 && (!best || dist < best.dist)) best = { box, dist }
    }
    if (!best) return null
    const { box } = best
    const ref = idx.get(box.id)!
    if (!ref.parent || best.dist > 0 || ref.kind !== 'child') return { id: box.id, mode: 'child' }
    const axis = r.layout.childAxis.get(ref.parent.id) ?? 'y'
    const rel = axis === 'y' ? (p.y - box.y) / box.h : (p.x - box.x) / box.w
    return { id: box.id, mode: rel < 0.25 ? 'before' : rel > 0.75 ? 'after' : 'child' }
  }

  function zoomAt(z: number, sx: number, sy: number) {
    const v = ed().view
    const zoom = Math.min(4, Math.max(0.1, z))
    ed().setView({ zoom, x: sx - (sx - v.x) * (zoom / v.zoom), y: sy - (sy - v.y) * (zoom / v.zoom) })
  }

  function fitToScreen(initial = false) {
    const el = wrap.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const b = (currentLayout() ?? r.layout).bounds
    const bw = b.maxX - b.minX + 80, bh = b.maxY - b.minY + 80
    let zoom = Math.min(width / bw, height / bh, 1.5)
    if (initial) zoom = Math.min(1, zoom)
    zoom = Math.max(0.1, zoom)
    ed().setView({ zoom, x: width / 2 - ((b.minX + b.maxX) / 2) * zoom, y: height / 2 - ((b.minY + b.maxY) / 2) * zoom })
  }

  // доступ к функциям холста из панели инструментов и клавиш
  useEffect(() => {
    canvasApi.fit = () => fitToScreen()
    canvasApi.zoomBy = (k: number) => {
      const rect = wrap.current!.getBoundingClientRect()
      zoomAt(ed().view.zoom * k, rect.width / 2, rect.height / 2)
    }
    canvasApi.zoomTo = (z: number) => {
      const rect = wrap.current!.getBoundingClientRect()
      zoomAt(z, rect.width / 2, rect.height / 2)
    }
    canvasApi.focus = () => wrap.current?.focus()
    canvasApi.ensureVisible = (id: string) => {
      const b = currentLayout()?.boxes.get(id)
      const el = wrap.current
      if (!b || !el) return
      const { width, height } = el.getBoundingClientRect()
      const v = ed().view
      const sx = b.x * v.zoom + v.x, sy = b.y * v.zoom + v.y
      let { x, y } = v
      if (sx < 20) x += 20 - sx
      if (sx + b.w * v.zoom > width - 20) x -= sx + b.w * v.zoom - width + 20
      if (sy < 20) y += 20 - sy
      if (sy + b.h * v.zoom > height - 20) y -= sy + b.h * v.zoom - height + 20
      if (x !== v.x || y !== v.y) ed().setView({ x, y })
    }
    canvasApi.animateTo = (ids: string[] | null, ms = 600) => {
      const el = wrap.current
      const layout = currentLayout()
      if (!el || !layout) return
      const { width, height } = el.getBoundingClientRect()
      let b = layout.bounds
      if (ids?.length) {
        const bs = ids.map(i => layout.boxes.get(i)).filter((x): x is Box => !!x)
        if (bs.length) b = { minX: Math.min(...bs.map(x => x.x)), minY: Math.min(...bs.map(x => x.y)),
          maxX: Math.max(...bs.map(x => x.x + x.w)), maxY: Math.max(...bs.map(x => x.y + x.h)) }
      }
      const zoom = Math.max(0.1, Math.min(width / (b.maxX - b.minX + 120), height / (b.maxY - b.minY + 120), 2))
      const target = { zoom, x: width / 2 - ((b.minX + b.maxX) / 2) * zoom, y: height / 2 - ((b.minY + b.maxY) / 2) * zoom }
      const from = { ...ed().view }
      const t0 = performance.now()
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
      const token = ++animToken
      const step = (now: number) => {
        if (token !== animToken) return
        const k = Math.min(1, (now - t0) / ms), e = ease(k)
        ed().setView({ zoom: from.zoom + (target.zoom - from.zoom) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e })
        if (k < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      // если вкладка не отрисовывается (rAF приостановлен), всё равно приходим к цели
      setTimeout(() => { if (token === animToken) ed().setView(target) }, ms + 80)
    }
    canvasApi.center = (id: string) => {
      const b = currentLayout()?.boxes.get(id)
      const el = wrap.current
      if (!b || !el) return
      const { width, height } = el.getBoundingClientRect()
      const z = ed().view.zoom
      ed().setView({ x: width / 2 - (b.x + b.w / 2) * z, y: height / 2 - (b.y + b.h / 2) * z })
    }
  })

  function onIcon(id: string, kind: IconKind) {
    const t = indexSheet(sheet).get(id)?.topic
    if (!t) return
    ed().select([id])
    if (kind === 'task') ed().toggleTask(id)
    else if (kind === 'link') followLink(t.href!)
    else if (kind === 'note') ed().setPanel('notes')
    else if (kind === 'comments') ed().setPanel('comments')
    else if (kind === 'attachment' && t.attachment) window.open(t.attachment.url, '_blank')
    else if (kind === 'audio' && t.audio) new Audio(t.audio.url).play().catch(() => window.open(t.audio!.url, '_blank'))
  }

  // файлы, перетащенные на тему: изображения — в картинку, остальное — во вложение
  function onDrop(e: React.DragEvent) {
    if (readOnly || !e.dataTransfer.files.length) return
    e.preventDefault()
    const g = (e.target as Element).closest('.topic') as SVGGElement | null
    const id = g?.dataset.id ?? ed().selection[ed().selection.length - 1]
    if (id) uploadToTopic(id, e.dataTransfer.files[0])
  }

  const idx = useMemo(() => indexSheet(sheet), [sheet])
  const selSet = new Set(readOnly ? [] : selection)
  const filterDim = useMemo(() => filteredOut(sheet, filter), [sheet, filter])
  const hits = new Set(search.open ? search.hits : [])
  const isDim = (id: string) => filterDim.has(id) || (!!focusIds && !focusIds.has(id))
  const dragIds = drag?.kind === 'topic' && drag.active ? topLevel(sheet, drag.ids) : []
  const ghostIds = new Set<string>()
  if (dragIds.length) for (const [id] of idx) if (dragIds.some(m => m === id || isAncestor(idx, m, id))) ghostIds.add(id)

  const peers = useCollab(s => s.peers).filter(p => p.sheetId === realSheet.id)
  const bg = sheetBackground(sheet)
  const rootStyle = r.styles.get(sheet.rootTopic.id)!
  const relColor = rootStyle.lineColor

  const relGeoms = (sheet.relationships ?? []).map(rel => {
    let g = relGeometry(rel, r.layout.boxes)
    if (g && drag?.kind === 'cp' && drag.relId === rel.id) {
      // во время перетаскивания одна точка следует за курсором, вторая остаётся на месте
      const rel1 = (end: string, p: Pt) => { const c = boxCenter(r.layout.boxes.get(end)!); return { x: p.x - c.x, y: p.y - c.y } }
      g = relGeometry({ ...rel,
        cp1: drag.which === 1 ? rel1(rel.end1, drag.cur) : rel1(rel.end1, g.c1),
        cp2: drag.which === 2 ? rel1(rel.end2, drag.cur) : rel1(rel.end2, g.c2) }, r.layout.boxes)
    }
    return { rel, g }
  })

  return (
    <div ref={wrap} className={'map-canvas' + (relating ? ' relating' : '') + (commenting ? ' commenting' : '')} tabIndex={0} data-testid="map-canvas"
      style={{ background: bg, cursor: drag?.kind === 'pan' ? 'grabbing' : relating ? 'crosshair' : 'default' }}
      onPointerDownCapture={onCommentPointerDown} onPointerDown={onBgPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onContextMenu={e => e.preventDefault()}
      onDragOver={e => { if (!readOnly) e.preventDefault() }} onDrop={onDrop}
      onDoubleClick={e => {
        if (readOnly || (e.target as Element).closest('.topic, .rel, .boundary')) return
        const p = toWorld(e.clientX, e.clientY)
        ed().addFloating(p.x, p.y - 15)
      }}>
      <svg className="bg" width="100%" height="100%" style={{ display: 'block' }}>
        <g transform={`translate(${view.x},${view.y}) scale(${view.zoom})`}>
          {r.layout.boundaries.map(b => {
            const color = b.color ?? relColor
            const sel = element?.kind === 'boundary' && element.id === b.id
            return (
              <g key={b.id} className="boundary" onPointerDown={e => { e.stopPropagation(); ed().selectElement({ kind: 'boundary', id: b.id }) }}
                onDoubleClick={e => { e.stopPropagation(); setLabelEdit({ kind: 'boundary', id: b.id, x: b.x + 8, y: b.y, value: b.title ?? '' }) }}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} fill={b.fill ?? color} fillOpacity={b.fill ? 0.25 : 0.06}
                  stroke={color} strokeWidth={sel ? 2.5 : 1.5} strokeDasharray={dashOf(b.lineStyle ?? 'dashed', 1.5)} />
                {b.title && <>
                  <rect x={b.x} y={b.y} width={Math.min(b.w, b.title.length * 7.5 + 16)} height={20} rx={8} fill={color} />
                  <text x={b.x + 8} y={b.y + 14} fontSize={12} fill="#fff" fontFamily="var(--font-map)">{b.title}</text>
                </>}
                {sel && <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} rx={14} fill="none" stroke="var(--color-selection)" strokeWidth={1.5} />}
              </g>
            )
          })}
          {r.layout.decos.map((d, i) => d.kind === 'callout' ? (
            <CalloutTail key={'d' + i} from={d.pts[0]} to={d.pts[1]} style={r.styles.get(d.owner)!} />
          ) : (
            <polyline key={'d' + i} points={d.pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
              stroke={d.kind === 'grid' ? rootStyle.borderColor : rootStyle.lineColor}
              strokeWidth={d.kind === 'grid' ? 1 : Math.max(3, rootStyle.lineWidth + 1)} />
          ))}
          {r.layout.edges.map(e => {
            const from = r.styles.get(e.from)!, to = r.styles.get(e.to)
            const color = isColored(sheet) && to ? to.lineColor : from.lineColor
            const shape = e.kind === 'line' ? 'straight' : from.lineShape
            const { d, filled } = edgePath(e, shape === 'none' && (e.kind === 'brace' || e.kind === 'vbrace') ? 'curve' : shape, from.lineWidth)
            if (!d) return null
            const end = e.pts[e.pts.length - 1]
            return <g key={e.from + '-' + e.to + e.kind} opacity={ghostIds.has(e.to) || isDim(e.to) ? 0.2 : 1} style={{ transition: 'opacity .4s' }}>
              <path d={d} fill={filled ? color : 'none'}
                stroke={filled ? 'none' : color} strokeWidth={e.kind === 'brace' || e.kind === 'vbrace' ? Math.min(2, from.lineWidth) : from.lineWidth}
                strokeLinecap="round" strokeDasharray={filled ? undefined : dashOf(from.lineStyle, from.lineWidth)} />
              {from.lineEnd === 'arrow' && (e.kind === 'h' || e.kind === 'v' || e.kind === 'tree') && <ArrowHead at={end} from={e.kind === 'v' ? { x: end.x, y: end.y - Math.sign(end.y - e.pts[0].y) * 10 } : { x: end.x - Math.sign(end.x - e.pts[0].x) * 10, y: end.y }} color={color} w={from.lineWidth} />}
            </g>
          })}
          {[...r.layout.boxes.values()].map(b => {
            const ref = idx.get(b.id)
            if (!ref) return null
            return <TopicNode key={b.id} box={b} topic={ref.topic} style={r.styles.get(b.id)!} content={r.contents.get(b.id)!}
              selected={selSet.has(b.id)} dim={ghostIds.has(b.id) || isDim(b.id)} hidden={editingId === b.id}
              highlight={hits.has(b.id)} current={search.open && search.hits[search.index] === b.id}
              central={levelOf(ref) === 'central'} relTarget={!!relating && hoverId === b.id && relating !== b.id}
              onPointerDown={e => onTopicPointerDown(e, b.id)}
              onDoubleClick={e => { e.stopPropagation(); if (!readOnly) ed().startEdit(b.id) }}
              onIcon={kind => onIcon(b.id, kind)}
              onMarker={() => { ed().select([b.id]); ed().setPanel('markers') }} />
          })}
          {relGeoms.map(({ rel, g }) => {
            if (!g) return null
            const color = rel.color ?? (sheet.relColorFollowTopic ? r.styles.get(rel.end1)?.lineColor ?? relColor : relColor)
            const w = rel.width ?? 2
            const sel = element?.kind === 'relationship' && element.id === rel.id
            return (
              <g key={rel.id} className="rel" onPointerDown={e => { e.stopPropagation(); ed().selectElement({ kind: 'relationship', id: rel.id }) }}
                onDoubleClick={e => { e.stopPropagation(); setLabelEdit({ kind: 'relationship', id: rel.id, x: g.mid.x, y: g.mid.y, value: rel.title ?? '' }) }}>
                <path d={g.d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }} />
                <path d={g.d} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dashOf(rel.lineStyle ?? 'dashed', w)} />
                {rel.arrowEnd !== false && <path d={g.arrowEnd} fill={color} />}
                {rel.arrowStart && <path d={g.arrowStart} fill={color} />}
                {rel.title && <RelLabel x={g.mid.x} y={g.mid.y} text={rel.title} color={color} bg={bg} />}
                {sel && <>
                  <line x1={g.p1.x} y1={g.p1.y} x2={g.c1.x} y2={g.c1.y} stroke="var(--color-selection)" strokeDasharray="3 3" />
                  <line x1={g.p2.x} y1={g.p2.y} x2={g.c2.x} y2={g.c2.y} stroke="var(--color-selection)" strokeDasharray="3 3" />
                  {([1, 2] as const).map(which => (
                    <circle key={which} className="cp-handle" cx={which === 1 ? g.c1.x : g.c2.x} cy={which === 1 ? g.c1.y : g.c2.y} r={6 / view.zoom}
                      fill="#fff" stroke="var(--color-selection)" strokeWidth={2 / view.zoom} style={{ cursor: 'move' }}
                      onPointerDown={e => {
                        e.stopPropagation()
                        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
                        updateDrag({ kind: 'cp', relId: rel.id, which, cur: toWorld(e.clientX, e.clientY) })
                      }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
                  ))}
                </>}
              </g>
            )
          })}
          {r.layout.toggles.filter(t => !readOnly || t.collapsed).map(t => (
            <g key={'t' + t.id} className={'toggle' + (t.collapsed ? ' collapsed' : '')}
              transform={`translate(${t.x},${t.y})`}
              onPointerDown={e => { if (readOnly) return; e.stopPropagation(); ed().select([t.id]); ed().toggleCollapse() }}>
              <circle r={t.collapsed ? 9 : 6} fill={bg} stroke={r.styles.get(t.id)!.lineColor} strokeWidth={1.5} />
              {t.collapsed
                ? <text textAnchor="middle" dy="3.5" fontSize={9} fill={r.styles.get(t.id)!.lineColor}>{t.count > 99 ? '99+' : t.count}</text>
                : <path d="M-3,0H3" stroke={r.styles.get(t.id)!.lineColor} strokeWidth={1.5} />}
            </g>
          ))}
          {!readOnly && !drag && !editingId && selection.length === 1 && (() => {
            const id = selection[0], b = r.layout.boxes.get(id), c = r.contents.get(id), ref = idx.get(id)
            if (!b || !c || !ref) return null
            const sw = b.cell ? b.w : c.shapeW, sh = b.cell ? b.h : c.shapeH
            const parentBox = ref.parent ? r.layout.boxes.get(ref.parent.id) : undefined
            const left = !!parentBox && b.x + sw / 2 < parentBox.x + parentBox.w / 2
            const up = left && ref.kind === 'child' && ref.parent?.id === sheet.rootTopic.id
            const k = 1 / view.zoom
            const plus = (x: number, y: number, label: string, fn: () => void) => (
              <g className="add-btn" transform={`translate(${x},${y}) scale(${k})`} onPointerDown={e => { e.stopPropagation(); fn() }}>
                <title>{label}</title>
                <circle r={9} fill="var(--color-selection)" />
                <path d="M-4.5,0H4.5M0,-4.5V4.5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
              </g>)
            return <>
              {plus(left ? b.x - 16 * k : b.x + sw + 16 * k, b.y + sh / 2, 'Подтема', () => ed().addChild())}
              {ref.kind !== 'root' && ref.kind !== 'callout' && plus(b.x + sw / 2, up ? b.y - 16 * k : b.y + sh + 16 * k, 'Тема', () => ed().addSibling(false))}
            </>
          })()}
          {relating && pointer && r.layout.boxes.get(relating) && (
            <line x1={boxCenter(r.layout.boxes.get(relating)!).x} y1={boxCenter(r.layout.boxes.get(relating)!).y}
              x2={pointer.x} y2={pointer.y} stroke={relColor} strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
          )}
          {drag?.kind === 'topic' && drag.active && (
            <>
              {dragIds.map(id => {
                const b = r.layout.boxes.get(id)
                if (!b) return null
                const dx = drag.cur.x - drag.start.x, dy = drag.cur.y - drag.start.y
                return <rect key={'g' + id} x={b.x + dx} y={b.y + dy} width={b.w} height={b.h} rx={6}
                  fill="var(--color-selection)" opacity={0.25} stroke="var(--color-selection)" strokeDasharray="4 3" />
              })}
              {drag.target && <DropIndicator box={r.layout.boxes.get(drag.target.id)!} mode={drag.target.mode}
                axis={(() => { const p = idx.get(drag.target!.id)?.parent; return p ? r.layout.childAxis.get(p.id) ?? 'y' : 'y' })()} />}
            </>
          )}
          {peers.flatMap(p => (p.selection ?? []).map(id => {
            const b = r.layout.boxes.get(id)
            return b ? <rect key={'ps' + p.clientId + id} className="peer-sel" x={b.x - 5} y={b.y - 5} width={b.w + 10} height={b.h + 10} rx={9}
              fill="none" stroke={p.color} strokeWidth={2} strokeDasharray="6 3" pointerEvents="none" /> : null
          }))}
          {drag?.kind === 'marquee' && (
            <rect x={Math.min(drag.a.x, drag.b.x)} y={Math.min(drag.a.y, drag.b.y)}
              width={Math.abs(drag.a.x - drag.b.x)} height={Math.abs(drag.a.y - drag.b.y)}
              fill="var(--color-selection)" fillOpacity={0.08} stroke="var(--color-selection)" strokeWidth={1 / view.zoom} />
          )}
        </g>
      </svg>
      {!focusIds && <CommentLayer sheet={sheet} boxes={r.layout.boxes} view={view} readOnly={readOnly} />}
      {commenting && <div className="relating-hint">Щёлкните в любом месте карты, чтобы добавить комментарий. Esc — отмена.</div>}
      {peers.filter(p => p.cursor).map(p => (
        <div key={'pc' + p.clientId} className="peer-cursor" data-testid="peer-cursor"
          style={{ left: p.cursor!.x * view.zoom + view.x, top: p.cursor!.y * view.zoom + view.y, color: p.color }}>
          <svg width={16} height={16} viewBox="0 0 16 16"><path d="M1,1L14,7L8,8.5L6,14Z" fill={p.color} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ background: p.color }}>{p.name}</span>
        </div>
      ))}
      {SHOW_MINI_TOOLBAR && !readOnly && !drag && !editingId && selection.length === 1 && r.layout.boxes.get(selection[0]) && (
        <MiniToolbar id={selection[0]} x={r.layout.boxes.get(selection[0])!.x * view.zoom + view.x}
          y={r.layout.boxes.get(selection[0])!.y * view.zoom + view.y} />
      )}
      {useEditor.getState().painting && <div className="relating-hint">Щёлкните тему, к которой применить стиль. Esc — отмена.</div>}
      {relating && <div className="relating-hint">Щёлкните тему, с которой нужно связать. Esc — отмена.</div>}
      {editingId && r.layout.boxes.get(editingId) && (
        <TitleEditor key={editingId} id={editingId} box={r.layout.boxes.get(editingId)!}
          style={r.styles.get(editingId)!} content={r.contents.get(editingId)!}
          title={idx.get(editingId)?.topic.title ?? ''} />
      )}
      {labelEdit && (
        <input className="label-editor" autoFocus defaultValue={labelEdit.value}
          style={{ left: labelEdit.x * view.zoom + view.x - (labelEdit.kind === 'relationship' ? 80 : 0), top: labelEdit.y * view.zoom + view.y - 14 }}
          placeholder={labelEdit.kind === 'relationship' ? 'Подпись связи' : 'Заголовок границы'}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setLabelEdit(null)
          }}
          onBlur={e => {
            const v = e.target.value
            if (labelEdit.kind === 'relationship') ed().updateRelationship(labelEdit.id, { title: v })
            else ed().updateBoundary(labelEdit.id, { title: v })
            setLabelEdit(null)
          }} />
      )}
      {/* наведение для подсветки цели связи */}
      {relating && <HoverTracker onHover={setHoverId} />}
    </div>
  )
}

function HoverTracker({ onHover }: { onHover: (id: string | null) => void }) {
  useEffect(() => {
    const mv = (e: PointerEvent) => {
      const g = (e.target as Element | null)?.closest?.('.topic') as SVGGElement | null
      onHover(g?.dataset.id ?? null)
    }
    window.addEventListener('pointermove', mv)
    return () => { window.removeEventListener('pointermove', mv); onHover(null) }
  }, [onHover])
  return null
}

/** В веб-версии мини-панели нет (она есть только в десктопной) */
const SHOW_MINI_TOOLBAR = false

/** Мини-панель над выделенной темой: связь, ссылка, изображение, заметка, задача, кисть формата */
function MiniToolbar({ id, x, y }: { id: string; x: number; y: number }) {
  const ed = useEditor.getState
  const sheet = ed().sheet()
  const t = sheet ? indexSheet(sheet).get(id)?.topic : undefined
  if (!t) return null
  const btn = (icon: IconName, label: string, fn: () => void, on = false) => (
    <button className={'ibtn' + (on ? ' on' : '')} aria-label={label} title={label}
      onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); fn() }}><Icon name={icon} size={18} /></button>)
  return (
    <div className="island mini-toolbar" style={{ left: Math.max(8, x), top: Math.max(8, y - 50) }} onPointerDown={e => e.stopPropagation()}>
      {btn('relationship', 'Связь', () => ed().startRelating())}
      {btn('link', 'Ссылка', () => ed().setDialog({ kind: 'link', id }), !!t.href)}
      {btn('image', 'Изображение', async () => { const f = await pickFile('image/*'); if (f) uploadToTopic(id, f, 'image') }, !!t.image)}
      {btn('note', 'Заметка', () => ed().setPanel('notes'), !!t.notes)}
      {btn('task', 'To-Do', () => ed().setTopic([id], { task: t.task ? undefined : { done: false } }), !!t.task)}
      {btn('brush', 'Копировать формат (кисть)', () => {
        const ref = indexSheet(ed().sheet()!).get(id)
        if (ref) { ed().copyStyle(resolveStyle(ed().sheet()!, ref)); useEditor.setState({ painting: true }) }
      }, useEditor.getState().painting)}
    </div>
  )
}

export function ArrowHead({ at, from, color, w }: { at: Pt; from: Pt; color: string; w: number }) {
  const a = Math.atan2(at.y - from.y, at.x - from.x), sz = 6 + w * 1.5
  const p = (d: number) => `${at.x - sz * Math.cos(a + d)},${at.y - sz * Math.sin(a + d)}`
  return <path d={`M${at.x},${at.y}L${p(0.45)}L${p(-0.45)}Z`} fill={color} />
}

export function RelLabel({ x, y, text, color, bg }: { x: number; y: number; text: string; color: string; bg: string }) {
  const w = text.length * 7 + 14
  return <g>
    <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={6} fill={bg} stroke={color} strokeWidth={1} />
    <text x={x} y={y + 4.5} textAnchor="middle" fontSize={12} fill={color} fontFamily="var(--font-map)">{text}</text>
  </g>
}

export function CalloutTail({ from, to, style }: { from: Pt; to: Pt; style: FullStyle }) {
  const dx = to.x - from.x, dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len * 7, ny = dx / len * 7
  return <path d={`M${from.x},${from.y}L${to.x + nx},${to.y + ny}L${to.x - nx},${to.y - ny}Z`}
    fill={style.fill === 'transparent' ? '#fff8db' : style.fill} stroke={style.borderColor} strokeWidth={1} />
}

let animToken = 0

export const canvasApi = {
  fit: () => {}, zoomBy: (_k: number) => {}, zoomTo: (_z: number) => {}, focus: () => {},
  ensureVisible: (_id: string) => {}, center: (_id: string) => {},
  animateTo: (_ids: string[] | null, _ms?: number) => {},
}

export function isTyping(e: Event) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

function DropIndicator({ box, mode, axis }: { box: Box; mode: 'child' | 'before' | 'after'; axis: 'x' | 'y' }) {
  if (mode === 'child') return <rect x={box.x - 4} y={box.y - 4} width={box.w + 8} height={box.h + 8} rx={8}
    fill="none" stroke="var(--color-selection)" strokeWidth={2} strokeDasharray="5 3" />
  const before = mode === 'before'
  if (axis === 'y') {
    const y = before ? box.y - 5 : box.y + box.h + 5
    return <line x1={box.x} x2={box.x + box.w} y1={y} y2={y} stroke="var(--color-selection)" strokeWidth={3} strokeLinecap="round" />
  }
  const x = before ? box.x - 5 : box.x + box.w + 5
  return <line x1={x} x2={x} y1={box.y} y2={box.y + box.h} stroke="var(--color-selection)" strokeWidth={3} strokeLinecap="round" />
}

function TitleEditor({ id, box, style: s, content: c, title }: { id: string; box: Box; style: FullStyle; content: Content; title: string }) {
  const { view, editSeed } = useEditor()
  const ed = useEditor.getState
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(editSeed ?? title)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current!
    el.focus()
    if (editSeed == null) el.select()
    else el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const commit = (after?: () => void) => {
    if (done.current) return
    done.current = true
    const keepEmpty = !!(c.image || c.equation)
    ed().setTitle(id, value.trim() || keepEmpty ? value : title)
    ed().stopEdit()
    canvasApi.focus()
    after?.()
  }
  const cancel = () => { done.current = true; ed().stopEdit(); canvasApi.focus() }
  const z = view.zoom
  const lh = c.text?.lineHeight ?? Math.round(s.fontSize * 1.3)
  const lines = Math.max(1, value.split('\n').length)
  const tx = c.text ? c.text.x + (box.w - c.w) / 2 : c.padX
  const ty = c.text ? c.text.y + (box.h - c.h) / 2 : c.padY
  const w = Math.max(c.text?.textW ?? 60, Math.min(s.maxWidth, value.length * s.fontSize * 0.62)) + 16
  return (
    <textarea ref={ref} className="title-editor" value={value} spellCheck={false}
      onChange={e => setValue(e.target.value)}
      onBlur={() => commit()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Escape') cancel()
        else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); commit() }
        else if (e.key === 'Tab') { e.preventDefault(); commit(() => ed().addChild()) }
      }}
      style={{
        left: (box.x + tx - 8) * z + view.x, top: (box.y + ty - 4) * z + view.y,
        width: w * z, height: (Math.max(lines * lh, c.text?.textH ?? lh) + 8) * z,
        padding: `${4 * z}px ${8 * z}px`,
        font: `${s.fontStyle} ${WEIGHTS[s.fontWeight] ?? 400} ${s.fontSize * z}px/${lh * z}px ${s.fontFamily}`,
        textAlign: s.textAlign, color: s.textColor,
      }} />
  )
}

if (import.meta.env.DEV) Object.assign((window as unknown as { __mm: object }).__mm ?? {}, { canvasApi })
