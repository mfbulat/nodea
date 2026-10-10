// Контекстное меню темы (правый щелчок), как в веб-версии: «Вставить ›», буфер обмена,
// удаление, стиль, сворачивание, «только ветка», сброс положения, новый лист из темы.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useEditor } from './store'
import { indexSheet } from './model'
import { resolveStyle } from './themes'
import { MenuItem, SubMenu } from './Chrome'
import { pickFile, uploadToTopic } from './actions'
import { insertTask } from './Gantt'

export const useContextMenu = create<{ at: { x: number; y: number; id: string; world?: { x: number; y: number } } | null }>(() => ({ at: null }))
export const openTopicMenu = (x: number, y: number, id: string) => useContextMenu.setState({ at: { x, y, id } })
/** меню пустого места холста; world — точка на карте для плавающей темы */
export const openCanvasMenu = (x: number, y: number, world: { x: number; y: number }) => useContextMenu.setState({ at: { x, y, id: '', world } })
/** «Скрыть все комментарии» */
export const useCommentsHidden = create<{ hidden: boolean }>(() => ({ hidden: false }))

export default function ContextMenu() {
  const at = useContextMenu(s => s.at)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const close = () => useContextMenu.setState({ at: null })
  useEffect(() => {
    if (!at) return
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', close)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key); window.removeEventListener('blur', close) }
  }, [at])
  useLayoutEffect(() => {
    if (!at || !ref.current) { setPos(null); return }
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight
    setPos({ left: Math.max(8, Math.min(at.x, window.innerWidth - w - 8)), top: Math.max(8, Math.min(at.y, window.innerHeight - h - 8)) })
  }, [at])
  if (!at) return null
  const ed = useEditor.getState()
  const sheet = ed.sheet()
  const style = { position: 'fixed' as const, zIndex: 1000, left: pos?.left ?? at.x, top: pos?.top ?? at.y, visibility: (pos ? 'visible' : 'hidden') as 'visible' | 'hidden' }
  if (!at.id && sheet) {
    const run = (fn: () => void) => () => { close(); fn() }
    const hidden = useCommentsHidden.getState().hidden
    return (
      <div ref={ref} className="menu ctx-menu" role="menu" aria-label="Canvas menu" onContextMenu={e => e.preventDefault()} style={style}>
        <i className="mm-main" hidden />
        <MenuItem label="Paste" hint="⌘ V" disabled={!ed.clipboard} onClick={run(() => { ed.select([]); ed.paste() })} />
        <div className="menu-sep" />
        <MenuItem label="Create Zone" hint="⌘ ⌥ Z" onClick={run(() => ed.setZoneDrawing(true))} />
        <MenuItem label="Insert Floating Topic" onClick={run(() => ed.addFloating(at.world!.x, at.world!.y - 15))} />
        <MenuItem label="Insert Relationship" hint="⌘ ⇧ R" disabled={!ed.selection.length} onClick={run(() => ed.startRelating())} />
        <div className="menu-sep" />
        <MenuItem label="Unfold All Sub-Branches" hint="⌘ ⌥ /" onClick={run(() => { ed.select([sheet.rootTopic.id]); ed.foldAll(false) })} />
        <MenuItem label={hidden ? 'Show All Comments' : 'Hide All Comments'} onClick={run(() => useCommentsHidden.setState({ hidden: !hidden }))} />
        <div className="menu-sep" />
        <MenuItem label="Go to Central Topic" hint="⌘ R" onClick={run(() => ed.goCentral())} />
        <MenuItem label="Select All" hint="⌘ A" onClick={run(() => ed.selectAll())} />
      </div>
    )
  }
  const ref0 = sheet ? indexSheet(sheet).get(at.id) : undefined
  if (!sheet || !ref0) return null
  const t = ref0.topic, id = at.id
  const isRoot = ref0.kind === 'root'
  const run = (fn: () => void) => () => { close(); fn() }
  const hasKids = !!t.children?.length
  return (
    <div ref={ref} className="menu ctx-menu" role="menu" aria-label="Topic menu" onContextMenu={e => e.preventDefault()}
      style={style}>
      <i className="mm-main" hidden />
      <SubMenu label="Insert">
        <MenuItem icon="note" label="Note" onClick={run(() => ed.setPanel('notes'))} />
        <MenuItem icon="label" label="Label" onClick={run(() => ed.setDialog({ kind: 'labels', id }))} />
        <MenuItem icon="task" label="To-Do" onClick={run(() => ed.setTopic([id], { task: t.task ? undefined : { done: false } }))} />
        <MenuItem icon="gantt" label="Task" onClick={run(() => insertTask(id))} />
        <MenuItem icon="link" label="Web Link" onClick={run(() => ed.setDialog({ kind: 'link', id }))} />
        <MenuItem icon="topic" label="Topic Link" onClick={run(() => ed.setDialog({ kind: 'link', id, mode: 'topic' }))} />
        <MenuItem icon="callout" label="Callout" disabled={ref0.kind === 'callout'} onClick={run(() => ed.addCallout())} />
        <div className="menu-sep" />
        <MenuItem icon="attach" label="Attachment" onClick={run(async () => { const f = await pickFile(); if (f) uploadToTopic(id, f, 'attachment') })} />
        <div className="menu-sep" />
        <MenuItem icon="marker" label="Marker" onClick={run(() => { ed.setPanel('markers'); ed.setMarkerTab('markers') })} />
        <MenuItem icon="sticker" label="Sticker" onClick={run(() => { ed.setPanel('markers'); ed.setMarkerTab('stickers') })} />
        <MenuItem icon="illustration" label="Illustration" onClick={run(() => { ed.setPanel('markers'); ed.setMarkerTab('illustrations') })} />
        <MenuItem icon="image" label="Local Image" onClick={run(async () => { const f = await pickFile('image/*'); if (f) uploadToTopic(id, f, 'image') })} />
        <MenuItem icon="equation" label="Equation" onClick={run(() => ed.setDialog({ kind: 'equation', id }))} />
      </SubMenu>
      <div className="menu-sep" />
      <MenuItem label="Copy" hint="⌘ C" onClick={run(() => ed.copy())} />
      <MenuItem label="Cut" hint="⌘ X" disabled={isRoot} onClick={run(() => ed.cut())} />
      <MenuItem label="Paste" hint="⌘ V" onClick={run(() => ed.paste(undefined, id))} />
      <MenuItem label="Duplicate" hint="⌘ D" disabled={isRoot} onClick={run(() => ed.duplicate())} />
      <div className="menu-sep" />
      <MenuItem label="Delete" hint="⌫" disabled={isRoot} onClick={run(() => ed.removeSelected())} />
      <MenuItem label="Delete Single Topic" hint="⌘ ⌫" disabled={isRoot} onClick={run(() => ed.deleteSingle())} />
      <div className="menu-sep" />
      <MenuItem label="Copy Style" hint="⌘ ⌥ C" onClick={run(() => ed.copyStyle(resolveStyle(sheet, ref0)))} />
      <MenuItem label="Paste Style" hint="⌘ ⌥ V" disabled={!useEditor.getState().styleClipboard} onClick={run(() => ed.pasteStyle())} />
      <MenuItem label="Reset Style" hint="⌘ ⌥ 0" onClick={run(() => ed.clearStyle())} />
      <div className="menu-sep" />
      <MenuItem label={t.collapsed ? 'Unfold Subtopic' : 'Fold Subtopic'} hint="⌘ /" disabled={!hasKids} onClick={run(() => ed.toggleCollapse())} />
      <MenuItem label={t.children?.some(c => c.collapsed) ? 'Unfold All Sub-Branches' : 'Fold All Sub-Branches'} hint="⌘ ⌥ /" disabled={!hasKids} onClick={run(() => ed.foldAll())} />
      <div className="menu-sep" />
      <MenuItem label="Show Branch Only" hint="⌘ ;" disabled={isRoot} onClick={run(() => ed.drillDown(id))} />
      <div className="menu-sep" />
      <MenuItem label="Reset Position" disabled={!t.offset && !t.freePos} onClick={run(() => ed.resetPosition())} />
      <MenuItem label="New Sheet From Topic" onClick={run(() => ed.newSheetFromTopic(id))} />
    </div>
  )
}
