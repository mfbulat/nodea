// Главная (как веб-версия): боковая панель разделов + сетка карт.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull, MapSummary, SharedMap } from '../api/types'
import { importAsNewMap } from '../editor/FileMenu'
import TemplateGallery from './TemplateGallery'
import type { MapDocument } from '../editor/model'
import { useAuth } from '../store/auth'
import Icon, { IconName } from '../ui/Icon'
import { Dropdown, MenuItem } from '../editor/Chrome'
import { sheetSvgMarkup } from '../io/image'

type View = 'recent' | 'all' | 'starred' | 'shared' | 'trash'
const TITLES: Record<View, string> = { recent: 'Недавние', all: 'Все карты', starred: 'Избранное', shared: 'Общие', trash: 'Корзина' }

const thumbCache = new Map<string, string>()

/** Миниатюра карты: статическая SVG-отрисовка первого листа */
function Thumb({ id, share }: { id: string; share?: string }) {
  const [src, setSrc] = useState<string | null>(thumbCache.get(id) ?? null)
  useEffect(() => {
    if (src) return
    let alive = true
    const load = share ? api<{ map: MapFull }>(`/api/shared/${share}`).then(r => r.map) : api<MapFull>(`/api/maps/${id}`)
    load.then(m => {
      if (!alive || !m.document.sheets[0]) return
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sheetSvgMarkup(m.document.sheets[0]).markup)
      thumbCache.set(id, url)
      setSrc(url)
    }).catch(() => {})
    return () => { alive = false }
  }, [id])
  return <div className="thumb">{src && <img src={src} alt="" />}</div>
}

