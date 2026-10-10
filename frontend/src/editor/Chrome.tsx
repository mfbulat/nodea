// Интерфейс редактора (как веб-версия): верхняя полоса на сером фоне, белый холст-карточка,
// правая панель-карточка, нижняя строка с листами и масштабом.
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
  return (
    <Tip title={label} keys={keys} desc={desc}>
      <button className={'ibtn' + (active ? ' on' : '')} onClick={onClick} disabled={disabled} aria-label={label}>
        <Icon name={icon} />{children}
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
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(open, () => setOpen(o => !o))}
      {open && <div className={'menu' + (align === 'right' ? ' right' : '') + (up ? ' up' : '')} role="menu">{children(() => setOpen(false))}</div>}
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

/** Пункт с вложенным меню (раскрывается при наведении) */
export function SubMenu({ label, icon, children }: { label: string; icon?: IconName; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="submenu" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button role="menuitem" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {icon && <Icon name={icon} size={16} />}<span className="mi-label">{label}</span><Icon name="chevronRight" size={14} />
      </button>
      {open && <div className="menu sub" role="menu">{children}</div>}
    </div>
  )
}

const SAVE: Record<string, string> = {
  saved: 'Сохранено', dirty: 'Изменено', saving: 'Сохранение…', error: 'Ошибка сохранения', conflict: 'Конфликт версий',
}

/** Слева: меню, название, избранное, путь */
/** Адаптивная верхняя панель как в веб-версии: по ширине окна (открытая боковая панель отнимает ~300px)
 * прячутся «Сводка/Граница», затем «Связь», подпись под названием, «Гант», затем «Презентация/Комментарии». */
export function useBarFit() {
  const [w, setW] = useState(window.innerWidth)
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  const panel = useEditor(s => s.panel)
  const free = w - (panel ? 300 : 0)
  return { summary: free >= 1000, relation: free >= 930, subtitle: w - (panel ? 200 : 0) >= 900, gantt: free >= 900, present: free >= 800 }
}

export function TopLeft({ mainMenu, guest, mapId }: { mainMenu: ReactNode; guest: boolean; mapId?: string }) {
  const { title, setTitle, role, saveState } = useDoc()
  const status = useCollab(s => s.status)
  const [starred, setStarred] = useState(false)
  useEffect(() => {
    if (role === 'owner' && mapId) api<{ starred?: boolean }>(`/api/maps/${mapId}`).then(m => setStarred(!!m.starred)).catch(() => {})
  }, [mapId, role])
  const toggleStar = () => {
    if (!mapId) return
    setStarred(s => !s)
    api(`/api/maps/${mapId}`, { method: 'PATCH', json: { starred: !starred } }).catch(() => setStarred(s => !s))
  }
  const fit = useBarFit()
  const state = status === 'offline' ? 'Нет связи — изменения синхронизируются при подключении' : status === 'connecting' ? 'Подключение…'
    : role === 'owner' ? SAVE[saveState] : role === 'view' ? 'Только просмотр' : 'Редактирование по ссылке'
  return (
    <div className="bar-left">
      {mainMenu}
      <div className="title-block">
        <div className="title-row">
          <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Название карты"
            readOnly={role !== 'owner'} size={Math.max(4, Math.min(40, title.length + 1))} />
          {role === 'owner' && <Tip title={starred ? 'Убрать из избранного' : 'Добавить в избранное'}>
            <button className={'star-btn' + (starred ? ' on' : '')} onClick={toggleStar} aria-label="Избранное"><Icon name="star" size={16} /></button>
          </Tip>}
        </div>
        <span className="crumb" data-testid="save-state" title={state} hidden={!fit.subtitle}>
          {guest ? <Link to="/login">Войти</Link> : <Link to="/">Мои карты</Link>}<span className="dot">·</span>{state}
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
    <div className="bar-center toolbar" role="toolbar" aria-label="Инструменты">
      <IconButton icon="topic" label="Тема" keys="⏎" desc="Добавить тему после выбранной." onClick={() => ed.addSibling(false)} disabled={none} />
      <IconButton icon="subtopic" label="Подтема" keys="⇥" desc="Добавить дочернюю тему к выбранной." onClick={ed.addChild} disabled={none} />
      <span className="sep" />
      {fit.relation && <IconButton icon="relationship" label="Связь" keys="⌘ ⇧ R" desc="Создать связь между двумя темами." onClick={ed.startRelating} disabled={none} />}
      {fit.summary && <IconButton icon="summary" label="Сводка" desc="Добавить сводку к выбранным темам." onClick={ed.addSummary} disabled={none} />}
      {fit.summary && <IconButton icon="boundary" label="Граница" keys="⌘ ⇧ B" desc="Объединить выбранные темы границей." onClick={ed.addBoundary} disabled={none} />}
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
    <div className="bar-center toolbar" role="toolbar" aria-label="Инструменты">
      <IconButton icon="outdent" label="Уровень вверх" keys="⇧ ⇥" onClick={ed.outdent} disabled={none} />
      <IconButton icon="indent" label="Уровень вниз" keys="⇥" onClick={ed.indent} disabled={none} />
      <span className="sep" />
      <InsertMenu />
    </div>
  )
}

