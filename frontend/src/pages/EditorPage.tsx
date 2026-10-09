import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull } from '../api/types'
import { hasPendingChanges, SaveState, useDoc } from '../store/doc'
import SimpleCanvas from '../editor/SimpleCanvas'
import VersionsPanel from '../editor/VersionsPanel'
import TopBar from './TopBar'

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Сохранено', dirty: 'Есть изменения…', saving: 'Сохранение…',
  error: 'Ошибка сохранения, повтор…', conflict: 'Конфликт: карта изменена в другом окне — перезагрузите',
}

export default function EditorPage() {
  const { id } = useParams()
  const { doc, title, saveState, saveError, open, close, setDoc, setTitle, flush } = useDoc()
  const [error, setError] = useState('')
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    api<MapFull>(`/api/maps/${id}`).then(open).catch(e => setError(e.message))
    const onUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) { flush(); e.preventDefault() }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => { window.removeEventListener('beforeunload', onUnload); flush().then(close) }
  }, [id])

  if (error) return <><TopBar /><p className="page error">{error}</p></>
  if (!doc) return <><TopBar /><p className="page muted">Загрузка…</p></>

  return (
    <div className="editor">
      <TopBar>
        <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Название карты" />
        <span className="save-state" title={saveError}>{SAVE_LABEL[saveState]}</span>
        <button onClick={() => setShowVersions(v => !v)}>История</button>
      </TopBar>
      <div className="editor-body">
        <div className="canvas"><SimpleCanvas doc={doc} onChange={setDoc} /></div>
        {showVersions && id && <VersionsPanel mapId={id} onClose={() => setShowVersions(false)} />}
      </div>
    </div>
  )
}
