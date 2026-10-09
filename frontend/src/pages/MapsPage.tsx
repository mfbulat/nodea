import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull, MapSummary } from '../api/types'
import TopBar from './TopBar'
import { importAsNewMap } from '../editor/FileMenu'
import TemplateGallery from './TemplateGallery'
import type { MapDocument } from '../editor/model'

export default function MapsPage() {
  const [maps, setMaps] = useState<MapSummary[] | null>(null)
  const [error, setError] = useState('')
  const [gallery, setGallery] = useState(false)
  const nav = useNavigate()

  const reload = () => api<MapSummary[]>('/api/maps').then(setMaps).catch(e => setError(e.message))
  useEffect(() => { reload() }, [])

  async function guard(fn: () => Promise<unknown>) {
    try { setError(''); await fn(); await reload() } catch (e) { setError((e as Error).message) }
  }

  const create = (title: string, document: MapDocument) => guard(async () => {
    setGallery(false)
    const m = await api<MapFull>('/api/maps', { method: 'POST', json: { title, document } })
    nav(`/map/${m.id}`)
  })
  const rename = (m: MapSummary) => {
    const title = prompt('Новое название', m.title)?.trim()
    if (title) guard(() => api(`/api/maps/${m.id}`, { method: 'PATCH', json: { title } }))
  }
  const remove = (m: MapSummary) => {
    if (confirm(`Удалить карту «${m.title}»? Это действие необратимо.`))
      guard(() => api(`/api/maps/${m.id}`, { method: 'DELETE' }))
  }
  const duplicate = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}/duplicate`, { method: 'POST' }))

  return (
    <>
      <TopBar />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Мои карты</h2>
          <div className="spacer" />
          <button onClick={() => guard(async () => { const id = await importAsNewMap(); if (id) nav(`/map/${id}`) })}
            title=".xmind, Markdown, OPML, FreeMind">Импорт…</button>
          <button className="primary" onClick={() => setGallery(true)} style={{ marginLeft: 8 }}>+ Новая карта</button>
        </div>
        {error && <p className="error">{error}</p>}
        {maps === null ? <p className="muted">Загрузка…</p> : maps.length === 0 ? <p className="muted">Карт пока нет.</p> : (
          <div className="map-grid">
            {maps.map(m => (
              <div className="map-card" key={m.id} data-testid="map-card">
                <div className="title" onClick={() => nav(`/map/${m.id}`)}>{m.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>Изменена {new Date(m.updated_at).toLocaleString('ru')}</div>
                <div className="actions">
                  <button onClick={() => nav(`/map/${m.id}`)}>Открыть</button>
                  <button onClick={() => rename(m)}>Переименовать</button>
                  <button onClick={() => duplicate(m)}>Дублировать</button>
                  <button className="danger" onClick={() => remove(m)}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {gallery && <TemplateGallery onPick={create} onClose={() => setGallery(false)} />}
    </>
  )
}
