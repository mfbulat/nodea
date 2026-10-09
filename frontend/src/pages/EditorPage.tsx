import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull } from '../api/types'
import { hasPendingChanges, SaveState, useDoc } from '../store/doc'
import MapCanvas, { isTyping } from '../editor/MapCanvas'
import Toolbar from '../editor/Toolbar'
import FormatPanel from '../editor/FormatPanel'
import VersionsPanel from '../editor/VersionsPanel'
import { useEditor } from '../editor/store'
import { useEditorKeys } from '../editor/useEditorKeys'
import type { MapDocument } from '../editor/model'
import { indexSheet } from '../editor/model'
import Dialogs from '../editor/Dialogs'
import { CommentsPanel, MarkersPanel, NotesPanel, SheetTabs } from '../editor/SidePanels'
import Outliner from '../editor/Outliner'
import SearchBar from '../editor/SearchBar'
import FilterPanel from '../editor/FilterPanel'
import Presentation from '../editor/Presentation'
import { useAuth } from '../store/auth'
import TopBar from './TopBar'
import FileMenu from '../editor/FileMenu'
import { collab, startCollab, stopCollab, useCollab } from '../collab/session'
import ShareDialog, { Presence } from '../collab/ShareDialog'

function GuestBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="topbar">
      <span className="brand">MindMap</span>
      {children}
      <div className="spacer" />
      <Link to="/login">Войти</Link>
    </div>
  )
}

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Сохранено', dirty: 'Есть изменения…', saving: 'Сохранение…',
  error: 'Ошибка сохранения, повтор…', conflict: 'Конфликт: карта изменена в другом окне — перезагрузите',
}

