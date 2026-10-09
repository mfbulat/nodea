import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useCollab } from './session'

interface Share { id: string; token: string; role: 'view' | 'edit' }

const linkOf = (token: string) => `${location.origin}/s/${token}`

export default function ShareDialog({ mapId, onClose }: { mapId: string; onClose: () => void }) {
  const [shares, setShares] = useState<Share[]>([])
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  const reload = () => api<Share[]>(`/api/maps/${mapId}/shares`).then(setShares).catch(e => setError(e.message))
  useEffect(() => { reload() }, [mapId])
  const create = async (role: 'view' | 'edit') => {
    try { await api(`/api/maps/${mapId}/shares`, { method: 'POST', json: { role } }); reload() } catch (e) { setError((e as Error).message) }
  }
  const revoke = async (s: Share) => {
    if (!confirm('Отозвать ссылку? Открытые по ней сеансы потеряют доступ при следующем подключении.')) return
    await api(`/api/maps/${mapId}/shares/${s.id}`, { method: 'DELETE' })
    reload()
  }
  const copy = async (s: Share) => {
    try { await navigator.clipboard.writeText(linkOf(s.token)); setCopied(s.id) } catch { prompt('Скопируйте ссылку', linkOf(s.token)) }
  }
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose() }}>
      <div className="modal" role="dialog" aria-label="Поделиться" data-testid="share-dialog">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Доступ по ссылке</h3><div className="spacer" />
          <button onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>Любой, у кого есть ссылка, сможет открыть карту — даже без входа.</p>
        {error && <p className="error">{error}</p>}
        {shares.map(s => (
          <div key={s.id} className="share-row">
            <span className="badge">{s.role === 'edit' ? 'Редактирование' : 'Просмотр'}</span>
            <input readOnly value={linkOf(s.token)} onFocus={e => e.target.select()} aria-label="Ссылка" />
            <button onClick={() => copy(s)}>{copied === s.id ? 'Скопировано' : 'Копировать'}</button>
            <button className="danger" onClick={() => revoke(s)}>Отозвать</button>
          </div>
        ))}
        {!shares.length && <p className="muted">Ссылок пока нет.</p>}
        <div className="modal-actions">
          <button onClick={() => create('view')}>+ Ссылка для просмотра</button>
          <button className="primary" onClick={() => create('edit')}>+ Ссылка для редактирования</button>
        </div>
      </div>
    </div>
  )
}

/** Аватары участников, которые сейчас в карте */
export function Presence() {
  const peers = useCollab(s => s.peers)
  if (!peers.length) return null
  return (
    <div className="presence" data-testid="presence" title={peers.map(p => p.name).join(', ')}>
      {peers.slice(0, 6).map(p => <span key={p.clientId} style={{ background: p.color }}>{p.name.slice(0, 1).toUpperCase()}</span>)}
      {peers.length > 6 && <span className="more">+{peers.length - 6}</span>}
    </div>
  )
}
