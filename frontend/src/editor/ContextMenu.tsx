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

export const useContextMenu = create<{ at: { x: number; y: number; id: string } | null }>(() => ({ at: null }))
export const openTopicMenu = (x: number, y: number, id: string) => useContextMenu.setState({ at: { x, y, id } })

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
  const ref0 = sheet ? indexSheet(sheet).get(at.id) : undefined
  if (!sheet || !ref0) return null
  const t = ref0.topic, id = at.id
  const isRoot = ref0.kind === 'root'
  const run = (fn: () => void) => () => { close(); fn() }
  const hasKids = !!t.children?.length
  return (
    <div ref={ref} className={'menu ctx-menu' + ((pos?.left ?? at.x) > window.innerWidth / 2 ? ' flip' : '')} role="menu" aria-label="Меню темы" onContextMenu={e => e.preventDefault()}
      style={{ position: 'fixed', zIndex: 1000, left: pos?.left ?? at.x, top: pos?.top ?? at.y, visibility: pos ? 'visible' : 'hidden' }}>
      <i className="mm-main" hidden />
      <SubMenu label="Вставить">
        <MenuItem icon="note" label="Заметка" onClick={run(() => ed.setPanel('notes'))} />
        <MenuItem icon="label" label="Метка" onClick={run(() => ed.setDialog({ kind: 'labels', id }))} />
        <MenuItem icon="task" label="To-Do" onClick={run(() => ed.setTopic([id], { task: t.task ? undefined : { done: false } }))} />
        <MenuItem icon="gantt" label="Задача" onClick={run(() => insertTask(id))} />
        <MenuItem icon="link" label="Веб-ссылка" onClick={run(() => ed.setDialog({ kind: 'link', id }))} />
        <MenuItem icon="topic" label="Ссылка на тему" onClick={run(() => ed.setDialog({ kind: 'link', id }))} />
        <MenuItem icon="callout" label="Выноска" disabled={isRoot} onClick={run(() => ed.addCallout())} />
        <div className="menu-sep" />
        <MenuItem icon="attach" label="Вложение" onClick={run(async () => { const f = await pickFile(); if (f) uploadToTopic(id, f, 'attachment') })} />
        <div className="menu-sep" />
        <MenuItem icon="marker" label="Маркер" onClick={run(() => { ed.setPanel('markers'); ed.setMarkerTab('markers') })} />
        <MenuItem icon="sticker" label="Стикер" onClick={run(() => { ed.setPanel('markers'); ed.setMarkerTab('stickers') })} />
        <MenuItem icon="illustration" label="Иллюстрация" onClick={run(() => { ed.setPanel('markers'); ed.setMarkerTab('illustrations') })} />
        <MenuItem icon="image" label="Изображение" onClick={run(async () => { const f = await pickFile('image/*'); if (f) uploadToTopic(id, f, 'image') })} />
        <MenuItem icon="equation" label="Формула" onClick={run(() => ed.setDialog({ kind: 'equation', id }))} />
      </SubMenu>
      <div className="menu-sep" />
      <MenuItem label="Копировать" hint="⌘ C" onClick={run(() => ed.copy())} />
      <MenuItem label="Вырезать" hint="⌘ X" disabled={isRoot} onClick={run(() => ed.cut())} />
      <MenuItem label="Вставить" hint="⌘ V" onClick={run(() => ed.paste(undefined, id))} />
      <MenuItem label="Дублировать" hint="⌘ D" disabled={isRoot} onClick={run(() => ed.duplicate())} />
      <div className="menu-sep" />
      <MenuItem label="Удалить" hint="⌫" disabled={isRoot} onClick={run(() => ed.removeSelected())} />
      <MenuItem label="Удалить только тему" hint="⌘ ⌫" disabled={isRoot} onClick={run(() => ed.deleteSingle())} />
      <div className="menu-sep" />
      <MenuItem label="Копировать стиль" hint="⌘ ⌥ C" onClick={run(() => ed.copyStyle(resolveStyle(sheet, ref0)))} />
      <MenuItem label="Вставить стиль" hint="⌘ ⌥ V" disabled={!useEditor.getState().styleClipboard} onClick={run(() => ed.pasteStyle())} />
      <MenuItem label="Сбросить стиль" hint="⌘ ⌥ 0" onClick={run(() => ed.clearStyle())} />
      <div className="menu-sep" />
      <MenuItem label={t.collapsed ? 'Развернуть подтемы' : 'Свернуть подтемы'} hint="⌘ /" disabled={!hasKids} onClick={run(() => ed.toggleCollapse())} />
      <MenuItem label="Развернуть все подветки" hint="⌘ ⌥ /" disabled={!hasKids} onClick={run(() => ed.foldAll(false))} />
      <div className="menu-sep" />
      <MenuItem label="Показать только ветку" hint="⌘ ;" disabled={isRoot} onClick={run(() => ed.drillDown(id))} />
      <div className="menu-sep" />
      <MenuItem label="Сбросить положение" disabled={!t.offset} onClick={run(() => ed.resetPosition())} />
      <MenuItem label="Новый лист из темы" onClick={run(() => ed.newSheetFromTopic(id))} />
    </div>
  )
}
