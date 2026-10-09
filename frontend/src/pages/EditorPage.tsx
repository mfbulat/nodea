import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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

export default function EditorPage() {
  const { id } = useParams()
  const { doc, title, saveState, saveError, open, close, setTitle, flush } = useDoc()
  const sheetId = useEditor(s => s.sheetId)
  const panel = useEditor(s => s.panel)
  const setPanel = useEditor(s => s.setPanel)
  const { viewMode, zen, presenting, drillId, filter } = useEditor()
  const email = useAuth(s => s.user?.email ?? '')
  const [error, setError] = useState('')
  useEditorKeys(!!doc && viewMode === 'map' && !presenting)
  useModeKeys(!!doc)
  useEffect(() => { useEditor.setState({ userName: email }) }, [email])

  useEffect(() => {
    api<MapFull>(`/api/maps/${id}`).then(m => { open(m); useEditor.getState().reset() }).catch(e => setError(e.message))
    const onUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) { flush(); e.preventDefault() }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => { window.removeEventListener('beforeunload', onUnload); flush().then(close); useEditor.setState({ zen: false, presenting: false, viewMode: 'map' }) }
  }, [id])

  if (error) return <><TopBar /><p className="page error">{error}</p></>
  if (!doc) return <><TopBar /><p className="page muted">Загрузка…</p></>
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
      {!zen && <TopBar>
        <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Название карты" />
        <span className="save-state" title={saveError}>{SAVE_LABEL[saveState]}</span>
        <FileMenu />
        <button onClick={() => setPanel(panel === 'versions' ? null : 'versions')}>История</button>
      </TopBar>}
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
      {!zen && viewMode === 'map' && <Toolbar />}
      <div className="editor-body">
        <div className="canvas">
          {viewMode === 'map' ? <MapCanvas sheet={sheet} /> : <Outliner sheet={sheet} />}
          <SearchBar />
          {zen && <button className="zen-exit" onClick={() => ed.setZen(false)} title="Esc">Выйти из ZEN</button>}
        </div>
        {!zen && panel === 'format' && viewMode === 'map' && <FormatPanel sheet={sheet} />}
        {!zen && panel === 'markers' && <MarkersPanel sheet={sheet} />}
        {!zen && panel === 'notes' && <NotesPanel sheet={sheet} />}
        {!zen && panel === 'comments' && <CommentsPanel sheet={sheet} />}
        {!zen && panel === 'filter' && <FilterPanel sheet={sheet} />}
        {!zen && panel === 'versions' && id && <VersionsPanel mapId={id} onClose={() => setPanel(null)}
          onRestored={() => useEditor.getState().reset()} />}
      </div>
      {!zen && <SheetTabs />}
      <Dialogs />
    </div>
  )
}
