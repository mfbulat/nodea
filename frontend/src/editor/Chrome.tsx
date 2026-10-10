import { create } from 'zustand'
// Интерфейс редактора (как веб-версия): верхняя полоса на сером фоне, белый холст-карточка,
// правая панель-карточка, нижняя строка с листами и масштабом.
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import Icon, { IconName } from '../ui/Icon'
import { useEditor } from './store'
import { canvasApi } from './MapCanvas'
import InsertMenu from './InsertMenu'
import { indexSheet, type Sheet } from './model'
import { collab, useCollab } from '../collab/session'
import { useDoc } from '../store/doc'
import { useAuth } from '../store/auth'
import { Presence } from '../collab/ShareDialog'
import { api } from '../api/client'

/** Подсказка как в веб-версии: название, сочетание клавиш, описание */
export function Tip({ title, keys, desc, children, below = true }: { title: string; keys?: string; desc?: string; children: ReactNode; below?: boolean }) {
  const [show, setShow] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout>>()
  return (
    <span className="tip-wrap" onMouseEnter={() => { t.current = setTimeout(() => setShow(true), 450) }}
      onMouseLeave={() => { clearTimeout(t.current); setShow(false) }} onMouseDown={() => { clearTimeout(t.current); setShow(false) }}>
      {children}
      {show && <span className={'tip' + (below ? '' : ' above')} role="tooltip">
        <span className="tip-head"><b>{title}</b>{keys && <kbd>{keys}</kbd>}</span>{desc && <span className="tip-desc">{desc}</span>}
      </span>}
    </span>
  )
}

export function IconButton({ icon, label, onClick, active, disabled, children, keys, desc }: {
  icon: IconName; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode; keys?: string; desc?: string
}) {
  const withText = useEditor(s => s.toolbarText)
  return (
    <Tip title={label} keys={keys} desc={desc}>
      <button className={'ibtn' + (active ? ' on' : '') + (withText ? ' with-text' : '')} onClick={onClick} disabled={disabled} aria-label={label}>
        <Icon name={icon} />{withText && <span className="ibtn-text">{label}</span>}{children}
      </button>
    </Tip>
  )
}

/** Выпадающее меню, закрывается щелчком мимо */
export function Dropdown({ trigger, children, align = 'left', up = false }: {
  trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; up?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc) }
  }, [open])
  // меню выводится поверх всего (портал) и не обрезается панелями; положение — у кнопки, в пределах окна
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = ref.current!.getBoundingClientRect(), m = menuRef.current!
    const w = m.offsetWidth, h = m.offsetHeight
    const left = Math.max(8, Math.min(align === 'right' ? r.right - w : r.left, window.innerWidth - w - 8))
    let top = up ? r.top - h - 8 : r.bottom + 8
    if (!up && top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8)
    if (up && top < 8) top = r.bottom + 8
    setPos({ left, top })
  }, [open, align, up])
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(open, () => setOpen(o => !o))}
      {open && createPortal(
        <div ref={menuRef} className="menu portal" role="menu"
          style={{ position: 'fixed', zIndex: 1000, right: 'auto', bottom: 'auto', left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          {children(() => setOpen(false))}
        </div>, document.body)}
    </div>
  )
}