/** Глобальные клавиши режимов (работают и в «Структуре») */
function useModeKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const ed = useEditor.getState()
      if (ed.presenting) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && !e.shiftKey && !e.altKey && (e.code === 'KeyF' || k === 'f' || k === 'а')) {
        e.preventDefault(); ed.setSearch({ open: true })
      } else if (mod && e.shiftKey && (e.code === 'KeyF' || k === 'f' || k === 'а')) {
        e.preventDefault(); ed.setZen(!ed.zen)
      } else if (mod && e.altKey && (e.code === 'KeyO' || k === 'o' || k === 'щ')) {
        e.preventDefault(); ed.setViewMode(ed.viewMode === 'map' ? 'outline' : 'map')
      } else if (mod && e.altKey && (e.code === 'KeyP' || k === 'p' || k === 'з')) {
        e.preventDefault(); ed.setPresenting(true)
      } else if (e.key === 'F6' && !isTyping(e)) {
        e.preventDefault(); if (e.shiftKey) ed.drillUp(); else ed.drillDown()
      } else if (e.key === 'Escape' && ed.zen && !isTyping(e) && !ed.editingId) {
        ed.setZen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

interface Shared { map: MapFull; role: 'owner' | 'edit' | 'view' }

/** /map/:id — карта владельца; /s/:token — карта по ссылке (вход не обязателен) */
export default function EditorPage({ shared = false }: { shared?: boolean }) {
  const params = useParams()
  const share = shared ? params.token! : null
  const [mapId, setMapId] = useState<string | null>(shared ? null : params.id!)
  const id = mapId ?? undefined
  const { doc, title, saveState, saveError, open, close, setTitle, flush, role } = useDoc()
  const collabState = useCollab()
  const [shareOpen, setShareOpen] = useState(false)
  const user = useAuth(s => s.user)
  const sheetId = useEditor(s => s.sheetId)
  const panel = useEditor(s => s.panel)
  const setPanel = useEditor(s => s.setPanel)
  const { viewMode, zen, presenting, drillId, filter } = useEditor()
  const email = useAuth(s => s.user?.email ?? '')
  const [error, setError] = useState('')
  const readOnly = role === 'view'
  useEditorKeys(!!doc && viewMode === 'map' && !presenting && !readOnly)
  useModeKeys(!!doc)
  useEffect(() => { useEditor.setState({ userName: email }) }, [email])

  useEffect(() => {
    const load = share
      ? api<Shared>(`/api/shared/${share}`).then(r => ({ m: r.map, role: r.role }))
      : api<MapFull>(`/api/maps/${params.id}`).then(m => ({ m, role: 'owner' as const }))
    load.then(({ m, role }) => {
      open(m, role)
      setMapId(m.id)
      useEditor.getState().reset()
      // совместная работа: документ синхронизирует комната на сервере
      startCollab(m.id, share, useAuth.getState().user?.email ?? '', d => {
        const first = !useCollab.getState().synced
        useDoc.getState().setRemoteDoc(d)
        if (first) useEditor.getState().reset()
      })
    }).catch(e => setError(e.message))
    const onUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) { flush(); e.preventDefault() }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      stopCollab()
      flush().then(close)
      useEditor.setState({ zen: false, presenting: false, viewMode: 'map' })
    }
  }, [params.id, share])

  // присутствие: лист и выделение видны остальным участникам
  const selection = useEditor(s => s.selection)
  useEffect(() => { collab()?.setPresence({ sheetId: sheetId ?? undefined, selection }) }, [sheetId, selection, collabState.synced])

  const Bar = user ? TopBar : GuestBar
  if (error) return <><Bar /><p className="page error">{error}</p></>
  if (!doc || !collabState.synced && collabState.status !== 'offline') return <><Bar /><p className="page muted">
    {collabState.status === 'connecting' ? 'Подключение к карте…' : 'Загрузка…'}</p></>
  const d = doc as unknown as MapDocument
  const sheet = d.sheets.find(s => s.id === sheetId) ?? d.sheets[0]
  const ed = useEditor.getState()

  if (presenting) return <Presentation sheet={sheet} />

  // цепочка «только ветка»: Вся карта › … › текущая
  const crumbs: { id: string | null; title: string }[] = []
  if (drillId) {
    const idx = indexSheet(sheet)
    let cur = idx.get(drillId)
    while (cur && cur.topic.id !== sheet.rootTopic.id) { crumbs.unshift({ id: cur.topic.id, title: cur.topic.title }); cur = cur.parent ? idx.get(cur.parent.id) : undefined }
    crumbs.unshift({ id: null, title: 'Вся карта' })
  }

  return (
    <div className={'editor' + (zen ? ' zen' : '')}>
      {!zen && <Bar>
        <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Название карты" readOnly={role !== 'owner'} />
        <span className="save-state" title={saveError} data-testid="save-state">
          {collabState.status === 'online' ? (role === 'owner' ? SAVE_LABEL[saveState] : 'Синхронизировано')
            : collabState.status === 'offline' ? 'Нет связи — изменения отправятся при подключении' : 'Подключение…'}
        </span>
        {role === 'view' && <span className="badge">Только просмотр</span>}
        {role === 'edit' && <span className="badge">Редактирование по ссылке</span>}
        <Presence />
        {user && <FileMenu />}
        {role === 'owner' && <button onClick={() => setShareOpen(true)}>Поделиться</button>}
        {role === 'owner' && <button onClick={() => setPanel(panel === 'versions' ? null : 'versions')}>История</button>}
      </Bar>}
      {!zen && (
        <div className="modebar">
          <div className="seg">
            <button className={viewMode === 'map' ? 'on' : ''} onClick={() => ed.setViewMode('map')}>Карта</button>
            <button className={viewMode === 'outline' ? 'on' : ''} onClick={() => ed.setViewMode('outline')} title="Ctrl+Alt+O">Структура</button>
          </div>
          <button onClick={() => ed.setSearch({ open: true })} title="Ctrl+F">Поиск</button>
          <button className={panel === 'filter' || filter ? 'on' : ''} onClick={() => setPanel(panel === 'filter' ? null : 'filter')}>Фильтр{filter ? ' ●' : ''}</button>
          <button onClick={() => ed.drillDown()} title="F6 — показать только выбранную ветку">Только ветка</button>
          <button onClick={() => ed.setZen(true)} title="Ctrl+Shift+F">ZEN</button>
          <button onClick={() => ed.setPresenting(true)} title="Ctrl+Alt+P">Презентация</button>
          {crumbs.length > 0 && (
            <div className="crumbs">
              {crumbs.map((c, i) => (
                <span key={i}>{i > 0 && ' › '}
                  {i < crumbs.length - 1 ? <button className="link-btn" onClick={() => c.id ? ed.drillDown(c.id) : useEditor.setState({ drillId: null })}>{c.title}</button>
                    : <b>{c.title}</b>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {!zen && viewMode === 'map' && !readOnly && <Toolbar />}
      <div className="editor-body">
        <div className="canvas">
          {viewMode === 'map' ? <MapCanvas sheet={sheet} readOnly={readOnly} /> : <Outliner sheet={sheet} readOnly={readOnly} />}
          <SearchBar />
          {zen && <button className="zen-exit" onClick={() => ed.setZen(false)} title="Esc">Выйти из ZEN</button>}
        </div>
        {!zen && panel === 'format' && viewMode === 'map' && !readOnly && <FormatPanel sheet={sheet} />}
        {!zen && panel === 'markers' && <MarkersPanel sheet={sheet} />}
        {!zen && panel === 'notes' && <NotesPanel sheet={sheet} />}
        {!zen && panel === 'comments' && <CommentsPanel sheet={sheet} />}
        {!zen && panel === 'filter' && <FilterPanel sheet={sheet} />}
        {!zen && panel === 'versions' && id && <VersionsPanel mapId={id} onClose={() => setPanel(null)}
          onRestored={() => useEditor.getState().reset()} />}
      </div>
      {!zen && <SheetTabs />}
      <Dialogs />
      {shareOpen && id && <ShareDialog mapId={id} onClose={() => setShareOpen(false)} />}
    </div>
  )
}
