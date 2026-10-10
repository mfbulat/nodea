// Главная (как веб-версия): боковая панель разделов + сетка карт.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull, MapSummary, SharedMap } from '../api/types'
import { importAsNewMap } from '../editor/FileMenu'
import TemplateGallery from './TemplateGallery'
import { TEMPLATES } from '../templates'
import type { MapDocument } from '../editor/model'
import { useAuth } from '../store/auth'
import Icon, { IconName } from '../ui/Icon'
import { Dropdown, MenuItem } from '../editor/Chrome'
import { sheetSvgMarkup } from '../io/image'
import ShareDialog from '../collab/ShareDialog'

type View = 'recent' | 'all' | 'starred' | 'shared' | 'trash'
const TITLES: Record<View, string> = { recent: 'Recents', all: 'All Maps', starred: 'Starred', shared: 'Shared', trash: 'Trash' }

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
  if (s < 60) return 'just now'
  if (s < 3600) { const n = Math.floor(s / 60); return `${n} minute${n > 1 ? 's' : ''} ago` }
  if (s < 86400) { const n = Math.floor(s / 3600); return `${n} hour${n > 1 ? 's' : ''} ago` }
  if (s < 86400 * 7) { const n = Math.floor(s / 86400); return `${n} day${n > 1 ? 's' : ''} ago` }
  return new Date(iso).toLocaleDateString('en')
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
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'opened', desc: true })
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
    const title = prompt('Rename Map', m.title)?.trim()
    if (title) guard(() => api(`/api/maps/${m.id}`, { method: 'PATCH', json: { title } }))
  }
  const star = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}`, { method: 'PATCH', json: { starred: !m.starred } }))
  const toTrash = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}/trash`, { method: 'POST' }))
  const restore = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}/restore`, { method: 'POST' }))
  const remove = (m: MapSummary) => {
    if (confirm(`Delete "${m.title}" permanently? This action cannot be undone.`)) guard(() => api(`/api/maps/${m.id}`, { method: 'DELETE' }))
  }
  const [shareFor, setShareFor] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const download = (m: MapSummary) => guard(async () => {
    const full = await api<MapFull>(`/api/maps/${m.id}`)
    const { exportMap } = await import('../io')
    await exportMap('xmind', full.document, full.document.sheets[0], full.title)
  })
  const duplicate = (m: MapSummary) => guard(() => api(`/api/maps/${m.id}/duplicate`, { method: 'POST' }))
  const doImport = () => guard(async () => { const id = await importAsNewMap(); if (id) nav(`/map/${id}`) })

  const q = query.trim().toLowerCase()
  // в корзине «последнее открытие» заменяет «дата удаления»
  const key: SortKey = view === 'trash' && sort.key === 'opened' ? 'deleted' : view !== 'trash' && sort.key === 'deleted' ? 'opened' : sort.key
  const list = (maps ?? []).filter(m => m.title.toLowerCase().includes(q)).sort((a, b) => {
    const c = key === 'name' ? a.title.localeCompare(b.title) : key === 'size' ? (a.size ?? 0) - (b.size ?? 0)
      : key === 'deleted' ? (a.deleted_at ?? '').localeCompare(b.deleted_at ?? '')
        : (a.last_opened_at ?? a.updated_at).localeCompare(b.last_opened_at ?? b.updated_at)
    return sort.desc ? -c : c
  })
  const sortMenu = <SortMenu keys={view === 'trash' ? ['name', 'deleted'] : view === 'all' ? ['name', 'size', 'opened'] : ['name', 'opened']}
    cur={key} desc={sort.desc} onPick={k => setSort(s => (s.key === k || (k === 'deleted' && s.key === 'opened') ? { key: k, desc: !s.desc } : { key: k, desc: k !== 'name' }))} />
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
          {collapsed && <button className="side-item side-expand" aria-label="Expand sidebar" title="Expand" onClick={toggleSide}><Icon name="chevronsRight" size={18} /></button>}
          <div className="workspace-row">
            <Dropdown trigger={(open, toggle) => (
              <button className={'workspace' + (open ? ' on' : '')} onClick={toggle} aria-label="Workspace">
                <span className="ws-icon"><Icon name="folder" size={16} /></span>{!collapsed && <>My Works<Icon name="chevron" size={14} /></>}
              </button>
            )}>
              {close => <div className="ws-menu">
                <div className="ws-head"><span className="ws-icon big"><Icon name="folder" size={22} /></span><span><b>My Works</b><small>{user?.email}</small></span></div>
                <MenuItem icon="settings" label="Settings" onClick={() => { close(); nav('/account') }} />
                <div className="menu-sep" />
                <MenuItem label="My Works" checked onClick={close} />
              </div>}
            </Dropdown>
            {!collapsed && <button className="ibtn side-collapse" aria-label="Collapse sidebar" title="Collapse" onClick={toggleSide}><Icon name="chevronsLeft" size={18} /></button>}
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
            <button className="side-item" title={collapsed ? 'More Templates' : undefined} onClick={() => setGallery(true)}><Icon name="template" size={18} />{!collapsed && <span>More Templates</span>}</button>
            {item('trash', 'trash')}
          </nav>
        </div>
        <div className="side-user">
          <Dropdown up align="right" trigger={(open, toggle) => (
            <button className={'ibtn bell-btn' + (open ? ' on' : '')} onClick={toggle} aria-label="Notifications" title="Notifications"><Icon name="bell" size={18} /></button>
          )}>
            {() => <div className="bell-pop"><b>Notifications</b><span>No new notifications.</span></div>}
          </Dropdown>
          <Dropdown up trigger={(_, toggle) => (
            <button className="user-btn" onClick={toggle}>
              <span className="avatar">{user?.email.slice(0, 1).toUpperCase()}</span>
              {!collapsed && <span className="email" title={user?.email}>{user?.email}</span>}
            </button>
          )}>
            {close => <>
              <MenuItem icon="settings" label="Account" onClick={() => { close(); nav('/account') }} />
              <MenuItem icon="close" label="Log Out" onClick={() => { close(); logout() }} />
            </>}
          </Dropdown>
        </div>
      </aside>
      <main className="home-main">
        {view === 'all' ? <>
          <div className="home-head single">
            <h1>{TITLES[view]}</h1>
            <div className="spacer" />
            <button className="ibtn" aria-label="Settings" title="Settings" onClick={() => nav('/account')}><Icon name="settings" size={18} /></button>
          </div>
        </> : <div className="home-head">
          <h1>{TITLES[view]}</h1>
          <div className="spacer" />
          <label className="search"><Icon name="search" size={16} />
            <input ref={searchRef} placeholder="Search file" value={query} onChange={e => setQuery(e.target.value)} /></label>
          {view === 'recent' && <>
          <Dropdown align="right" trigger={(_, toggle) => (
            <button className="btn-create" onClick={toggle}><Icon name="plus" size={16} />Create New</button>
          )}>
            {close => <div className="create-menu">
              <button onClick={() => { close(); create('Brainstorming', brainstormDoc()) }}>
                <span className="cm-icon" style={{ color: '#ca8a04' }}><Icon name="bulb" size={28} /></span>
                <span className="cm-text"><b>Brainstorming</b><small>Generate creative ideas and explore new possibilities effortlessly</small></span></button>
              <i />
              <button onClick={() => { close(); setGallery(true) }}>
                <span className="cm-icon" style={{ color: '#2a77bf' }}><Icon name="mindmap" size={28} /></span>
                <span className="cm-text"><b>Mind Map</b><small>Start your map with a template or from scratch to organize ideas visually.</small></span></button>
              <i />
              <button onClick={() => { close(); doImport() }}>
                <span className="cm-icon"><Icon name="importFile" size={28} /></span>
                <span className="cm-text"><b>Import</b><small>Bring your existing files or content into a mind map for better clarity</small></span></button>
            </div>}
          </Dropdown>
          </>}
          <button className="ibtn" aria-label={layout === 'grid' ? 'List View' : 'Grid View'} title={layout === 'grid' ? 'List View' : 'Grid View'}
            onClick={() => setLayout(l => (l === 'grid' ? 'list' : 'grid'))}><Icon name={layout === 'grid' ? 'grid' : 'list'} size={18} /></button>
          <span className="head-sep" />
          {sortMenu}
        </div>}
        <div className="home-body">
          {error && <p className="error">{error}</p>}
          {maps === null ? <p className="muted">Loading…</p> : (
            <>
              {view === 'all' && <>
                <QuickCreate onCreate={create} onAll={() => setGallery(true)} />
                <div className="home-head inline">
                  <span className="all-label">All</span>
          <div className="spacer" />
                  <button className="btn-outline wide-only" onClick={() => create('Brainstorming', brainstormDoc())}><Icon name="bulb" size={16} />Brainstorming</button>
                  <label className="search"><Icon name="search" size={16} />
                    <input ref={searchRef} placeholder="Search file" value={query} onChange={e => setQuery(e.target.value)} /></label>
                  <Dropdown align="right" trigger={(_, toggle) => (
                    <button className="btn-create" onClick={toggle}><Icon name="plus" size={16} />Create New</button>
                  )}>
                    {close => <div className="create-menu">
                      <button onClick={() => { close(); create('Brainstorming', brainstormDoc()) }}>
                        <span className="cm-icon" style={{ color: '#ca8a04' }}><Icon name="bulb" size={28} /></span>
                        <span className="cm-text"><b>Brainstorming</b><small>Generate creative ideas and explore new possibilities effortlessly</small></span></button>
                      <i />
                      <button onClick={() => { close(); setGallery(true) }}>
                        <span className="cm-icon" style={{ color: '#2a77bf' }}><Icon name="mindmap" size={28} /></span>
                        <span className="cm-text"><b>Mind Map</b><small>Start your map with a template or from scratch to organize ideas visually.</small></span></button>
                      <i />
                      <button onClick={() => { close(); doImport() }}>
                        <span className="cm-icon"><Icon name="importFile" size={28} /></span>
                        <span className="cm-text"><b>Import</b><small>Bring your existing files or content into a mind map for better clarity</small></span></button>
                    </div>}
                  </Dropdown>
                  <button className="ibtn" aria-label={layout === 'grid' ? 'List View' : 'Grid View'} title={layout === 'grid' ? 'List View' : 'Grid View'}
                    onClick={() => setLayout(l => (l === 'grid' ? 'list' : 'grid'))}><Icon name={layout === 'grid' ? 'grid' : 'list'} size={18} /></button>
                  <span className="head-sep" />
                  {sortMenu}
                </div>
              </>}
              {view === 'trash' && <div className="trash-note">Files and folders are available for 30 days. After that time, they will be permanently deleted.</div>}
              {(view === 'shared' ? sharedList.length : list.length) > 0 && <div className="section-label">Maps</div>}
              {view === 'shared' ? (
                sharedList.length ? <div className={'file-grid ' + layout}>
                  {sharedList.map(m => (
                    <div className="file-card" key={m.id} data-testid="map-card" onClick={() => nav(`/s/${m.share_token}`)}>
                      <Thumb id={m.id} share={m.share_token} />
                      <div className="card-foot"><div className="card-text">
                        <span className="name">{m.title}</span><span className="caption">{m.owner_email} · {ago(m.visited_at)}</span></div></div>
                    </div>
                  ))}
                </div> : <Empty icon="users" title="No Shared maps." text="Recently shared maps will appear here." />
              ) : list.length ? (
                <div className={'file-grid ' + layout}>
                  {list.map(m => (
                    <div className={'file-card' + (focusId === m.id ? ' focused' : '')} key={m.id} data-testid="map-card" ref={el => { if (el && focusId === m.id) el.scrollIntoView({ block: 'nearest' }) }}
                      onClick={() => view !== 'trash' && nav(`/map/${m.id}`)}>
                      <Thumb id={m.id} />
                      {view !== 'trash' && view !== 'starred' && <button className={'star-badge' + (m.starred ? ' on' : '')} title={m.starred ? 'Remove from Starred' : 'Add to Starred'}
                        aria-label={m.starred ? 'Remove from Starred' : 'Add to Starred'} onClick={e => { e.stopPropagation(); star(m) }}><Icon name="star" size={14} /></button>}
                      <div className="card-foot">
                        <div className="card-text">
                          <span className="name">{m.title}</span>
                          <span className="caption">{view === 'trash' ? `Deleted: ${ago(m.deleted_at)}` : `Last opened: ${ago(m.last_opened_at ?? m.updated_at)}`}</span>
                        </div>
                        <div onClick={e => e.stopPropagation()}>
                          <Dropdown align="right" trigger={(open, toggle) => (
                            <button className={'ibtn card-more' + (open ? ' on' : '')} onClick={toggle} aria-label="More"><Icon name="more" size={18} /></button>
                          )}>
                            {close => view === 'trash' ? <>
                              <i className="mm-main" hidden />
                              <MenuItem icon="restore" label="Restore" onClick={() => { close(); restore(m) }} />
                              <MenuItem icon="trash" label="Delete Permanently" onClick={() => { close(); remove(m) }} />
                            </> : <>
                              <i className="mm-main" hidden />
                              <MenuItem icon="shareNodes" label="Share" onClick={() => { close(); setShareFor(m.id) }} />
                              <MenuItem icon="link" label="Copy Link" onClick={() => { close(); navigator.clipboard?.writeText(`${location.origin}/map/${m.id}`).catch(() => {}) }} />
                              <MenuItem icon="star" label={m.starred ? 'Remove from Starred' : 'Add to Starred'} onClick={() => { close(); star(m) }} />
                              {view === 'recent' && <MenuItem icon="folder" label="Show Map Location" onClick={() => { close(); setFocusId(m.id); nav('/home/all') }} />}
                              <div className="menu-sep" />
                              <MenuItem icon="edit" label="Rename" onClick={() => { close(); rename(m) }} />
                              {view !== 'recent' && <>
                                <div className="menu-sep" />
                                <MenuItem icon="duplicate" label="Duplicate" onClick={() => { close(); duplicate(m) }} />
                                <MenuItem icon="upload" label="Download" onClick={() => { close(); download(m) }} />
                              </>}
                              <div className="menu-sep" />
                              {view === 'recent'
                                ? <MenuItem icon="clock" label="Remove from Recents" onClick={() => { close(); guard(() => api(`/api/maps/${m.id}/remove-recent`, { method: 'POST' })) }} />
                                : <MenuItem icon="trash" label="Move to Trash" onClick={() => { close(); toTrash(m) }} />}
                            </>}
                          </Dropdown>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty icon={view === 'trash' ? 'trash' : view === 'starred' ? 'star' : 'folder'}
                title={view === 'trash' ? 'No Trash' : view === 'starred' ? 'No Starred maps.' : 'No maps yet.'}
                text={view === 'trash' ? 'Recently deleted maps will appear here.' : view === 'starred' ? 'Starred maps will appear here.' : 'Click Create New to start a new map.'} />}
            </>
          )}
        </div>
      </main>
      {shareFor && <ShareDialog mapId={shareFor} onClose={() => setShareFor(null)} />}
      {gallery && <TemplateGallery onPick={create} onClose={() => setGallery(false)} />}
    </div>
  )
}

/** Полоса быстрого создания во «Всех картах»: пустая карта, базовые структуры и «Все шаблоны» */
function QuickCreate({ onCreate, onAll }: { onCreate: (title: string, doc: MapDocument) => void; onAll: () => void }) {
  const basics = TEMPLATES.filter(t => ['blank', 'logic', 'brace'].includes(t.id))
  return (
    <div className="quick-create">
      <button className="qc-tile" onClick={() => onCreate('Mind Map', TEMPLATES[0].make())}>
        <span className="qc-thumb plus"><Icon name="plus" size={22} /></span><span className="qc-name">Create New</span></button>
      <div className="qc-mid">
        {basics.map(t => (
          <button key={t.id} className="qc-tile" onClick={() => onCreate(t.title, t.make())}>
            <span className="qc-thumb"><QcPreview t={t} /></span><span className="qc-name">{t.title}</span></button>
        ))}
      </div>
      <button className="qc-tile" onClick={onAll}>
        <span className="qc-thumb stack"><QcPreview t={TEMPLATES.find(t => t.id === 'meeting') ?? TEMPLATES[0]} /></span><span className="qc-name">See All <Icon name="chevronRight" size={14} /></span></button>
    </div>
  )
}
const qcCache = new Map<string, string>()
function QcPreview({ t }: { t: { id: string; make: () => MapDocument } }) {
  let src = qcCache.get(t.id)
  if (!src) { src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sheetSvgMarkup(t.make().sheets[0]).markup); qcCache.set(t.id, src) }
  return <img src={src} alt="" />
}

type SortKey = 'name' | 'size' | 'opened' | 'deleted'
const SORT_NAMES: Record<SortKey, string> = { name: 'Name', size: 'Size', opened: 'Last opened', deleted: 'Deleted' }
/** «Sort» как в веб-версии: подпись, пункты раздела, стрелка направления у активного; повторный щелчок меняет направление */
function SortMenu({ keys, cur, desc, onPick }: { keys: SortKey[]; cur: SortKey; desc: boolean; onPick: (k: SortKey) => void }) {
  return (
    <Dropdown align="right" trigger={(open, toggle) => <button className={'ibtn' + (open ? ' on' : '')} aria-label="Sort" title="Sort" onClick={toggle}><Icon name="sort" size={18} /></button>}>
      {close => <div className="sort-menu">
        <span className="menu-caption">Sort</span>
        {keys.map(k => (
          <button key={k} role="menuitemradio" aria-checked={k === cur} onClick={() => { close(); onPick(k) }}>
            <span className="mi-label">{SORT_NAMES[k]}</span>
            {k === cur && <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: desc ? undefined : 'rotate(180deg)' }}><path d="M8 3v10M4 9l4 4 4-4" /></svg>}
          </button>
        ))}
      </div>}
    </Dropdown>
  )
}

function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="empty"><Icon name={icon} size={72} /><b>{title}</b><p>{text}</p></div>
}

function brainstormDoc(): MapDocument {
  const id = () => Math.random().toString(36).slice(2, 12)
  return { version: 1, sheets: [{ id: id(), title: 'Map 1', structure: 'mindmap-cw', rootTopic: { id: id(), title: 'Central Topic', children: [
    { id: id(), title: 'Idea 1', children: [] }, { id: id(), title: 'Idea 2', children: [] }, { id: id(), title: 'Idea 3', children: [] }, { id: id(), title: 'Questions', children: [] }] } }] }
}
