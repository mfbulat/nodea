import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { MapDocument } from '../editor/model'
import { TEMPLATES } from '../templates'

interface UserTemplate { id: string; title: string; document: MapDocument; created_at: string }

export default function TemplateGallery({ onPick, onClose }: { onPick: (title: string, doc: MapDocument) => void; onClose: () => void }) {
  const [mine, setMine] = useState<UserTemplate[]>([])
  const reload = () => api<UserTemplate[]>('/api/templates').then(setMine).catch(() => {})
  useEffect(() => { reload() }, [])
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div className="modal gallery" role="dialog" aria-label="Новая карта">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Новая карта</h3><div className="spacer" />
          <button onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="tpl-grid">
          {TEMPLATES.map(t => (
            <button key={t.id} className="tpl-card" onClick={() => onPick(t.id === 'blank' || t.id === 'blank-logic' ? 'Новая карта' : t.title, t.make())}>
              <b>{t.title}</b><span className="muted">{t.description}</span>
            </button>
          ))}
        </div>
        {mine.length > 0 && <>
          <h4 className="panel-sub">Мои шаблоны</h4>
          <div className="tpl-grid">
            {mine.map(t => (
              <div key={t.id} className="tpl-card">
                <button className="link-btn" onClick={() => onPick(t.title, t.document)}><b>{t.title}</b></button>
                <span className="muted">{new Date(t.created_at).toLocaleDateString('ru')}</span>
                <button className="mini danger" onClick={async () => {
                  if (confirm(`Удалить шаблон «${t.title}»?`)) { await api(`/api/templates/${t.id}`, { method: 'DELETE' }); reload() }
                }}>Удалить</button>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  )
}
