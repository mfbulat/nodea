import { useEffect, useRef, useState } from 'react'
import { useEditor } from './store'
import { indexSheet, type Sheet } from './model'
import { MARKER_GROUPS, MarkerIcon, markerName, STICKERS } from './markers'
import { useDoc } from '../store/doc'

function Header({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <h3 style={{ margin: 0 }}>{title}</h3><div className="spacer" />
      <button onClick={() => useEditor.getState().setPanel(null)} aria-label="Закрыть">×</button>
    </div>
  )
}

export function MarkersPanel({ sheet }: { sheet: Sheet }) {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const [tab, setTab] = useState<'markers' | 'stickers'>('markers')
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const id = selection[selection.length - 1]
  const current = new Set(id ? indexSheet(sheet).get(id)?.topic.markers ?? [] : [])
  const toggleGroup = (g: string) => setClosed(c => { const n = new Set(c); if (n.has(g)) n.delete(g); else n.add(g); return n })
  return (
    <div className="side-panel markers-panel" data-testid="markers-panel">
      <div className="seg-tabs">
        <button className={tab === 'markers' ? 'on' : ''} onClick={() => setTab('markers')}>Маркеры</button>
        <button className={tab === 'stickers' ? 'on' : ''} onClick={() => setTab('stickers')}>Стикеры</button>
      </div>
      {!id && <p className="muted">Выберите тему.</p>}
      {tab === 'markers' && MARKER_GROUPS.map(g => (
        <div key={g.id}>
          <button className="group-head" onClick={() => toggleGroup(g.id)}>
            <span className={'caret' + (closed.has(g.id) ? ' closed' : '')}>▾</span>{g.name}
          </button>
          {!closed.has(g.id) && <div className="marker-grid">
            {g.markers.map(m => (
              <button key={m} className={'marker-btn' + (current.has(m) ? ' on' : '')} title={markerName(m)} aria-label={markerName(m)} disabled={!id}
                onClick={() => ed.toggleMarker(m)}>
                <svg width={22} height={22}><MarkerIcon id={m} x={1} y={1} size={20} /></svg>
              </button>
            ))}
          </div>}
        </div>
      ))}
      {tab === 'stickers' && <div className="sticker-grid panel">
        {STICKERS.map(st => <button key={st} disabled={!id} onClick={() => ed.setTopic(selection, { image: { src: 'emoji:' + st, width: 56, height: 56 } })}>{st}</button>)}
      </div>}
    </div>
  )
}

export function NotesPanel({ sheet }: { sheet: Sheet }) {
  const { selection } = useEditor()
  const id = selection[selection.length - 1]
  const topic = id ? indexSheet(sheet).get(id)?.topic : undefined
  return (
    <div className="side-panel notes-panel" data-testid="notes-panel">
      <Header title="Заметка" />
      {!topic ? <p className="muted">Выберите тему.</p> : <NoteEditor key={topic.id} id={topic.id} html={topic.notes?.html ?? ''} />}
    </div>
  )
}

function NoteEditor({ id, html }: { id: string; html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => { ref.current!.innerHTML = html }, [])
  const save = () => {
    const el = ref.current
    if (!el) return
    const plain = el.innerText.trim()
    useEditor.getState().setTopic([id], { notes: plain || el.querySelector('img') ? { html: el.innerHTML, plain } : undefined })
  }
  const schedule = () => { clearTimeout(timer.current); timer.current = setTimeout(save, 500) }
  useEffect(() => () => { clearTimeout(timer.current); save() }, [])
  const cmd = (c: string, v?: string) => { ref.current!.focus(); document.execCommand(c, false, v); schedule() }
  return (
    <>
      <div className="note-toolbar">
        <button title="Жирный" onMouseDown={e => { e.preventDefault(); cmd('bold') }}><b>Ж</b></button>
        <button title="Курсив" onMouseDown={e => { e.preventDefault(); cmd('italic') }}><i>К</i></button>
        <button title="Подчёркнутый" onMouseDown={e => { e.preventDefault(); cmd('underline') }}><u>Ч</u></button>
        <button title="Зачёркнутый" onMouseDown={e => { e.preventDefault(); cmd('strikeThrough') }}><s>З</s></button>
        <button title="Заголовок" onMouseDown={e => { e.preventDefault(); cmd('formatBlock', 'h3') }}>H</button>
        <button title="Абзац" onMouseDown={e => { e.preventDefault(); cmd('formatBlock', 'p') }}>¶</button>
        <button title="Маркированный список" onMouseDown={e => { e.preventDefault(); cmd('insertUnorderedList') }}>•</button>
        <button title="Нумерованный список" onMouseDown={e => { e.preventDefault(); cmd('insertOrderedList') }}>1.</button>
        <button title="Ссылка" onMouseDown={e => { e.preventDefault(); const u = prompt('Адрес ссылки'); if (u) cmd('createLink', u) }}>🔗</button>
        <input type="color" title="Цвет текста" onChange={e => cmd('foreColor', e.target.value)} />
        <button title="Очистить форматирование" onMouseDown={e => { e.preventDefault(); cmd('removeFormat') }}>⌫</button>
      </div>
      <div ref={ref} className="note-editor" contentEditable suppressContentEditableWarning
        onInput={schedule} onBlur={save} onKeyDown={e => e.stopPropagation()} data-placeholder="Текст заметки…" />
    </>
  )
}