export function MenuItem({ label, hint, onClick, disabled, icon, checked }: { label: string; hint?: string; onClick: () => void; disabled?: boolean; icon?: IconName; checked?: boolean }) {
  return (
    <button role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked} disabled={disabled} onClick={onClick}>
      {checked !== undefined && <span className="mi-check">{checked && <svg width={14} height={14} viewBox="0 0 14 14"><path d="M3 7.2l2.6 2.6L11 4.4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>}
      {icon && <Icon name={icon} size={16} />}<span className="mi-label">{label}</span>{hint && <kbd>{hint}</kbd>}
    </button>
  )
}

/** Пункт с вложенным меню: открывается наведением или щелчком/стрелкой вправо, закрывается с задержкой
 * (мелкий промах курсора не закрывает), у края окна переворачивается влево и сдвигается вверх */
export function SubMenu({ label, icon, children }: { label: string; icon?: IconName; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ flip: boolean; dy: number } | null>(null)
  const timer = useRef(0)
  const sub = useRef<HTMLDivElement>(null)
  const show = () => { clearTimeout(timer.current); setOpen(true) }
  const hide = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 250) }
  useEffect(() => () => clearTimeout(timer.current), [])
  useLayoutEffect(() => {
    if (!open || !sub.current) { setPlace(null); return }
    const host = sub.current.parentElement!.getBoundingClientRect(), w = sub.current.offsetWidth, h = sub.current.offsetHeight
    const flip = host.right + 4 + w > window.innerWidth - 8 && host.left - 4 - w >= 8
    const top = host.top - 8
    const dy = Math.min(0, window.innerHeight - 8 - (top + h)) + Math.max(0, 8 - top)
    setPlace({ flip, dy })
  }, [open])
  return (
    <div className="submenu" onMouseEnter={show} onMouseLeave={hide}
      onKeyDown={e => { if (e.key === 'ArrowRight') { e.preventDefault(); show() } else if (e.key === 'ArrowLeft' || e.key === 'Escape') { if (open) { e.stopPropagation(); e.preventDefault(); setOpen(false) } } }}>
      <button role="menuitem" aria-haspopup="menu" aria-expanded={open} className={open ? 'on' : ''} onClick={() => (open ? setOpen(false) : show())}>
        {icon && <Icon name={icon} size={16} />}<span className="mi-label">{label}</span><Icon name="chevronRight" size={14} />
      </button>
      {open && <div ref={sub} className="menu sub" role="menu"
        style={{ visibility: place ? 'visible' : 'hidden', ...(place?.flip ? { left: 'auto', right: 'calc(100% + 4px)' } : {}), top: -8 + (place?.dy ?? 0) }}>{children}</div>}
    </div>
  )
}

const SAVE: Record<string, string> = {
  saved: 'Saved', dirty: 'Edited', saving: 'Saving…', error: 'Save failed', conflict: 'Version conflict',
}

/** Слева: меню, название, избранное, путь */
/** Адаптивная верхняя панель как в веб-версии: по ширине окна (открытая боковая панель отнимает ~300px)
 * прячутся «Сводка/Граница», затем «Связь», подпись под названием, «Гант», затем «Презентация/Комментарии». */
/** «Избранное» для текущей карты: общее для звёздочки в заголовке и пункта меню «Файл» */
export const useStar = create<{ starred: boolean; mapId: string | null }>(() => ({ starred: false, mapId: null }))
export function toggleStar() {
  const { starred, mapId } = useStar.getState()
  if (!mapId) return
  useStar.setState({ starred: !starred })
  api(`/api/maps/${mapId}`, { method: 'PATCH', json: { starred: !starred } }).catch(() => useStar.setState({ starred }))
}

export function useBarFit() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  const panel = useEditor(s => s.panel)
  const left = useEditor(s => !!(s.nav || s.taskDialog))
  const side = (panel ? 300 : 0) + (left ? 300 : 0)
  const free = w - side
  return { summary: free >= 1000, relation: free >= 930, subtitle: w - side + (side ? 100 : 0) >= 900, gantt: free >= 900, present: free >= 800 }
}

export function TopLeft({ mainMenu, guest, mapId }: { mainMenu: ReactNode; guest: boolean; mapId?: string }) {
  const { title, setTitle, role, saveState } = useDoc()
  const status = useCollab(s => s.status)
  const starred = useStar(s => s.starred)
  useEffect(() => {
    useStar.setState({ starred: false, mapId: mapId ?? null })
    if (role === 'owner' && mapId) api<{ starred?: boolean }>(`/api/maps/${mapId}`).then(m => useStar.setState({ starred: !!m.starred })).catch(() => {})
  }, [mapId, role])
  const fit = useBarFit()
  const state = status === 'offline' ? 'All changes will sync when connection is restored' : status === 'connecting' ? 'Connecting…'
    : role === 'owner' ? SAVE[saveState] : role === 'view' ? 'View only' : 'Editing via link'
  return (
    <div className="bar-left">
      {mainMenu}
      <div className="title-block">
        <div className="title-row">
          <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Map title"
            readOnly={role !== 'owner'} size={Math.max(4, Math.min(40, title.length + 1))} />
          {role === 'owner' && <Tip title={starred ? 'Remove from Starred' : 'Add to Starred'}>
            <button className={'star-btn' + (starred ? ' on' : '')} onClick={toggleStar} aria-label="Starred"><Icon name="star" size={16} /></button>
          </Tip>}
        </div>
        <span className="crumb" data-testid="save-state" title={state} hidden={!fit.subtitle}>
          {guest ? <Link to="/login">Log In</Link> : <Link to="/">My Works</Link>}<span className="dot">·</span>{state}
        </span>
      </div>
    </div>
  )
}

