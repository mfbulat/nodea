import { useMemo, useState } from 'react'
import katex from 'katex'
import { useEditor } from './store'
import { indexSheet, type Topic } from './model'
import { STICKERS } from './markers'
import { useDoc } from '../store/doc'

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose() }}>
      <div className="modal" role="dialog" aria-label={title}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

export default function Dialogs() {
  const { dialog } = useEditor()
  const ed = useEditor.getState()
  const sheet = ed.sheet()
  if (!dialog || !sheet) return null
  const topic = indexSheet(sheet).get(dialog.id)?.topic
  if (!topic) return null
  const close = () => ed.setDialog(null)
  switch (dialog.kind) {
    case 'link': return <LinkDialog topic={topic} close={close} />
    case 'labels': return <LabelsDialog topic={topic} close={close} />
    case 'equation': return <EquationDialog topic={topic} close={close} />
    case 'sticker': return <StickerDialog topic={topic} close={close} />
  }
}

function LinkDialog({ topic, close }: { topic: Topic; close: () => void }) {
  const ed = useEditor.getState()
  const isTopic = topic.href?.startsWith('topic:')
  const [mode, setMode] = useState<'web' | 'topic'>(isTopic ? 'topic' : 'web')
  const [url, setUrl] = useState(isTopic ? '' : topic.href ?? '')
  const [target, setTarget] = useState(isTopic ? topic.href!.slice(6) : '')
  const doc = useDoc(s => s.doc)!
  // темы всех листов для ссылки на тему
  const options = useMemo(() => doc.sheets.flatMap(sh => [...indexSheet(sh).values()]
    .filter(r => r.topic.id !== topic.id)
    .map(r => ({ id: r.topic.id, label: (doc.sheets.length > 1 ? sh.title + ' › ' : '') + (r.topic.title || '(без названия)') }))), [doc, topic.id])
  const save = () => {
    ed.setTopic([topic.id], { href: mode === 'web' ? (url.trim() || undefined) : (target ? 'topic:' + target : undefined) })
    close()
  }
  return (
    <Modal title="Ссылка" onClose={close}>
      <div className="seg">
        <button className={mode === 'web' ? 'on' : ''} onClick={() => setMode('web')}>Веб-адрес</button>
        <button className={mode === 'topic' ? 'on' : ''} onClick={() => setMode('topic')}>Тема</button>
      </div>
      {mode === 'web'
        ? <input autoFocus placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
        : <select value={target} onChange={e => setTarget(e.target.value)} size={8} aria-label="Тема">
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>}
      <div className="modal-actions">
        {topic.href && <button className="danger" onClick={() => { ed.setTopic([topic.id], { href: undefined }); close() }}>Удалить ссылку</button>}
        <div className="spacer" />
        <button onClick={close}>Отмена</button>
        <button className="primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  )
}

function LabelsDialog({ topic, close }: { topic: Topic; close: () => void }) {
  const ed = useEditor.getState()
  const [value, setValue] = useState((topic.labels ?? []).join(', '))
  const save = () => {
    const labels = [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))]
    ed.setTopic(ed.selection.length ? ed.selection : [topic.id], { labels })
    close()
  }
  return (
    <Modal title="Метки" onClose={close}>
      <input autoFocus placeholder="Через запятую: срочно, клиент" value={value} onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()} />
      <div className="modal-actions"><div className="spacer" />
        <button onClick={close}>Отмена</button><button className="primary" onClick={save}>Сохранить</button></div>
    </Modal>
  )
}

function EquationDialog({ topic, close }: { topic: Topic; close: () => void }) {
  const ed = useEditor.getState()
  const [tex, setTex] = useState(topic.equation ?? 'E = mc^2')
  const html = useMemo(() => { try { return katex.renderToString(tex, { throwOnError: false, displayMode: true }) } catch (e) { return String(e) } }, [tex])
  const save = () => { ed.setTopic([topic.id], { equation: tex.trim() || undefined }); close() }
  return (
    <Modal title="Формула LaTeX" onClose={close}>
      <textarea autoFocus rows={4} value={tex} onChange={e => setTex(e.target.value)} style={{ fontFamily: 'monospace' }} />
      <div className="eq-preview" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="modal-actions">
        {topic.equation && <button className="danger" onClick={() => { ed.setTopic([topic.id], { equation: undefined }); close() }}>Удалить</button>}
        <div className="spacer" />
        <button onClick={close}>Отмена</button><button className="primary" onClick={save}>Сохранить</button></div>
    </Modal>
  )
}

function StickerDialog({ topic, close }: { topic: Topic; close: () => void }) {
  const ed = useEditor.getState()
  return (
    <Modal title="Стикер" onClose={close}>
      <div className="sticker-grid">
        {STICKERS.map(s => <button key={s} onClick={() => { ed.setTopic([topic.id], { image: { src: 'emoji:' + s, width: 56, height: 56 } }); close() }}>{s}</button>)}
      </div>
      <div className="modal-actions">
        {topic.image && <button className="danger" onClick={() => { ed.setTopic([topic.id], { image: undefined }); close() }}>Убрать изображение</button>}
        <div className="spacer" /><button onClick={close}>Закрыть</button></div>
    </Modal>
  )
}