export function CommentsPanel({ sheet }: { sheet: Sheet }) {
  const { selection, userName } = useEditor()
  const ed = useEditor.getState()
  const [text, setText] = useState('')
  const id = selection[selection.length - 1]
  const topic = id ? indexSheet(sheet).get(id)?.topic : undefined
  const all = [...indexSheet(sheet).values()].filter(r => r.topic.comments?.length)
  const send = () => { if (text.trim() && id) { ed.addComment(id, text.trim()); setText('') } }
  return (
    <div className="side-panel" data-testid="comments-panel">
      <Header title="Комментарии" />
      {topic ? (
        <>
          <div className="muted" style={{ marginBottom: 6 }}>К теме «{topic.title}»</div>
          {(topic.comments ?? []).map(c => (
            <div key={c.id} className="comment">
              <div className="comment-head"><b>{c.author || 'Аноним'}</b>
                <span className="muted">{new Date(c.createdAt).toLocaleString('ru')}</span>
                {c.author === userName && <button className="mini" onClick={() => ed.removeComment(topic.id, c.id)} title="Удалить">×</button>}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
            </div>
          ))}
          <textarea rows={3} placeholder="Комментарий…" value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }} style={{ width: '100%' }} />
          <button className="primary" onClick={send} disabled={!text.trim()}>Добавить</button>
        </>
      ) : <p className="muted">Выберите тему.</p>}
      {all.length > 0 && <>
        <h4 className="panel-sub">Все темы с комментариями</h4>
        {all.map(r => <div key={r.topic.id}><button className="link-btn" onClick={() => ed.select([r.topic.id])}>
          {r.topic.title || '(без названия)'} — {r.topic.comments!.length}</button></div>)}
      </>}
    </div>
  )
}

const NO_SHEETS: Sheet[] = []

export function SheetTabs() {
  const active = useEditor(s => s.sheetId)
  const sheets = useDoc(s => s.doc?.sheets) ?? NO_SHEETS
  const ed = useEditor.getState()
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const current = active ?? sheets[0]?.id
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])
  const rename = (id: string, title: string) => { const t = prompt('Название листа', title)?.trim(); if (t) ed.renameSheet(id, t) }
  return (
    <div className="sheet-tabs" data-testid="sheet-tabs">
      {sheets.map(s => (
        <button key={s.id} className={'sheet-tab' + (s.id === current ? ' on' : '')}
          onClick={() => ed.setSheetId(s.id)} onDoubleClick={() => rename(s.id, s.title)}
          onContextMenu={e => { e.preventDefault(); setMenu({ id: s.id, x: e.clientX, y: e.clientY }) }}>{s.title}</button>
      ))}
      <button className="sheet-add" onClick={ed.addSheet} title="Новый лист">+</button>
      {menu && (
        <div className="menu" style={{ position: 'fixed', left: menu.x, bottom: window.innerHeight - menu.y + 4 }}
          onPointerDown={e => e.stopPropagation()}>
          {[
            ['Переименовать', () => rename(menu.id, sheets.find(s => s.id === menu.id)!.title)],
            ['Дублировать', () => ed.duplicateSheet(menu.id)],
            ['Сдвинуть влево', () => ed.moveSheet(menu.id, -1)],
            ['Сдвинуть вправо', () => ed.moveSheet(menu.id, 1)],
            ['Удалить', () => { if (sheets.length > 1 && confirm('Удалить лист?')) ed.removeSheet(menu.id) }],
          ].map(([l, fn]) => <button key={l as string} onClick={() => { setMenu(null); (fn as () => void)() }}
            disabled={l === 'Удалить' && sheets.length < 2}>{l as string}</button>)}
        </div>
      )}
    </div>
  )
}
