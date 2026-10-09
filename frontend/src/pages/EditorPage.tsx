import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull } from '../api/types'
import { hasPendingChanges, SaveState, useDoc } from '../store/doc'
import MapCanvas from '../editor/MapCanvas'
import Toolbar from '../editor/Toolbar'
import FormatPanel from '../editor/FormatPanel'
import VersionsPanel from '../editor/VersionsPanel'
import { useEditor } from '../editor/store'
import { useEditorKeys } from '../editor/useEditorKeys'
import Dialogs from '../editor/Dialogs'
import { CommentsPanel, MarkersPanel, NotesPanel, SheetTabs } from '../editor/SidePanels'
import { useAuth } from '../store/auth'
import type { MapDocument } from '../editor/model'
import TopBar from './TopBar'

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Сохранено', dirty: 'Есть изменения…', saving: 'Сохранение…',
  error: 'Ошибка сохранения, повтор…', conflict: 'Конфликт: карта изменена в другом окне — перезагрузите',
}

export default function EditorPage() {
  const { id } = useParams()
  const { doc, title, saveState, saveError, open, close, setTitle, flush } = useDoc()
  const sheetId = useEditor(s => s.sheetId)
  const panel = useEditor(s => s.panel)
  const setPanel = useEditor(s => s.setPanel)
  const email = useAuth(s => s.user?.email ?? '')
  const [error, setError] = useState('')
  useEditorKeys(!!doc)
  useEffect(() => { useEditor.setState({ userName: email }) }, [email])

  useEffect(() => {
    api<MapFull>(`/api/maps/${id}`).then(m => { open(m); useEditor.getState().reset() }).catch(e => setError(e.message))
    const onUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) { flush(); e.preventDefault() }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => { window.removeEventListener('beforeunload', onUnload); flush().then(close) }
  }, [id])

  if (error) return <><TopBar /><p className="page error">{error}</p></>
  if (!doc) return <><TopBar /><p className="page muted">Загрузка…</p></>
  const d = doc as unknown as MapDocument
  const sheet = d.sheets.find(s => s.id === sheetId) ?? d.sheets[0]

  return (
    <div className="editor">
      <TopBar>
        <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Название карты" />
        <span className="save-state" title={saveError}>{SAVE_LABEL[saveState]}</span>
        <button onClick={() => setPanel(panel === 'versions' ? null : 'versions')}>История</button>
      </TopBar>
      <Toolbar />
      <div className="editor-body">
        <div className="canvas"><MapCanvas sheet={sheet} /></div>
        {panel === 'format' && <FormatPanel sheet={sheet} />}
        {panel === 'markers' && <MarkersPanel sheet={sheet} />}
        {panel === 'notes' && <NotesPanel sheet={sheet} />}
        {panel === 'comments' && <CommentsPanel sheet={sheet} />}
        {panel === 'versions' && id && <VersionsPanel mapId={id} onClose={() => setPanel(null)}
          onRestored={() => useEditor.getState().reset()} />}
      </div>
      <SheetTabs />
      <Dialogs />
    </div>
  )
}