/** По центру: тема, подтема | связь, сводка, граница | вставить */
export function TopCenter() {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const none = !selection.length
  const fit = useBarFit()
  return (
    <div className="bar-center toolbar" role="toolbar" aria-label="Toolbar">
      <IconButton icon="topic" label="Topic" keys="⏎" desc="Add a topic after the selected topic." onClick={() => ed.addSibling(false)} disabled={none} />
      <IconButton icon="subtopic" label="Subtopic" keys="⇥" desc="Add a child topic to the selected topic." onClick={ed.addChild} disabled={none} />
      <span className="sep" />
      {fit.relation && <IconButton icon="relationship" label="Relationship" keys="⌘ ⇧ R" desc="Create a relationship between the two topics." onClick={ed.startRelating} disabled={none} />}
      {fit.summary && <IconButton icon="summary" label="Summary" desc="Add a summary to the selected topics." onClick={ed.addSummary} disabled={none} />}
      {fit.summary && <IconButton icon="boundary" label="Boundary" keys="⌘ ⇧ B" desc="Group the selected topics with boundary." onClick={ed.addBoundary} disabled={none} />}
      {fit.relation && <span className="sep" />}
      <InsertMenu />
    </div>
  )
}

/** По центру в режиме «Структура»: уровень вверх/вниз и вставка */
export function OutlineCenter() {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const none = !selection.length
  return (
    <div className="bar-center toolbar" role="toolbar" aria-label="Toolbar">
      <IconButton icon="outdent" label="Promote" keys="⇧ ⇥" onClick={ed.outdent} disabled={none} />
      <IconButton icon="indent" label="Demote" keys="⇥" onClick={ed.indent} disabled={none} />
      <span className="sep" />
      <InsertMenu />
    </div>
  )
}

/** Справа: участники, «Поделиться», Гант, презентация, комментарии, маркеры, формат */
export function TopRight({ onShare, isOwner, outline, readOnly = false }: { onShare?: () => void; isOwner: boolean; outline: boolean; readOnly?: boolean }) {
  const { panel, gantt } = useEditor()
  const ed = useEditor.getState()
  const toggle = (p: typeof panel) => ed.setPanel(panel === p ? null : p)
  const fit = useBarFit()
  return (
    <div className="bar-right">
      <Presence />
      {onShare && <button className="share-btn" onClick={onShare}>Share</button>}
      <div className="bar-icons">
        {!outline && fit.gantt && <IconButton icon="gantt" label="Gantt" desc="Open Gantt Chart in a separate window." onClick={() => ed.setGantt(!gantt)} active={gantt} />}
        {fit.present && <IconButton icon="present" label="Pitch" keys="⌥ ⌘ P" desc="Access into Pitch Mode to present your ideas." onClick={() => ed.setPresenting(true)} />}
        {!outline && fit.present && <IconButton icon="comment" label="Comment" desc="Open Comments panel to view and add comments." onClick={() => toggle('comments')} active={panel === 'comments'} />}
        {!readOnly && <IconButton icon="marker" label="Marker" desc="Add a marker to selected topics." onClick={() => toggle('markers')} active={panel === 'markers'} />}
        {!outline && !readOnly && <IconButton icon="panel" label="Format" keys="⌘ ]" desc="Show or hide style and format options." onClick={() => toggle('format')} active={panel === 'format'} />}
      </div>
    </div>
  )
}

/** Главное меню «☰» */
const EXPORT_MENU: [string, string][] = [['png', 'PNG'], ['jpeg', 'JPEG'], ['svg', 'SVG'], ['pdf', 'PDF'], ['md', 'Markdown'], ['docx', 'Word'], ['xlsx', 'Excel'],
  ['pptx', 'PowerPoint (Pitch)'], ['webm', 'Pitch Video'], ['opml', 'OPML'], ['textbundle', 'TextBundle'], ['tasks-xlsx', 'Excel (Task)'], ['ics', 'Calendar (Task)']]

