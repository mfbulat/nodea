// «Выберите шаблон» (как в веб-версии): категории с рядами превью, «›» — показать все.
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { MapDocument } from '../editor/model'
import { CATEGORIES, TEMPLATES, TemplateDef } from '../templates'
import { sheetSvgMarkup } from '../io/image'
import Icon from '../ui/Icon'

interface UserTemplate { id: string; title: string; document: MapDocument; created_at: string }

function Preview({ doc }: { doc: MapDocument }) {
  const src = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sheetSvgMarkup(doc.sheets[0]).markup), [doc])
  return <img src={src} alt="" />
}

export default function TemplateGallery({ onPick, onClose }: { onPick: (title: string, doc: MapDocument) => void; onClose: () => void }) {
  const [mine, setMine] = useState<UserTemplate[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const docs = useMemo(() => new Map(TEMPLATES.map(t => [t.id, t.make()])), [])
  const reload = () => api<UserTemplate[]>('/api/templates').then(setMine).catch(() => {})
  useEffect(() => { reload() }, [])
  const pick = (t: TemplateDef) => onPick(t.title, t.make())
  const cats = open ? [open] : CATEGORIES
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div className="tpl-modal" role="dialog" aria-label="Choose a Template">
        <div className="tpl-head">
          {open && <button className="ibtn" onClick={() => setOpen(null)} aria-label="Back"><Icon name="chevronRight" size={16} /></button>}
          <h2>{open ?? 'Choose a Template'}</h2>
        </div>
        <div className="tpl-body">
          {cats.map(c => {
            const list = TEMPLATES.filter(t => t.category === c)
            return (
              <section key={c}>
                {!open && <button className="tpl-cat" onClick={() => setOpen(c)}><span>{c}</span><Icon name="chevronRight" size={16} /></button>}
                <div className={'tpl-row' + (open ? ' all' : '')}>
                  {(open ? list : list.slice(0, 4)).map(t => (
                    <button key={t.id} className="tpl-card" onClick={() => pick(t)} aria-label={t.title}>
                      <div className="tpl-prev"><Preview doc={docs.get(t.id)!} /><span className="use">Use</span></div>
                      <span className="tpl-name">{t.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          {!open && mine.length > 0 && (
            <section>
              <div className="tpl-cat static"><span>My Templates</span></div>
              <div className="tpl-row all">
                {mine.map(t => (
                  <div key={t.id} className="tpl-card">
                    <button className="tpl-prev" onClick={() => onPick(t.title, t.document)} aria-label={t.title}><Preview doc={t.document} /><span className="use">Use</span></button>
                    <span className="tpl-name">{t.title}
                      <button className="mini danger" onClick={async () => { if (confirm(`Delete template "${t.title}"?`)) { await api(`/api/templates/${t.id}`, { method: 'DELETE' }); reload() } }}>×</button></span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <div className="tpl-foot"><button className="btn-create" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  )
}
