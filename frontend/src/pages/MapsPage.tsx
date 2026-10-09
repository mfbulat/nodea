import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull, MapSummary } from '../api/types'
import { importAsNewMap } from '../editor/FileMenu'
import TemplateGallery from './TemplateGallery'
import type { MapDocument } from '../editor/model'
import { useAuth } from '../store/auth'
import Icon from '../ui/Icon'
import { Dropdown, MenuItem } from '../editor/Chrome'
import { sheetSvgMarkup } from '../io/image'

/** Миниатюра карты: статическая SVG-отрисовка первого листа */
function Thumb({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    api<MapFull>(`/api/maps/${id}`).then(m => {
      if (!alive || !m.document.sheets[0]) return
      const { markup } = sheetSvgMarkup(m.document.sheets[0])
      setSrc('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup))
    }).catch(() => {})
    return () => { alive = false }
  }, [id])
  return <div className="thumb">{src && <img src={src} alt="" />}</div>
}

export default function MapsPage() {
  const [maps, setMaps] = useState<MapSummary[] | null>(null)
  const [error, setError] = useState('')
  const [gallery, setGallery] = useState(false)
  const [query, setQuery] = useState('')
  const { user, logout } = useAuth()
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
  const doImport = () => guard(async () => { const id = await importAsNewMap(); if (id) nav(`/map/${id}`) })
  const shown = (maps ?? []).filter(m => m.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="home">
      <aside className="home-side">
        <div className="account">
          <span className="avatar">{user?.email.slice(0, 1).toUpperCase()}</span>
          <span className="email" title={user?.email}>{user?.email}</span>
        </div>
        <button className="primary create" onClick={() => setGallery(true)}><Icon name="plus" size={18} />Новая карта</button>
        <nav>
          <button className="side-item on"><Icon name="clock" size={18} />Недавние</button>
          <button className="side-item" onClick={doImport} title=".xmind, Markdown, OPML, FreeMind"><Icon name="upload" size={18} />Открыть файл</button>
          <button className="side-item" onClick={() => setGallery(true)}><Icon name="template" size={18} />Шаблоны</button>
        </nav>
        <div className="spacer" />
        <nav>
          <button className="side-item" onClick={() => nav('/account')}><Icon name="settings" size={18} />Аккаунт</button>
          <button className="side-item" onClick={() => logout()}><Icon name="close" size={18} />Выйти</button>
        </nav>
      </aside>
      <main className="home-main">
        <div className="home-head">
          <h1>Недавние</h1>
          <div className="spacer" />
          <label className="search"><Icon name="search" size={16} />
            <input placeholder="Поиск карт" value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        {error && <p className="error">{error}</p>}
        {maps === null ? <p className="muted">Загрузка…</p> : (
          <div className="map-grid">
            <button className="map-card new" onClick={() => setGallery(true)} aria-label="+ Новая карта">
              <div className="thumb"><Icon name="plus" size={36} /></div>
              <div className="title">Новая карта</div>
            </button>
            {shown.map(m => (
              <div className="map-card" key={m.id} data-testid="map-card">
                <div onClick={() => nav(`/map/${m.id}`)} style={{ cursor: 'pointer' }}><Thumb id={m.id} /></div>
                <div className="card-row">
                  <div className="title" onClick={() => nav(`/map/${m.id}`)}>{m.title}</div>
                  <Dropdown align="right" trigger={(open, toggle) => (
                    <button className={'ibtn' + (open ? ' on' : '')} onClick={toggle} aria-label="Действия"><Icon name="more" size={18} /></button>
                  )}>
                    {close => <>
                      <MenuItem label="Открыть" onClick={() => { close(); nav(`/map/${m.id}`) }} />
                      <MenuItem label="Переименовать" onClick={() => { close(); rename(m) }} />
                      <MenuItem label="Дублировать" onClick={() => { close(); duplicate(m) }} />
                      <MenuItem label="Удалить" onClick={() => { close(); remove(m) }} />
                    </>}
                  </Dropdown>
                </div>
                <div className="muted date">{new Date(m.updated_at).toLocaleString('ru')}</div>
              </div>
            ))}
          </div>
        )}
      </main>
      {gallery && <TemplateGallery onPick={create} onClose={() => setGallery(false)} />}
    </div>
  )
}
