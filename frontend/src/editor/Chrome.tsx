// Интерфейс редактора: плавающие «острова» поверх холста.
import { ReactNode, useEffect, useRef, useState } from 'react'
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

export function IconButton({ icon, label, onClick, active, disabled, children }: {
  icon: IconName; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode
}) {
  return (
    <button className={'ibtn' + (active ? ' on' : '')} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon name={icon} />{children}
    </button>
  )
}

/** Выпадающее меню, закрывается щелчком мимо */
export function Dropdown({ trigger, children, align = 'left', up = false }: {
  trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; up?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(open, () => setOpen(o => !o))}
      {open && <div className={'menu' + (align === 'right' ? ' right' : '') + (up ? ' up' : '')} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function MenuItem({ label, hint, onClick, disabled, icon }: { label: string; hint?: string; onClick: () => void; disabled?: boolean; icon?: IconName }) {
  return (
    <button role="menuitem" disabled={disabled} onClick={onClick}>
      {icon && <Icon name={icon} size={16} />}<span className="mi-label">{label}</span>{hint && <kbd>{hint}</kbd>}
    </button>
  )
}

const SAVE: Record<string, string> = {
  saved: 'Сохранено', dirty: 'Изменено', saving: 'Сохранение…', error: 'Ошибка сохранения', conflict: 'Конфликт версий',
}

/** Слева сверху: домой, название карты, меню файла */
export function TopLeft({ fileMenu, guest }: { fileMenu: ReactNode; guest: boolean }) {
  const { title, setTitle, role, saveState } = useDoc()
  const status = useCollab(s => s.status)
  const nav = useNavigate()
  const state = status === 'offline' ? 'Нет связи' : status === 'connecting' ? 'Подключение…' : role === 'owner' ? SAVE[saveState] : 'Синхронизировано'
  return (
    <div className="island tl">
      {guest ? <Link to="/login" className="ibtn round" aria-label="Войти" title="Войти"><Icon name="home" /></Link>
        : <button className="ibtn round" onClick={() => nav('/')} aria-label="Мои карты" title="Мои карты"><Icon name="home" /></button>}
      <div className="title-block">
        <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Название карты"
          readOnly={role !== 'owner'} size={Math.max(6, Math.min(40, title.length + 1))} />
        <span className="save-state" data-testid="save-state">{state}
          {role === 'view' && ' · только просмотр'}{role === 'edit' && ' · редактирование по ссылке'}</span>
      </div>
      {fileMenu}
    </div>
  )
}

/** Сверху по центру: инструменты вставки */
export function TopCenter() {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const cu = useCollab()
  const { past, future } = useEditor()
  const none = !selection.length
  const canUndo = collab() ? cu.canUndo : past.length > 0
  const canRedo = collab() ? cu.canRedo : future.length > 0
  const id = selection[selection.length - 1]
  const sheet = ed.sheet()
  const toggleTask = () => {
    const t = sheet && id ? indexSheet(sheet).get(id)?.topic : undefined
    ed.setTopic(selection, { task: t?.task ? undefined : { done: false } })
  }
  return (
    <div className="island tc toolbar" role="toolbar" aria-label="Инструменты">
      <IconButton icon="undo" label="Отменить (Ctrl+Z)" onClick={ed.undo} disabled={!canUndo} />
      <IconButton icon="redo" label="Повторить (Ctrl+Shift+Z)" onClick={ed.redo} disabled={!canRedo} />
      <span className="sep" />
      <IconButton icon="topic" label="Тема (Enter)" onClick={() => ed.addSibling(false)} disabled={none} />
      <IconButton icon="subtopic" label="Подтема (Tab)" onClick={ed.addChild} disabled={none} />
      <IconButton icon="floating" label="Плавающая тема" onClick={() => { const v = ed.view; ed.addFloating((240 - v.x) / v.zoom, (160 - v.y) / v.zoom) }} />
      <span className="sep" />
      <IconButton icon="relationship" label="Связь (Ctrl+L)" onClick={ed.startRelating} disabled={none} />
      <IconButton icon="summary" label="Сводка (Ctrl+])" onClick={ed.addSummary} disabled={none} />
      <IconButton icon="boundary" label="Граница (Ctrl+B)" onClick={ed.addBoundary} disabled={none} />
      <span className="sep" />
      <IconButton icon="note" label="Заметка (Ctrl+Shift+N)" onClick={() => ed.setPanel('notes')} disabled={none} />
      <IconButton icon="label" label="Метки" onClick={() => id && ed.setDialog({ kind: 'labels', id })} disabled={none} />
      <IconButton icon="task" label="Задача" onClick={toggleTask} disabled={none} />
      <InsertMenu />
    </div>
  )
}

/** Справа сверху: участники, поделиться, панели, прочее */
export function TopRight({ onShare, more }: { onShare?: () => void; more: ReactNode }) {
  const { panel } = useEditor()
  const ed = useEditor.getState()
  const toggle = (p: typeof panel) => ed.setPanel(panel === p ? null : p)
  return (
    <div className="tr-wrap">
      <Presence />
      {onShare && <div className="island"><IconButton icon="share" label="Поделиться" onClick={onShare} /></div>}
      <div className="island">
        <IconButton icon="marker" label="Маркеры и стикеры" onClick={() => toggle('markers')} active={panel === 'markers'} />
        <IconButton icon="comment" label="Комментарии" onClick={() => toggle('comments')} active={panel === 'comments'} />
        <IconButton icon="panel" label="Формат" onClick={() => toggle('format')} active={panel === 'format'} />
        {more}
      </div>
    </div>
  )
}

/** Меню «Ещё»: поиск, фильтр, ветка, история, клавиши, аккаунт */
export function MoreMenu({ isOwner, onHelp }: { isOwner: boolean; onHelp: () => void }) {
  const ed = useEditor.getState()
  const user = useAuth(s => s.user)
  const logout = useAuth(s => s.logout)
  const nav = useNavigate()
  return (
    <Dropdown align="right" trigger={(open, toggle) => <IconButton icon="more" label="Ещё" onClick={toggle} active={open} />}>
      {close => <>
        <MenuItem icon="search" label="Поиск и замена" hint="Ctrl+F" onClick={() => { close(); ed.setSearch({ open: true }) }} />
        <MenuItem icon="filter" label="Фильтр по маркерам и меткам" onClick={() => { close(); ed.setPanel('filter') }} />
        <MenuItem icon="branch" label="Показать только ветку" hint="F6" onClick={() => { close(); ed.drillDown() }} />
        <MenuItem icon="collapse" label="Свернуть / развернуть" hint="Ctrl+/" onClick={() => { close(); ed.toggleCollapse() }} />
        <MenuItem icon="trash" label="Удалить выбранное" hint="Delete" onClick={() => { close(); ed.removeSelected() }} />
        {isOwner && <MenuItem icon="history" label="История версий" onClick={() => { close(); ed.setPanel('versions') }} />}
        <MenuItem icon="keyboard" label="Сочетания клавиш" onClick={() => { close(); onHelp() }} />
        <div className="menu-sep" />
        {user ? <>
          <div className="menu-hint">{user.email}</div>
          <MenuItem icon="folder" label="Мои карты" onClick={() => nav('/')} />
          <MenuItem icon="settings" label="Аккаунт" onClick={() => nav('/account')} />
          <MenuItem icon="close" label="Выйти" onClick={() => { close(); logout().then(() => nav('/login')) }} />
        </> : <MenuItem icon="home" label="Войти" onClick={() => nav('/login')} />}
      </>}
    </Dropdown>
  )
}

/** Справа снизу: счётчик тем, масштаб, режимы */
export function BottomRight({ sheet }: { sheet: Sheet }) {
  const { view, selection, viewMode } = useEditor()
  const ed = useEditor.getState()
  const total = indexSheet(sheet).size
  return (
    <div className="island br">
      <span className="status-text" data-testid="topic-count">Темы: {selection.length ? `${selection.length} / ` : ''}{total}</span>
      <span className="sep" />
      {viewMode === 'map' && (
        <Dropdown align="right" up trigger={(open, toggle) => (
          <button className={'ibtn zoom-btn' + (open ? ' on' : '')} onClick={toggle} aria-label="Масштаб">{Math.round(view.zoom * 100)}%<Icon name="chevron" size={14} /></button>
        )}>
          {close => <>
            <MenuItem label="Увеличить" hint="Ctrl+=" onClick={() => canvasApi.zoomBy(1.2)} />
            <MenuItem label="Уменьшить" hint="Ctrl+-" onClick={() => canvasApi.zoomBy(1 / 1.2)} />
            <div className="menu-sep" />
            {[50, 75, 100, 150, 200].map(z => <MenuItem key={z} label={`${z}%`} onClick={() => { close(); canvasApi.zoomTo(z / 100) }} />)}
            <div className="menu-sep" />
            <MenuItem label="Вписать в экран" hint="Ctrl+0" onClick={() => { close(); canvasApi.fit() }} />
          </>}
        </Dropdown>
      )}
      <span className="sep" />
      <IconButton icon={viewMode === 'map' ? 'outline' : 'map'} label={viewMode === 'map' ? 'Структура' : 'Карта'}
        onClick={() => ed.setViewMode(viewMode === 'map' ? 'outline' : 'map')} />
      <IconButton icon="zen" label="ZEN" onClick={() => ed.setZen(true)} />
      <IconButton icon="present" label="Презентация" onClick={() => ed.setPresenting(true)} />
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
  list.unshift({ id: null, title: 'Вся карта' })
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

