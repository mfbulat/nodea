import { useEffect, useRef, useState } from 'react'
import { useEditor } from './store'
import { indexSheet, type Sheet } from './model'
import { MARKER_GROUPS, MarkerIcon, markerName, STICKER_CATEGORIES } from './markers'
import { useDoc } from '../store/doc'
import { MenuItem } from './Chrome'
import { api } from '../api/client'
import { ILLUSTRATION_CATEGORIES, ILLUSTRATIONS, illustrationSrc } from './illustrations'

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
  const tab = useEditor(st => st.markerTab)
  const setTab = useEditor.getState().setMarkerTab
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [cat, setCat] = useState('')
  useEffect(() => setCat(''), [tab])
  const id = selection[selection.length - 1]
  const current = new Set(id ? indexSheet(sheet).get(id)?.topic.markers ?? [] : [])
  const toggleGroup = (g: string) => setClosed(c => { const n = new Set(c); if (n.has(g)) n.delete(g); else n.add(g); return n })
  return (
    <div className="side-panel markers-panel" data-testid="markers-panel">
      <div className="seg-tabs">
        <button className={tab === 'markers' ? 'on' : ''} onClick={() => setTab('markers')}>Маркер</button>
        <button className={tab === 'stickers' ? 'on' : ''} onClick={() => setTab('stickers')}>Стикер</button>
        <button className={tab === 'illustrations' ? 'on' : ''} onClick={() => setTab('illustrations')}>Иллюстрация</button>
      </div>
      {tab === 'markers' && <button className="wide legend-btn" onClick={() => ed.setSheet({ legend: !sheet.legend })}>
        {sheet.legend ? 'Скрыть легенду' : 'Показать легенду'}</button>}
      {!id && <p className="muted">Выберите тему.</p>}
      {tab === 'markers' && MARKER_GROUPS.map(g => (
        <div key={g.id}>
          <button className="group-head" onClick={() => toggleGroup(g.id)}>
            <span className={'caret' + (closed.has(g.id) ? ' closed' : '')}><svg width={8} height={8}><path d="M0,1.5L8,1.5L4,6.5Z" fill="currentColor" /></svg></span>{g.name}
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
      {tab !== 'markers' && (
        <div className="cat-row"><span>Категория</span><div className="spacer" />
          <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Категория">
            <option value="">Все</option>
            {(tab === 'stickers' ? STICKER_CATEGORIES.map(c => c.name) : [...ILLUSTRATION_CATEGORIES]).map(n => <option key={n} value={n}>{n}</option>)}
          </select></div>
      )}
      {tab === 'stickers' && STICKER_CATEGORIES.filter(c => !cat || c.name === cat).map(c => (
        <div key={c.name}>
          <button className="group-head" onClick={() => toggleGroup('s:' + c.name)}>
            <span className={'caret' + (closed.has('s:' + c.name) ? ' closed' : '')}><svg width={8} height={8}><path d="M0,1.5L8,1.5L4,6.5Z" fill="currentColor" /></svg></span>{c.name}
          </button>
          {!closed.has('s:' + c.name) && <div className="sticker-grid panel">
            {c.items.map(st => <button key={st} disabled={!id} aria-label={'Стикер ' + st} onClick={() => ed.setTopic(selection, { image: { src: 'emoji:' + st, width: 56, height: 56 } })}>{st}</button>)}
          </div>}
        </div>
      ))}
      {tab === 'illustrations' && ILLUSTRATION_CATEGORIES.filter(c => !cat || c === cat).map(c => (
        <div key={c}>
          <button className="group-head" onClick={() => toggleGroup('i:' + c)}>
            <span className={'caret' + (closed.has('i:' + c) ? ' closed' : '')}><svg width={8} height={8}><path d="M0,1.5L8,1.5L4,6.5Z" fill="currentColor" /></svg></span>{c}
          </button>
          {!closed.has('i:' + c) && <div className="illus-grid">
            {ILLUSTRATIONS.filter(il => il.category === c).map(il => <button key={il.id} disabled={!id} title={il.name} aria-label={'Иллюстрация ' + il.name}
              onClick={() => ed.setTopic(selection, { image: { src: illustrationSrc(il.svg), width: 120, height: 90 } })}>
              <img src={illustrationSrc(il.svg)} alt="" /></button>)}
          </div>}
        </div>
      ))}
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

const NO_SHEETS: Sheet[] = []

export function SheetTabs() {
  const active = useEditor(s => s.sheetId)
  const sheets = useDoc(s => s.doc?.sheets) ?? NO_SHEETS
  const mapId = useDoc(s => s.mapId)
  const role = useDoc(s => s.role)
  const ed = useEditor.getState()
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const current = active ?? sheets[0]?.id
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])
  const rename = (id: string, title: string) => { const t = prompt('Название листа', title)?.trim(); if (t) ed.renameSheet(id, t) }
  const editable = role !== 'view'
  const items = (id: string) => {
    const sh = sheets.find(x => x.id === id)!
    const run = (fn: () => void) => () => { setMenu(null); fn() }
    return <>
      <i className="mm-main" hidden />
      <MenuItem icon="link" label="Копировать ссылку" disabled={!mapId} onClick={run(() => navigator.clipboard?.writeText(`${location.origin}/map/${mapId}?sheet=${id}`).catch(() => {}))} />
      {editable && <>
        <div className="menu-sep" />
        <MenuItem icon="edit" label="Переименовать" onClick={run(() => rename(id, sh.title))} />
        <MenuItem icon="duplicate" label="Дублировать" onClick={run(() => ed.duplicateSheet(id))} />
        <div className="menu-sep" />
        <MenuItem icon="trash" label="Удалить" disabled={sheets.length < 2} onClick={run(() => { if (confirm('Удалить лист?')) ed.removeSheet(id) })} />
        <div className="menu-sep" />
        <MenuItem icon="file" label="Сохранить лист как карту" onClick={run(async () => {
          const m = await api<{ id: string }>('/api/maps', { method: 'POST', json: { title: sh.title, document: { version: 1, sheets: [structuredClone(sh)] } } })
          window.open(`/map/${m.id}`, '_blank')
        })} />
      </>}
    </>
  }
  return (
    <div className="sheet-tabs" data-testid="sheet-tabs">
      {sheets.map((s, i) => (
        <div key={s.id} className={'sheet-tab' + (s.id === current ? ' on' : '') + (dragId && dragId !== s.id ? ' drop' : '')}
          draggable={editable} onDragStart={e => { setDragId(s.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragId(null)}
          onDragOver={e => { if (dragId) e.preventDefault() }}
          onDrop={e => { e.preventDefault(); if (dragId && dragId !== s.id) ed.moveSheet(dragId, i - sheets.findIndex(x => x.id === dragId)); setDragId(null) }}
          onContextMenu={e => { e.preventDefault(); setMenu({ id: s.id, x: e.clientX, y: e.clientY }) }}>
          <button className="sheet-name" onClick={() => ed.setSheetId(s.id)} onDoubleClick={() => editable && rename(s.id, s.title)}>{s.title}</button>
          <button className="sheet-more" aria-label={`Меню листа ${s.title}`} onClick={e => { const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); setMenu(m => (m?.id === s.id ? null : { id: s.id, x: r.left, y: r.top })) }}>
            <svg width={10} height={10} viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.2} /></svg>
          </button>
        </div>
      ))}
      {editable && <button className="sheet-add" onClick={ed.addSheet} title="Новый лист" aria-label="Новый лист">+</button>}
      {menu && sheets.some(x => x.id === menu.id) && (
        <div ref={menuRef} className="menu" role="menu" style={{ position: 'fixed', left: menu.x, bottom: window.innerHeight - menu.y + 6, top: 'auto', zIndex: 1000 }}>
          {items(menu.id)}
        </div>
      )}
    </div>
  )
}

/** Легенда: маркеры, использованные на листе, с редактируемыми подписями */
export function Legend({ sheet, readOnly }: { sheet: Sheet; readOnly: boolean }) {
  const ed = useEditor.getState()
  if (!sheet.legend) return null
  const used = [...new Set([...indexSheet(sheet).values()].flatMap(r => r.topic.markers ?? []))]
  return (
    <div className="island legend" data-testid="legend">
      <div className="legend-head"><b>Легенда</b>
        {!readOnly && <button className="ibtn" aria-label="Скрыть легенду" onClick={() => ed.setSheet({ legend: false })}>×</button>}</div>
      {!used.length && <span className="muted">Маркеров пока нет</span>}
      {used.map(m => (
        <div key={m} className="legend-row">
          <svg width={18} height={18}><MarkerIcon id={m} x={1} y={1} size={16} /></svg>
          <input value={sheet.markerNames?.[m] ?? markerName(m)} readOnly={readOnly} aria-label="Подпись маркера"
            onChange={e => ed.setSheet({ markerNames: { ...(sheet.markerNames ?? {}), [m]: e.target.value } })}
            onKeyDown={e => e.stopPropagation()} />
        </div>
      ))}
    </div>
  )
}