export function MainMenu({ isOwner, onHelp, onShare, onExport, onImport, onSaveTemplate }: {
  isOwner: boolean; onHelp: () => void; onShare?: () => void
  onExport: (fmt: string) => void; onImport: () => void; onSaveTemplate: () => void
}) {
  const starred = useStar(s => s.starred)
  const ed = useEditor.getState()
  const nav = useNavigate()
  const user = useAuth(s => s.user)
  const { drillId, selection, nav: navOpen, toolbarText } = useEditor()
  const cu = useCollab()
  const { past, future } = useEditor()
  const canUndo = collab() ? cu.canUndo : past.length > 0
  const canRedo = collab() ? cu.canRedo : future.length > 0
  return (
    <Dropdown trigger={(open, toggle) => (
      <Tip title="Menu"><button className={'ibtn' + (open ? ' on' : '')} onClick={toggle} aria-label="Menu"><Icon name="hamburger" /></button></Tip>
    )}>
      {close => <>
        <i className="mm-main" hidden />
        {user && <MenuItem icon="arrowLeft" label="Back to Files" onClick={() => { close(); nav('/') }} />}
        <div className="menu-sep" />
        <SubMenu icon="file" label="File">
          {user && <MenuItem label="New Map" onClick={async () => { close(); const m = await api<{ id: string }>('/api/maps', { method: 'POST', json: { title: 'Mind Map' } }); nav(`/map/${m.id}`) }} />}
          {isOwner && <MenuItem label="New Sheet" onClick={() => { close(); ed.addSheet() }} />}
          <div className="menu-sep" />
          {isOwner && <MenuItem label="Rename" onClick={() => { close(); (document.querySelector('.title-input') as HTMLInputElement)?.select() }} />}
          {isOwner && <MenuItem label={starred ? 'Remove from Starred' : 'Add to Starred'} onClick={() => { close(); toggleStar() }} />}
          {isOwner && <MenuItem label="Version History" onClick={() => { close(); ed.setPanel('versions') }} />}
          <div className="menu-sep" />
          {user && <MenuItem label="Import File" onClick={() => { close(); onImport() }} />}
          <MenuItem label="Download" onClick={() => { close(); onExport('xmind') }} />
          {user && <MenuItem label="Save as Template" onClick={() => { close(); onSaveTemplate() }} />}
        </SubMenu>
        <SubMenu icon="edit" label="Edit">
          <MenuItem label="Undo" hint="⌘ Z" disabled={!canUndo} onClick={() => { close(); ed.undo() }} />
          <MenuItem label="Redo" hint="⇧ ⌘ Z" disabled={!canRedo} onClick={() => { close(); ed.redo() }} />
          <div className="menu-sep" />
          <MenuItem label="Search" hint="⌘ F" onClick={() => { close(); ed.setNav('outline') }} />
        </SubMenu>
        <div className="menu-sep" />
        <SubMenu icon="eye" label="View">
          <MenuItem icon="actualSize" label="Actual Size" onClick={() => { close(); canvasApi.zoomTo(1) }} />
          <MenuItem icon="fit" label="Fit Map" onClick={() => { close(); canvasApi.fit() }} />
          <div className="menu-sep" />
          <MenuItem icon="branchOnly" label={drillId ? 'Show Entire Map' : 'Show Branch Only'} disabled={!drillId && !selection.length} onClick={() => { close(); drillId ? ed.drillUp() : ed.drillDown() }} />
          <div className="menu-sep" />
          <MenuItem icon="gantt" label="Gantt Chart" onClick={() => { close(); ed.setGantt(true) }} />
          <MenuItem icon="present" label="Pitch Mode" onClick={() => { close(); ed.setPresenting(true) }} />
          <div className="menu-sep" />
          <SubMenu icon="navPanel" label="Navigation Panel">
            <MenuItem label="Topic" checked={navOpen === 'outline'} onClick={() => { close(); ed.setNav('outline') }} />
            <MenuItem label="Note" checked={navOpen === 'notes'} onClick={() => { close(); ed.setNav('notes') }} />
            <MenuItem label="Marker & Label" checked={navOpen === 'tags'} onClick={() => { close(); ed.setNav('tags') }} />
            <MenuItem label="Resources" checked={navOpen === 'resources'} onClick={() => { close(); ed.setNav('resources') }} />
          </SubMenu>
          <SubMenu icon="panel" label="Format Panel">
            <MenuItem label="Style" disabled={!selection.length} onClick={() => { close(); ed.setPanel('format'); setTimeout(() => window.dispatchEvent(new CustomEvent('mm:format-tab', { detail: 'style' })), 30) }} />
            <MenuItem label="Pitch" disabled={!selection.length} onClick={() => { close(); ed.setPanel('format'); setTimeout(() => window.dispatchEvent(new CustomEvent('mm:format-tab', { detail: 'pitch' })), 30) }} />
            <MenuItem label="Map" onClick={() => { close(); ed.setPanel('format'); setTimeout(() => window.dispatchEvent(new CustomEvent('mm:format-tab', { detail: 'map' })), 30) }} />
          </SubMenu>
          <div className="menu-sep" />
          <SubMenu icon="toolbar" label="Toolbar">
            <MenuItem label="Icon Only" checked={!toolbarText} onClick={() => { close(); ed.setToolbarText(false) }} />
            <MenuItem label="Icon and Text" checked={toolbarText} onClick={() => { close(); ed.setToolbarText(true) }} />
          </SubMenu>
        </SubMenu>
        <div className="menu-sep" />
        {onShare && <MenuItem icon="shareNodes" label="Share" onClick={() => { close(); onShare() }} />}
        <SubMenu icon="upload" label="Export As">
          {EXPORT_MENU.map(([f, l]) => <MenuItem key={f} label={l} onClick={() => { close(); onExport(f) }} />)}
        </SubMenu>
        <div className="menu-sep" />
        <MenuItem icon="keyboard" label="Shortcuts" onClick={() => { close(); onHelp() }} />
        <MenuItem icon="print" label="Print" onClick={() => { close(); setTimeout(() => window.print(), 50) }} />
        <MenuItem icon="feedback" label="Feedback" onClick={() => { close(); window.open('https://github.com/mfbulat/nodea/issues/new', '_blank', 'noopener') }} />
      </>}
    </Dropdown>
  )
}