function ago(iso?: string | null) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'только что'
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} дн назад`
  return new Date(iso).toLocaleDateString('ru')
}

export default function MapsPage() {
  const params = useParams()
  const view = (params.view as View) in TITLES ? (params.view as View) : 'recent'
  const [maps, setMaps] = useState<MapSummary[] | null>(null)
  const [shared, setShared] = useState<SharedMap[]>([])
  const [error, setError] = useState('')
  const [gallery, setGallery] = useState(false)
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>(() => (localStorage.getItem('home-layout') as 'grid') || 'grid')
  const [sort, setSort] = useState<'opened' | 'updated' | 'name'>('opened')
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)

  const reload = () => {
    if (view === 'shared') { setMaps([]); return api<SharedMap[]>('/api/maps/shared/with-me').then(setShared).catch(e => setError(e.message)) }
    return api<MapSummary[]>(`/api/maps?view=${view}`).then(setMaps).catch(e => setError(e.message))
  }
  useEffect(() => { setMaps(null); reload() }, [view])
  useEffect(() => { try { localStorage.setItem('home-layout', layout) } catch { /* без хранилища */ } }, [layout])

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
  const star = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}`, { method: 'PATCH', json: { starred: !m.starred } }))
  const toTrash = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}/trash`, { method: 'POST' }))
  const restore = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}/restore`, { method: 'POST' }))
  const remove = (m: MapSummary) => {
    if (confirm(`Удалить карту «${m.title}» навсегда? Это действие необратимо.`)) guard(() => api(`/api/maps/${m.id}`, { method: 'DELETE' }))
  }
  const duplicate = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}/duplicate`, { method: 'POST' }))
  const doImport = () => guard(async () => { const id = await importAsNewMap(); if (id) nav(`/map/${id}`) })

  const q = query.trim().toLowerCase()
  const list = (maps ?? []).filter(m => m.title.toLowerCase().includes(q)).sort((a, b) =>
    sort === 'name' ? a.title.localeCompare(b.title, 'ru') : sort === 'updated' ? b.updated_at.localeCompare(a.updated_at)
      : (b.last_opened_at ?? b.updated_at).localeCompare(a.last_opened_at ?? a.updated_at))
  const sharedList = shared.filter(m => m.title.toLowerCase().includes(q))

  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('mm.sideCollapsed') === '1' } catch { return false } })
  const item = (v: View, icon: IconName) => (
    <button className={'side-item' + (view === v ? ' on' : '')} title={collapsed ? TITLES[v] : undefined} onClick={() => nav(v === 'recent' ? '/' : `/home/${v}`)}>
      <Icon name={icon} size={18} />{!collapsed && <span>{TITLES[v]}</span>}
    </button>
  )

  const toggleSide = () => setCollapsed(c => { try { localStorage.setItem('mm.sideCollapsed', c ? '0' : '1') } catch { /* нет хранилища */ } return !c })
  return (
    <div className={'home' + (collapsed ? ' side-collapsed' : '')}>
      <aside className="home-side">
        <div className="side-top">
          {collapsed && <button className="side-item side-expand" aria-label="Развернуть боковую панель" title="Развернуть" onClick={toggleSide}><Icon name="chevronsRight" size={18} /></button>}
          <div className="workspace-row">
            <Dropdown trigger={(open, toggle) => (
              <button className={'workspace' + (open ? ' on' : '')} onClick={toggle} aria-label="Рабочее пространство">
                <span className="ws-icon"><Icon name="folder" size={16} /></span>{!collapsed && <>Мои карты<Icon name="chevron" size={14} /></>}
              </button>
            )}>
              {close => <div className="ws-menu">
                <div className="ws-head"><span className="ws-icon big"><Icon name="folder" size={22} /></span><span><b>Мои карты</b><small>{user?.email}</small></span></div>
                <MenuItem icon="settings" label="Настройки" onClick={() => { close(); nav('/account') }} />
                <div className="menu-sep" />
                <MenuItem label="Мои карты" checked onClick={close} />
              </div>}
            </Dropdown>
            {!collapsed && <button className="ibtn side-collapse" aria-label="Свернуть боковую панель" title="Свернуть" onClick={toggleSide}><Icon name="chevronsLeft" size={18} /></button>}
          </div>
          <nav>
            {item('recent', 'clock')}
          </nav>
          <div className="side-sep" />
          <nav>{item('all', 'grid')}</nav>
          <div className="side-sep" />
          <nav>
            {item('starred', 'star')}
            {item('shared', 'users')}
            <button className="side-item" title={collapsed ? 'Шаблоны' : undefined} onClick={() => setGallery(true)}><Icon name="template" size={18} />{!collapsed && <span>Шаблоны</span>}</button>
            {item('trash', 'trash')}
          </nav>
        </div>
        <div className="side-user">
          <Dropdown up align="right" trigger={(open, toggle) => (
            <button className={'ibtn bell-btn' + (open ? ' on' : '')} onClick={toggle} aria-label="Уведомления" title="Уведомления"><Icon name="bell" size={18} /></button>
          )}>
            {() => <div className="bell-pop"><b>Уведомления</b><span>Новых уведомлений нет.</span></div>}
          </Dropdown>
          <Dropdown up trigger={(_, toggle) => (
            <button className="user-btn" onClick={toggle}>
              <span className="avatar">{user?.email.slice(0, 1).toUpperCase()}</span>
              {!collapsed && <span className="email" title={user?.email}>{user?.email}</span>}
            </button>
          )}>
            {close => <>
              <MenuItem icon="settings" label="Аккаунт" onClick={() => { close(); nav('/account') }} />
              <MenuItem icon="close" label="Выйти" onClick={() => { close(); logout() }} />
            </>}
          </Dropdown>
        </div>
      </aside>
      <main className="home-main">
        <div className="home-head">
          <h1>{TITLES[view]}</h1>
          <div className="spacer" />
          <label className="search"><Icon name="search" size={16} />
            <input ref={searchRef} placeholder="Поиск файлов" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <Dropdown align="right" trigger={(_, toggle) => (
            <button className="btn-create" onClick={toggle}><Icon name="plus" size={16} />Создать</button>
          )}>
            {close => <div className="create-menu">
              <button onClick={() => { close(); create('Мозговой штурм', brainstormDoc()) }}>
                <span className="cm-icon"><Icon name="bulb" size={22} /></span>
                <span><b>Мозговой штурм</b><small>Генерируйте идеи и исследуйте новые возможности</small></span></button>
              <button onClick={() => { close(); setGallery(true) }}>
                <span className="cm-icon"><Icon name="mindmap" size={22} /></span>
                <span><b>Интеллект-карта</b><small>Начните с шаблона или с нуля, чтобы наглядно упорядочить идеи</small></span></button>
              <button onClick={() => { close(); doImport() }}>
                <span className="cm-icon"><Icon name="importFile" size={22} /></span>
                <span><b>Импорт</b><small>Откройте файл .xmind, Markdown, OPML или FreeMind</small></span></button>
            </div>}
          </Dropdown>
          <button className="ibtn" aria-label={layout === 'grid' ? 'Списком' : 'Сеткой'} title={layout === 'grid' ? 'Списком' : 'Сеткой'}
            onClick={() => setLayout(l => (l === 'grid' ? 'list' : 'grid'))}><Icon name={layout === 'grid' ? 'grid' : 'list'} size={18} /></button>
          <span className="head-sep" />
          <Dropdown align="right" trigger={(_, toggle) => <button className="ibtn" aria-label="Сортировка" title="Сортировка" onClick={toggle}><Icon name="sort" size={18} /></button>}>
            {close => <>
              {([['opened', 'По дате открытия'], ['updated', 'По дате изменения'], ['name', 'По названию']] as const).map(([v, l]) =>
                <MenuItem key={v} label={l} checked={sort === v} onClick={() => { close(); setSort(v) }} />)}
            </>}
          </Dropdown>
        </div>
        <div className="home-body">
          {error && <p className="error">{error}</p>}
          {maps === null ? <p className="muted">Загрузка…</p> : (
            <>
              <div className="section-label">Карты</div>
              {view === 'shared' ? (
                sharedList.length ? <div className={'file-grid ' + layout}>
                  {sharedList.map(m => (
                    <div className="file-card" key={m.id} data-testid="map-card" onClick={() => nav(`/s/${m.share_token}`)}>
                      <Thumb id={m.id} share={m.share_token} />
                      <div className="card-foot"><div className="card-text">
                        <span className="name">{m.title}</span><span className="caption">{m.owner_email} · {ago(m.visited_at)}</span></div></div>
                    </div>
                  ))}
                </div> : <Empty text="Здесь появятся карты, которые вы открывали по ссылке." />
              ) : list.length ? (
                <div className={'file-grid ' + layout}>
                  {list.map(m => (
                    <div className="file-card" key={m.id} data-testid="map-card" onClick={() => view !== 'trash' && nav(`/map/${m.id}`)}>
                      <Thumb id={m.id} />
                      {m.starred && view !== 'trash' && <span className="star-badge" title="В избранном"><Icon name="star" size={14} /></span>}
                      <div className="card-foot">
                        <div className="card-text">
                          <span className="name">{m.title}</span>
                          <span className="caption">{view === 'trash' ? `Удалена: ${ago(m.deleted_at)}` : `Открыта: ${ago(m.last_opened_at ?? m.updated_at)}`}</span>
                        </div>
                        <div onClick={e => e.stopPropagation()}>
                          <Dropdown align="right" trigger={(open, toggle) => (
                            <button className={'ibtn card-more' + (open ? ' on' : '')} onClick={toggle} aria-label="Действия"><Icon name="more" size={18} /></button>
                          )}>
                            {close => view === 'trash' ? <>
                              <MenuItem icon="restore" label="Восстановить" onClick={() => { close(); restore(m) }} />
                              <MenuItem icon="trash" label="Удалить навсегда" onClick={() => { close(); remove(m) }} />
                            </> : <>
                              <MenuItem label="Открыть" onClick={() => { close(); nav(`/map/${m.id}`) }} />
                              <MenuItem label="Переименовать" onClick={() => { close(); rename(m) }} />
                              <MenuItem label="Дублировать" onClick={() => { close(); duplicate(m) }} />
                              <MenuItem label={m.starred ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => { close(); star(m) }} />
                              <div className="menu-sep" />
                              <MenuItem label="Удалить" onClick={() => { close(); toTrash(m) }} />
                            </>}
                          </Dropdown>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty text={view === 'trash' ? 'Корзина пуста.' : view === 'starred' ? 'Отмечайте карты звёздочкой, чтобы они были здесь.' : 'Карт пока нет — нажмите «Создать».'} />}
            </>
          )}
        </div>
      </main>
      {gallery && <TemplateGallery onPick={create} onClose={() => setGallery(false)} />}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><Icon name="folder" size={36} /><p>{text}</p></div>
}

function brainstormDoc(): MapDocument {
  const id = () => Math.random().toString(36).slice(2, 12)
  return { version: 1, sheets: [{ id: id(), title: 'Карта 1', structure: 'mindmap-cw', rootTopic: { id: id(), title: 'Тема мозгового штурма', children: [
    { id: id(), title: 'Идея 1', children: [] }, { id: id(), title: 'Идея 2', children: [] }, { id: id(), title: 'Идея 3', children: [] }, { id: id(), title: 'Вопросы', children: [] }] } }] }
}
