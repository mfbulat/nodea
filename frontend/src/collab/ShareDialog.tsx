import { useEffect, useState } from 'react'
import { useEditor } from '../editor/store'
import { avatarColor } from '../ui/avatar'
import { api } from '../api/client'
import { useCollab } from './session'

interface Share { id: string; token: string; role: 'view' | 'edit' }

const linkOf = (token: string) => `${location.origin}/s/${token}`

export default function ShareDialog({ mapId, onClose, onExport }: { mapId: string; onClose: () => void; onExport?: (fmt: string) => void }) {
  const [tab, setTab] = useState<'invite' | 'publish' | 'embed' | 'export'>('invite')
  const [shares, setShares] = useState<Share[]>([])
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  const [role, setRole] = useState<'edit' | 'view'>('edit')
  const reload = () => api<Share[]>(`/api/maps/${mapId}/shares`).then(setShares).catch(e => setError(e.message))
  useEffect(() => { reload() }, [mapId])
  const create = async (r: 'view' | 'edit') => {
    try { const s = await api<Share>(`/api/maps/${mapId}/shares`, { method: 'POST', json: { role: r } }); await reload(); return s } catch (e) { setError((e as Error).message) }
  }
  const revoke = async (s: Share) => {
    if (!confirm('Отозвать ссылку? Открытые по ней сеансы потеряют доступ при следующем подключении.')) return
    await api(`/api/maps/${mapId}/shares/${s.id}`, { method: 'DELETE' })
    reload()
  }
  const copyText = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) } catch { prompt('Скопируйте', text) }
  }
  const viewShare = shares.find(s => s.role === 'view')
  const embedCode = viewShare ? `<iframe src="${linkOf(viewShare.token)}?embed=1" width="800" height="500" style="border:1px solid #e4e7eb;border-radius:8px" allowfullscreen></iframe>` : ''
  const ensureView = async () => viewShare ?? await create('view')
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose() }}>
      <div className="share-modal" role="dialog" aria-label="Поделиться" data-testid="share-dialog">
        <div className="share-head"><h3>Поделиться</h3><button className="ibtn" onClick={onClose} aria-label="Закрыть">×</button></div>
        <div className="share-tabs">
          {([['invite', 'Пригласить'], ['publish', 'Опубликовать'], ['embed', 'Встроить'], ['export', 'Экспорт']] as const).map(([k, l]) =>
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="share-body">
          {tab === 'invite' && <>
            <p className="muted">Любой, у кого есть ссылка, сможет открыть карту — даже без входа.</p>
            <div className="share-row">
              <select value={role} onChange={e => setRole(e.target.value as 'edit' | 'view')} aria-label="Права">
                <option value="edit">Может редактировать</option><option value="view">Может просматривать</option>
              </select>
              <button className="btn-create" onClick={() => create(role)}>Создать ссылку</button>
            </div>
            <div className="share-list">
              {shares.map(s => (
                <div key={s.id} className="share-row">
                  <span className="badge">{s.role === 'edit' ? 'Редактирование' : 'Просмотр'}</span>
                  <input readOnly value={linkOf(s.token)} onFocus={e => e.target.select()} aria-label="Ссылка" />
                  <button onClick={() => copyText(s.id, linkOf(s.token))}>{copied === s.id ? 'Скопировано' : 'Копировать'}</button>
                  <button className="danger" onClick={() => revoke(s)}>Отозвать</button>
                </div>
              ))}
              {!shares.length && <p className="muted">Ссылок пока нет.</p>}
            </div>
          </>}
          {tab === 'publish' && <>
            <p>Опубликуйте карту только для просмотра: её смогут открыть все, у кого есть ссылка.</p>
            {viewShare ? <div className="share-row">
              <input readOnly value={linkOf(viewShare.token)} onFocus={e => e.target.select()} aria-label="Публичная ссылка" />
              <button onClick={() => copyText('pub', linkOf(viewShare.token))}>{copied === 'pub' ? 'Скопировано' : 'Копировать'}</button>
              <button className="danger" onClick={() => revoke(viewShare)}>Снять с публикации</button>
            </div> : <button className="btn-create" onClick={() => create('view')}>Опубликовать</button>}
          </>}
          {tab === 'embed' && <>
            <p>Вставьте карту на сайт или в документ — она откроется в режиме просмотра.</p>
            {viewShare ? <>
              <textarea readOnly rows={4} value={embedCode} onFocus={e => e.target.select()} aria-label="Код для вставки" />
              <button className="btn-create" onClick={() => copyText('embed', embedCode)}>{copied === 'embed' ? 'Скопировано' : 'Копировать код'}</button>
            </> : <button className="btn-create" onClick={() => ensureView()}>Получить код</button>}
          </>}
          {tab === 'export' && <div className="export-grid">
            {[['png', 'PNG'], ['svg', 'SVG'], ['pdf', 'PDF'], ['md', 'Markdown'], ['docx', 'Word'], ['xlsx', 'Excel'], ['pptx', 'PowerPoint'], ['opml', 'OPML'], ['mm', 'FreeMind'], ['xmind', 'XMind']]
              .map(([f, l]) => <button key={f} onClick={() => { onExport?.(f); onClose() }}>{l}</button>)}
          </div>}
        </div>
        <div className="share-foot">
          <button onClick={onClose}>Отмена</button>
          <button className="btn-create" onClick={async () => { const s = shares.find(x => x.role === 'edit') ?? await create('edit'); if (s) copyText('main', linkOf(s.token)) }}>
            {copied === 'main' ? 'Ссылка скопирована' : 'Копировать ссылку на карту'}</button>
        </div>
      </div>
    </div>
  )
}

/** Аватары участников, которые сейчас в карте */
/** Аватары сверху справа: вы и участники онлайн; при наведении — список имён (как в веб-версии). */
export function Presence() {
  const peers = useCollab(s => s.peers)
  const me = useEditor(s => s.userName)
  const [hover, setHover] = useState(false)
  if (!me && !peers.length) return null
  const all = [{ key: 'me', name: me || 'Гость', color: avatarColor(me || 'Гость') }, ...peers.map(p => ({ key: String(p.clientId), name: p.name, color: p.color }))]
  return (
    <div className="presence" data-testid="presence" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {all.slice(0, 5).map(p => <span key={p.key} data-peer={p.key !== 'me' || undefined} style={{ background: p.color }}>{p.name.slice(0, 1).toUpperCase()}</span>)}
      {all.length > 5 && <span className="more">+{all.length - 5}</span>}
      {hover && <div className="presence-tip">{all.map(p => <div key={p.key}>{p.name}{p.key === 'me' ? ' (вы)' : ''}</div>)}</div>}
    </div>
  )
}
