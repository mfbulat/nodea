import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull } from '../api/types'
import { hasPendingChanges, useDoc } from '../store/doc'
import MapCanvas, { isTyping } from '../editor/MapCanvas'
import { BottomRight, Crumbs, MoreMenu, TopCenter, TopLeft, TopRight } from '../editor/Chrome'
import HelpDialog from '../editor/HelpDialog'
import FormatPanel from '../editor/FormatPanel'
import VersionsPanel from '../editor/VersionsPanel'
import { useEditor } from '../editor/store'
import { useEditorKeys } from '../editor/useEditorKeys'
import type { MapDocument } from '../editor/model'
import Dialogs from '../editor/Dialogs'
import { CommentsPanel, Legend, MarkersPanel, NotesPanel, SheetTabs } from '../editor/SidePanels'
import Outliner from '../editor/Outliner'
import SearchBar from '../editor/SearchBar'
import FilterPanel from '../editor/FilterPanel'
import Presentation from '../editor/Presentation'
import { useAuth } from '../store/auth'
import TopBar from './TopBar'
import FileMenu from '../editor/FileMenu'
import { collab, startCollab, stopCollab, useCollab } from '../collab/session'
import ShareDialog from '../collab/ShareDialog'

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

/** Глобальные клавиши режимов (работают и в «Структуре») */
function useModeKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const ed = useEditor.getState()
      if (ed.presenting) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      const code = (c: string, ...keys: string[]) => e.code ? e.code === c : keys.includes(k)
      if (mod && !e.shiftKey && !e.altKey && code('KeyF', 'f', 'а')) { e.preventDefault(); ed.setSearch({ open: true }) }
      else if (mod && e.altKey && code('KeyF', 'f', 'а', 'ƒ')) { e.preventDefault(); ed.setZen(!ed.zen) }
      else if (mod && e.altKey && code('KeyG', 'g', 'п', '©')) { e.preventDefault(); ed.setGantt(!ed.gantt) }
      else if (mod && e.altKey && code('KeyO', 'o', 'щ')) { e.preventDefault(); ed.setViewMode(ed.viewMode === 'map' ? 'outline' : 'map') }
      else if (mod && e.altKey && code('KeyP', 'p', 'з', 'π')) { e.preventDefault(); ed.setPresenting(true) }
      else if (mod && e.shiftKey && code('KeyP', 'p', 'з')) { e.preventDefault(); ed.setMapShot(true) }
      else if (mod && !e.shiftKey && !e.altKey && code('KeyP', 'p', 'з')) { e.preventDefault(); window.print() }
      else if (mod && !e.shiftKey && code('Semicolon', ';', 'ж')) { e.preventDefault(); if (ed.drillId) ed.drillUp(); else ed.drillDown() }
      else if (mod && !e.shiftKey && !e.altKey && code('KeyS', 's', 'ы')) { e.preventDefault(); useDoc.getState().flush() }
      else if (e.key === 'F6' && !isTyping(e)) {
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
  const { doc, open, close, flush, role } = useDoc()
  const collabState = useCollab()
  const [shareOpen, setShareOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const user = useAuth(s => s.user)
  const sheetId = useEditor(s => s.sheetId)
  const panel = useEditor(s => s.panel)
  const setPanel = useEditor(s => s.setPanel)
  const { viewMode, zen, presenting } = useEditor()
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

  return (
    <div className={'editor' + (zen ? ' zen' : '') + (!zen && panel && !(panel === 'format' && (viewMode !== 'map' || readOnly)) && !(panel === 'markers' && readOnly) ? ' has-panel' : '')}>
      <div className="canvas">
        {viewMode === 'map' ? <MapCanvas sheet={sheet} readOnly={readOnly} /> : <Outliner sheet={sheet} readOnly={readOnly} />}
        <SearchBar />
      </div>
      {zen ? <button className="island zen-exit" onClick={() => ed.setZen(false)} title="Esc">Выйти из ZEN</button> : <>
        <TopLeft guest={!user} fileMenu={user ? <FileMenu /> : null} />
        {viewMode === 'map' && !readOnly && <TopCenter />}
        <TopRight onShare={role === 'owner' ? () => setShareOpen(true) : undefined}
          more={<MoreMenu isOwner={role === 'owner'} onHelp={() => setHelp(true)} />} />
        <Crumbs sheet={sheet} />
        <Legend sheet={sheet} readOnly={readOnly} />
        <SheetTabs />
        <BottomRight sheet={sheet} />
        {panel === 'format' && viewMode === 'map' && !readOnly && <FormatPanel sheet={sheet} />}
        {panel === 'markers' && !readOnly && <MarkersPanel sheet={sheet} />}
        {panel === 'notes' && <NotesPanel sheet={sheet} />}
        {panel === 'comments' && <CommentsPanel sheet={sheet} />}
        {panel === 'filter' && <FilterPanel sheet={sheet} />}
        {panel === 'versions' && id && <VersionsPanel mapId={id} onClose={() => setPanel(null)}
          onRestored={() => useEditor.getState().reset()} />}
      </>}
      <Dialogs />
      {help && <HelpDialog onClose={() => setHelp(false)} />}
      {shareOpen && id && <ShareDialog mapId={id} onClose={() => setShareOpen(false)} />}
    </div>
  )
}
