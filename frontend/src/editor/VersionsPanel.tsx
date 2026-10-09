import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { MapFull, VersionSummary } from '../api/types'
import { useDoc } from '../store/doc'

export default function VersionsPanel({ mapId, onClose, onRestored }: { mapId: string; onClose: () => void; onRestored?: () => void }) {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [error, setError] = useState('')
  const { open, flush } = useDoc()

  const reload = () => api<VersionSummary[]>(`/api/maps/${mapId}/versions`).then(setVersions).catch(e => setError(e.message))
  useEffect(() => { reload() }, [mapId])

  async function saveNow() {
    await flush()
    await api(`/api/maps/${mapId}/versions`, { method: 'POST' })
    reload()
  }
  async function restore(v: VersionSummary) {
    if (!confirm(`Восстановить версию от ${new Date(v.created_at).toLocaleString('ru')}? Текущее состояние сохранится в истории.`)) return
    await flush()
    open(await api<MapFull>(`/api/maps/${mapId}/versions/${v.id}/restore`, { method: 'POST' }))
    onRestored?.()
    reload()
  }

  return (
    <div className="side-panel">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>История версий</h3><div className="spacer" />
        <button onClick={onClose}>×</button>
      </div>
      <button onClick={saveNow} style={{ width: '100%', marginBottom: 8 }}>Сохранить версию сейчас</button>
      <p className="muted" style={{ fontSize: 12 }}>Снимок создаётся автоматически не чаще раза в 5 минут при изменениях.</p>
      {error && <p className="error">{error}</p>}
      {versions.map(v => (
        <div className="version-row" key={v.id}>
          <div style={{ flex: 1 }}>
            <div>{new Date(v.created_at).toLocaleString('ru')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{v.title}</div>
          </div>
          <button onClick={() => restore(v)}>Восстановить</button>
        </div>
      ))}
    </div>
  )
}