/** Нижняя строка справа: масштаб и переключатель «Структура / Карта» */
export function BottomRight({ sheet }: { sheet: Sheet }) {
  const { view, viewMode } = useEditor()
  const ed = useEditor.getState()
  void sheet
  return (
    <div className="bar-bottom-right">
      {viewMode === 'map' && (
        <Dropdown align="right" up trigger={(open, toggle) => (
          <button className={'zoom-btn' + (open ? ' on' : '')} onClick={toggle} aria-label="Zoom">{Math.round(view.zoom * 100)}%<Icon name="chevron" size={14} /></button>
        )}>
          {close => <>
            {[20, 50, 80, 100, 120, 150, 200, 300, 400, 500].map(z => <MenuItem key={z} label={`${z}%`} onClick={() => { close(); canvasApi.zoomTo(z / 100) }} />)}
            <div className="menu-sep" />
            <MenuItem label="Fit Map" onClick={() => { close(); canvasApi.fit() }} />
          </>}
        </Dropdown>
      )}
      <button className="mode-btn" onClick={() => ed.setViewMode(viewMode === 'map' ? 'outline' : 'map')}>
        {viewMode === 'map' ? 'Outliner' : 'Mind Map'}</button>
    </div>
  )
}

/** Цепочка «только ветка» */
export function Crumbs({ sheet }: { sheet: Sheet }) {
  const { drillId } = useEditor()
  const ed = useEditor.getState()
  if (!drillId) return null
  const idx = indexSheet(sheet)
  const list: { id: string | null; title: string }[] = []
  let cur = idx.get(drillId)
  while (cur && cur.topic.id !== sheet.rootTopic.id) { list.unshift({ id: cur.topic.id, title: cur.topic.title }); cur = cur.parent ? idx.get(cur.parent.id) : undefined }
  list.unshift({ id: null, title: 'Entire Map' })
  return (
    <div className="island crumbs">
      {list.map((c, i) => (
        <span key={i}>{i > 0 && <span className="muted"> › </span>}
          {i < list.length - 1 ? <button className="link-btn" onClick={() => c.id ? ed.drillDown(c.id) : useEditor.setState({ drillId: null })}>{c.title}</button>
            : <b>{c.title}</b>}
        </span>
      ))}
    </div>
  )
}
