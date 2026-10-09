import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Sheet, Topic } from './model'
import { indexSheet, isAncestor, levelOf } from './model'
import type { Box, LayoutResult, Pt } from './layout'
import { layoutSheet } from './layout'
import { FullStyle, resolveStyle, sheetBackground } from './themes'
import { measureText, TextBox, topicSize } from './measure'
import { edgePath, shapePath } from './paths'
import { currentLayout, setCurrentLayout, topLevel, useEditor } from './store'

export interface Rendered {
  layout: LayoutResult
  styles: Map<string, FullStyle>
  texts: Map<string, TextBox & { padX: number; padY: number }>
}

export function renderSheet(sheet: Sheet): Rendered {
  const idx = indexSheet(sheet)
  const styles = new Map<string, FullStyle>()
  const texts = new Map<string, TextBox & { padX: number; padY: number }>()
  const sizes = new Map<string, { w: number; h: number; underline: boolean }>()
  for (const [id, ref] of idx) {
    const st = resolveStyle(sheet, ref)
    const tb = measureText(ref.topic.title, st)
    const sz = topicSize(tb, st)
    styles.set(id, st)
    texts.set(id, { ...tb, padX: sz.padX, padY: sz.padY })
    sizes.set(id, { w: sz.w, h: sz.h, underline: st.shape === 'underline' })
  }
  const layout = layoutSheet(sheet, (t: Topic) => sizes.get(t.id)!)
  return { layout, styles, texts }
}

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'marquee'; a: Pt; b: Pt; additive: boolean; base: string[] }
  | { kind: 'topic'; ids: string[]; start: Pt; cur: Pt; active: boolean; grab: Pt;
      target: { id: string; mode: 'child' | 'before' | 'after' } | null }