/** Справа: участники, «Поделиться», Гант, презентация, комментарии, маркеры, формат */
export function TopRight({ onShare, isOwner, outline }: { onShare?: () => void; isOwner: boolean; outline: boolean }) {
  const { panel, gantt } = useEditor()
  const ed = useEditor.getState()
  const toggle = (p: typeof panel) => ed.setPanel(panel === p ? null : p)
  const fit = useBarFit()
  return (
    <div className="bar-right">
      <Presence />
      {onShare && <button className="share-btn" onClick={onShare}>Поделиться</button>}
      <div className="bar-icons">
        {!outline && fit.gantt && <IconButton icon="gantt" label="Гант" desc="Открыть диаграмму Ганта в отдельном окне." onClick={() => ed.setGantt(!gantt)} active={gantt} />}
        {fit.present && <IconButton icon="present" label="Презентация" keys="⌥ ⌘ P" desc="Перейти в режим презентации." onClick={() => ed.setPresenting(true)} />}
        {!outline && fit.present && <IconButton icon="comment" label="Комментарии" desc="Открыть панель комментариев." onClick={() => toggle('comments')} active={panel === 'comments'} />}
        {isOwner !== undefined && <IconButton icon="marker" label="Маркер" desc="Добавить маркер к выбранным темам." onClick={() => toggle('markers')} active={panel === 'markers'} />}
        {!outline && <IconButton icon="panel" label="Формат" keys="⌘ ]" desc="Показать или скрыть параметры стиля и формата." onClick={() => toggle('format')} active={panel === 'format'} />}
      </div>
    </div>
  )
}