export default function MapCanvas({ sheet, readOnly = false }: { sheet: Sheet; readOnly?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const { view, selection, editingId } = useEditor()
  const ed = useEditor.getState
  const r = useMemo(() => renderSheet(sheet), [sheet])
  setCurrentLayout(r.layout)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const spaceDown = useRef(false)
  const updateDrag = (d: Drag | null) => { dragRef.current = d; setDrag(d) }

  // начальное положение: центральная тема по центру, крупные карты — вписать
  useLayoutEffect(() => {
    fitToScreen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id])

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTyping(e)) spaceDown.current = true }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false }
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

  function onBgPointerDown(e: React.PointerEvent) {
    if ((e.target as Element).closest('.topic, .toggle, .title-editor')) return
    wrap.current!.focus()
    if (ed().editingId) ed().stopEdit()
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

  function onPointerMove(e: React.PointerEvent) {
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
    } else {
      const cur = toWorld(e.clientX, e.clientY)
      const active = d.active || Math.hypot(cur.x - d.start.x, cur.y - d.start.y) * ed().view.zoom > 4
      updateDrag({ ...d, cur, active, target: active ? findDropTarget(cur, d.ids) : null })
    }
  }

  function onPointerUp() {
    const d = dragRef.current
    updateDrag(null)
    if (!d || d.kind !== 'topic') return
    if (!d.active) {
      // простой щелчок по теме из мультивыделения — выделить только её
      const id = d.ids.find(i => { const b = r.layout.boxes.get(i); return b && d.start.x >= b.x && d.start.x <= b.x + b.w && d.start.y >= b.y && d.start.y <= b.y + b.h })
      if (id && d.ids.length > 1) ed().select([id])
      return
    }
    const root = sheet.rootTopic.id
    const ids = d.ids.filter(id => id !== root)
    if (!ids.length) return
    if (d.target) { ed().move(ids, d.target.id, d.target.mode); return }
    // отпущено на пустом месте: плавающая тема двигается, обычная — становится плавающей
    const pos = { x: d.cur.x - d.grab.x, y: d.cur.y - d.grab.y }
    const floating = new Set((sheet.floatingTopics ?? []).map(f => f.id))
    if (ids.length === 1 && floating.has(ids[0])) ed().setPosition(ids[0], pos)
    else ed().detach(ids, pos)
  }

  function findDropTarget(p: Pt, ids: string[]): { id: string; mode: 'child' | 'before' | 'after' } | null {
    const idx = indexSheet(sheet)
    const excluded = (id: string) => ids.some(m => m === id || isAncestor(idx, m, id))
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
    if (!ref.parent || best.dist > 0) return { id: box.id, mode: 'child' }
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
  })

  const idx = useMemo(() => indexSheet(sheet), [sheet])
  const selSet = new Set(selection)
  const dragIds = drag?.kind === 'topic' && drag.active ? topLevel(sheet, drag.ids) : []
  const ghostIds = new Set<string>()
  if (dragIds.length) for (const [id] of idx) if (dragIds.some(m => m === id || isAncestor(idx, m, id))) ghostIds.add(id)

  const bg = sheetBackground(sheet)
  const rootStyle = r.styles.get(sheet.rootTopic.id)!

  return (
    <div ref={wrap} className="map-canvas" tabIndex={0} data-testid="map-canvas"
      style={{ background: bg, cursor: drag?.kind === 'pan' ? 'grabbing' : 'default' }}
      onPointerDown={onBgPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onContextMenu={e => e.preventDefault()}
      onDoubleClick={e => {
        if (readOnly || (e.target as Element).closest('.topic')) return
        const p = toWorld(e.clientX, e.clientY)
        ed().addFloating(p.x, p.y - 15)
      }}>
      <svg className="bg" width="100%" height="100%" style={{ display: 'block' }}>
        <g transform={`translate(${view.x},${view.y}) scale(${view.zoom})`}>
          {r.layout.decos.map((d, i) => (
            <polyline key={'d' + i} points={d.pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
              stroke={d.kind === 'grid' ? rootStyle.borderColor : rootStyle.lineColor}
              strokeWidth={d.kind === 'grid' ? 1 : Math.max(3, rootStyle.lineWidth + 1)} />
          ))}
          {r.layout.edges.map(e => {
            const from = r.styles.get(e.from)!, to = r.styles.get(e.to)
            const color = sheet.rainbow && e.from === sheet.rootTopic.id && to ? to.lineColor : from.lineColor
            const shape = e.kind === 'line' ? 'straight' : from.lineShape
            const { d, filled } = edgePath(e, shape, from.lineWidth)
            if (!d) return null
            return <path key={e.from + '-' + e.to + e.kind} d={d} fill={filled ? color : 'none'}
              stroke={filled ? 'none' : color} strokeWidth={from.lineWidth} strokeLinecap="round"
              opacity={ghostIds.has(e.to) ? 0.25 : 1} />
          })}
          {[...r.layout.boxes.values()].map(b => {
            const ref = idx.get(b.id)
            if (!ref) return null
            return <TopicNode key={b.id} box={b} topic={ref.topic} style={r.styles.get(b.id)!} text={r.texts.get(b.id)!}
              selected={selSet.has(b.id)} dim={ghostIds.has(b.id)} hidden={editingId === b.id}
              central={levelOf(ref) === 'central'}
              onPointerDown={e => onTopicPointerDown(e, b.id)}
              onDoubleClick={e => { e.stopPropagation(); if (!readOnly) ed().startEdit(b.id) }} />
          })}
          {r.layout.toggles.map(t => (
            <g key={'t' + t.id} className={'toggle' + (t.collapsed ? ' collapsed' : '')}
              transform={`translate(${t.x},${t.y})`}
              onPointerDown={e => { e.stopPropagation(); ed().select([t.id]); ed().toggleCollapse() }}>
              <circle r={t.collapsed ? 9 : 6} fill={bg} stroke={r.styles.get(t.id)!.lineColor} strokeWidth={1.5} />
              {t.collapsed
                ? <text textAnchor="middle" dy="3.5" fontSize={9} fill={r.styles.get(t.id)!.lineColor}>{t.count > 99 ? '99+' : t.count}</text>
                : <path d="M-3,0H3" stroke={r.styles.get(t.id)!.lineColor} strokeWidth={1.5} />}
            </g>
          ))}
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
          {drag?.kind === 'marquee' && (
            <rect x={Math.min(drag.a.x, drag.b.x)} y={Math.min(drag.a.y, drag.b.y)}
              width={Math.abs(drag.a.x - drag.b.x)} height={Math.abs(drag.a.y - drag.b.y)}
              fill="var(--color-selection)" fillOpacity={0.08} stroke="var(--color-selection)" strokeWidth={1 / view.zoom} />
          )}
        </g>
      </svg>
      {editingId && r.layout.boxes.get(editingId) && (
        <TitleEditor key={editingId} id={editingId} box={r.layout.boxes.get(editingId)!}
          style={r.styles.get(editingId)!} text={r.texts.get(editingId)!}
          title={idx.get(editingId)?.topic.title ?? ''} />
      )}
    </div>
  )
}

export const canvasApi = {
  fit: () => {}, zoomBy: (_k: number) => {}, zoomTo: (_z: number) => {}, focus: () => {},
  ensureVisible: (_id: string) => {},
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

function TopicNode({ box, topic, style: s, text, selected, dim, hidden, central, onPointerDown, onDoubleClick }: {
  box: Box; topic: Topic; style: FullStyle; text: TextBox & { padX: number; padY: number }
  selected: boolean; dim: boolean; hidden: boolean; central: boolean
  onPointerDown: (e: React.PointerEvent) => void; onDoubleClick: (e: React.MouseEvent) => void
}) {
  const shape = box.cell ? 'rect' : s.shape
  const dash = s.borderStyle === 'dashed' ? `${s.borderWidth * 4} ${s.borderWidth * 3}` : s.borderStyle === 'dotted' ? `${s.borderWidth} ${s.borderWidth * 2}` : undefined
  const stroke = s.borderStyle === 'none' ? 'none' : s.borderColor
  const tx = s.textAlign === 'left' ? text.padX : s.textAlign === 'right' ? box.w - text.padX : box.w / 2
  const anchor = s.textAlign === 'left' ? 'start' : s.textAlign === 'right' ? 'end' : 'middle'
  const ty = (box.h - text.textH) / 2 + text.lineHeight * 0.78
  return (
    <g className="topic" data-id={topic.id} data-central={central || undefined} transform={`translate(${box.x},${box.y})`}
      opacity={dim ? 0.35 : 1} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
      {selected && <rect x={-4} y={-4} width={box.w + 8} height={box.h + 8} rx={8} fill="none"
        stroke="var(--color-selection)" strokeWidth={2} />}
      {shape === 'underline' ? (
        <>
          <rect width={box.w} height={box.h} fill={s.fill === 'transparent' ? 'rgba(0,0,0,0)' : s.fill} />
          <line x1={0} x2={box.w} y1={box.h} y2={box.h} stroke={stroke === 'none' ? s.lineColor : stroke}
            strokeWidth={Math.max(s.borderWidth, s.lineWidth)} strokeDasharray={dash} />
        </>
      ) : shape === 'none' ? (
        <rect width={box.w} height={box.h} fill={s.fill === 'transparent' ? 'rgba(0,0,0,0)' : s.fill} />
      ) : (
        <path d={shapePath(shape, box.w, box.h)} fill={s.fill === 'transparent' ? 'rgba(0,0,0,0)' : s.fill}
          stroke={stroke} strokeWidth={s.borderWidth} strokeDasharray={dash} />
      )}
      {!hidden && (
        <text x={tx} y={ty} textAnchor={anchor} fill={s.textColor} fontFamily={s.fontFamily} fontSize={s.fontSize}
          fontWeight={s.fontWeight} fontStyle={s.fontStyle} textDecoration={s.textDecoration}
          style={{ userSelect: 'none', whiteSpace: 'pre' }}>
          {text.lines.map((l, i) => <tspan key={i} x={tx} dy={i ? text.lineHeight : 0}>{l}</tspan>)}
        </text>
      )}
    </g>
  )
}

function TitleEditor({ id, box, style: s, text, title }: { id: string; box: Box; style: FullStyle; text: TextBox & { padX: number; padY: number }; title: string }) {
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
    ed().setTitle(id, value.trim() ? value : title)
    ed().stopEdit()
    canvasApi.focus()
    after?.()
  }
  const cancel = () => { done.current = true; ed().stopEdit(); canvasApi.focus() }
  const z = view.zoom
  const lines = Math.max(1, value.split('\n').length)
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
        left: box.x * z + view.x, top: box.y * z + view.y,
        minWidth: box.w * z, width: Math.max(box.w, Math.min(s.maxWidth, value.length * s.fontSize * 0.62) + text.padX * 2) * z,
        height: Math.max(box.h, lines * text.lineHeight + text.padY * 2) * z,
        padding: `${text.padY * z}px ${text.padX * z}px`,
        font: `${s.fontStyle} ${s.fontWeight} ${s.fontSize * z}px/${text.lineHeight * z}px ${s.fontFamily}`,
        textAlign: s.textAlign, color: s.textColor,
      }} />
  )
}