/** Главное меню «☰» */
export function MainMenu({ isOwner, onHelp, onShare, onExport, onImport, onSaveTemplate }: {
  isOwner: boolean; onHelp: () => void; onShare?: () => void
  onExport: (fmt: string) => void; onImport: () => void; onSaveTemplate: () => void
}) {
  const ed = useEditor.getState()
  const nav = useNavigate()
  const user = useAuth(s => s.user)
  const { viewMode, zen, drillId } = useEditor()
  const cu = useCollab()
  const { past, future } = useEditor()
  const canUndo = collab() ? cu.canUndo : past.length > 0
  const canRedo = collab() ? cu.canRedo : future.length > 0
  return (
    <Dropdown trigger={(open, toggle) => (
      <Tip title="Меню"><button className={'ibtn' + (open ? ' on' : '')} onClick={toggle} aria-label="Меню"><Icon name="hamburger" /></button></Tip>
    )}>
      {close => <>
        {user && <MenuItem icon="chevronRight" label="Назад к файлам" onClick={() => { close(); nav('/') }} />}
        <div className="menu-sep" />
        <SubMenu label="Файл">
          {user && <MenuItem label="Новая карта" onClick={async () => { close(); const m = await api<{ id: string }>('/api/maps', { method: 'POST', json: { title: 'Новая карта' } }); nav(`/map/${m.id}`) }} />}
          {isOwner && <MenuItem label="Новый лист" hint="⌥ ⌘ N" onClick={() => { close(); ed.addSheet() }} />}
          {isOwner && <MenuItem label="Переименовать" onClick={() => { close(); (document.querySelector('.title-input') as HTMLInputElement)?.select() }} />}
          {isOwner && <MenuItem label="История версий" onClick={() => { close(); ed.setPanel('versions') }} />}
          {user && <MenuItem label="Импорт файла" onClick={() => { close(); onImport() }} />}
          <MenuItem label="Скачать (.xmind)" onClick={() => { close(); onExport('xmind') }} />
          {user && <MenuItem label="Сохранить как шаблон" onClick={() => { close(); onSaveTemplate() }} />}
        </SubMenu>
        <SubMenu label="Правка">
          <MenuItem label="Отменить" hint="⌘ Z" disabled={!canUndo} onClick={() => { close(); ed.undo() }} />
          <MenuItem label="Повторить" hint="⇧ ⌘ Z" disabled={!canRedo} onClick={() => { close(); ed.redo() }} />
          <div className="menu-sep" />
          <MenuItem label="Дублировать" hint="⌘ D" onClick={() => { close(); ed.duplicate() }} />
          <MenuItem label="Удалить только тему" hint="⌘ ⌫" onClick={() => { close(); ed.deleteSingle() }} />
          <MenuItem label="Свернуть все подветки" hint="⌥ ⌘ /" onClick={() => { close(); ed.foldAll() }} />
          <MenuItem label="Перейти к центральной теме" hint="⌘ R" onClick={() => { close(); ed.goCentral() }} />
          <SubMenu label="Выделить">
            <MenuItem label="Все подтемы" onClick={() => { close(); ed.selectBy('subtopics') }} />
            <MenuItem label="Все соседние темы" onClick={() => { close(); ed.selectBy('siblings') }} />
            <MenuItem label="Все темы этого уровня" onClick={() => { close(); ed.selectBy('level') }} />
            <MenuItem label="Все плавающие темы" onClick={() => { close(); ed.selectBy('floating') }} />
            <MenuItem label="Всё" hint="⌘ A" onClick={() => { close(); ed.selectAll() }} />
          </SubMenu>
          <div className="menu-sep" />
          <MenuItem label="Поиск" hint="⌘ F" onClick={() => { close(); ed.setSearch({ open: true }) }} />
        </SubMenu>
        <SubMenu label="Вид">
          <MenuItem label={(viewMode === 'map' ? '✓ ' : '   ') + 'Интеллект-карта'} onClick={() => { close(); ed.setViewMode('map') }} />
          <MenuItem label={(viewMode === 'outline' ? '✓ ' : '   ') + 'Структура'} onClick={() => { close(); ed.setViewMode('outline') }} />
          <div className="menu-sep" />
          <MenuItem label="Увеличить" hint="⌘ +" onClick={() => canvasApi.zoomBy(1.2)} />
          <MenuItem label="Уменьшить" hint="⌘ −" onClick={() => canvasApi.zoomBy(1 / 1.2)} />
          <MenuItem label="Реальный размер" hint="⌘ 0" onClick={() => { close(); canvasApi.zoomTo(1) }} />
          <MenuItem label="Вписать карту" onClick={() => { close(); canvasApi.fit() }} />
          <div className="menu-sep" />
          <MenuItem label={drillId ? 'Показать всю карту' : 'Показать только ветку'} hint="⌘ ;" onClick={() => { close(); drillId ? ed.drillUp() : ed.drillDown() }} />
          <MenuItem label={(zen ? '✓ ' : '') + 'ZEN-режим'} hint="⌥ ⌘ F" onClick={() => { close(); ed.setZen(!zen) }} />
          <MenuItem label="Диаграмма Ганта" hint="⌥ ⌘ G" onClick={() => { close(); ed.setGantt(true) }} />
          <MenuItem label="Презентация" hint="⌥ ⌘ P" onClick={() => { close(); ed.setPresenting(true) }} />
          <MenuItem label="Фильтр по маркерам и меткам" onClick={() => { close(); ed.setPanel('filter') }} />
        </SubMenu>
        <div className="menu-sep" />
        {onShare && <MenuItem label="Поделиться" onClick={() => { close(); onShare() }} />}
        <SubMenu label="Экспортировать как">
          {[['png', 'PNG'], ['svg', 'SVG'], ['pdf', 'PDF'], ['md', 'Markdown'], ['docx', 'Word'], ['xlsx', 'Excel'], ['pptx', 'PowerPoint'],
            ['opml', 'OPML'], ['mm', 'FreeMind'], ['xmind', 'XMind']].map(([f, l]) => <MenuItem key={f} label={l} onClick={() => { close(); onExport(f) }} />)}
        </SubMenu>
        <MenuItem label="Сочетания клавиш" onClick={() => { close(); onHelp() }} />
        <MenuItem label="Печать" hint="⌘ P" onClick={() => { close(); setTimeout(() => window.print(), 50) }} />
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
          <button className={'zoom-btn' + (open ? ' on' : '')} onClick={toggle} aria-label="Масштаб">{Math.round(view.zoom * 100)}%<Icon name="chevron" size={14} /></button>
        )}>
          {close => <>
            {[50, 80, 100, 120, 150, 200, 300, 400, 500].map(z => <MenuItem key={z} label={`${z}%`} onClick={() => { close(); canvasApi.zoomTo(z / 100) }} />)}
            <div className="menu-sep" />
            <MenuItem label="Вписать карту" onClick={() => { close(); canvasApi.fit() }} />
          </>}
        </Dropdown>
      )}
      <button className="mode-btn" onClick={() => ed.setViewMode(viewMode === 'map' ? 'outline' : 'map')}>
        {viewMode === 'map' ? 'Структура' : 'Интеллект-карта'}</button>
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
