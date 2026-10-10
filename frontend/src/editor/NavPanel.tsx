// Левая навигационная панель как в веб-версии: «Структура», «Заметки», «Теги», «Ресурсы».
// Сверху — поиск с настройками (найти / найти и заменить, текущая карта / весь файл,
// целые слова, учёт регистра, где искать: темы, заметки, связи, границы, метки, ссылки).
import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { useEditor } from './store'
import { useDoc } from '../store/doc'
import { indexSheet, type MapDocument, type Sheet, type Topic } from './model'
import { canvasApi } from './MapCanvas'
import { MarkerIcon, markerName } from './markers'
import Icon from '../ui/Icon'

type Kind = 'topic' | 'note' | 'relationship' | 'boundary' | 'label' | 'link'
export interface SearchOpts { replace: boolean; file: boolean; whole: boolean; matchCase: boolean; kinds: Kind[] }
export const useSearchOpts = create<SearchOpts>(() => ({ replace: false, file: false, whole: false, matchCase: false, kinds: ['topic', 'note', 'relationship', 'boundary', 'label', 'link'] }))
const KIND_NAMES: [Kind, string][] = [['topic', 'Topic'], ['note', 'Note'], ['relationship', 'Relationship'], ['boundary', 'Boundary'], ['label', 'Label'], ['link', 'Link']]

export interface Hit { sheetId: string; kind: Kind; id: string; text: string; topicId?: string; depth: number }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function searchRegex(q: string, o: Pick<SearchOpts, 'whole' | 'matchCase'>, global = false) {
  const body = o.whole ? `(?<![\\p{L}\\p{N}_])${esc(q)}(?![\\p{L}\\p{N}_])` : esc(q)
  return new RegExp(body, 'u' + (o.matchCase ? '' : 'i') + (global ? 'g' : ''))
}

/** Поиск по документу с учётом настроек */
export function searchDoc(doc: MapDocument, sheetId: string, q: string, o: SearchOpts): Hit[] {
  if (!q.trim()) return []
  const re = searchRegex(q, o)
  const out: Hit[] = []
  for (const sh of doc.sheets) {
    if (!o.file && sh.id !== sheetId) continue
    for (const r of indexSheet(sh).values()) {
      const t = r.topic
      const depth = r.depth
      if (o.kinds.includes('topic') && re.test(t.title)) out.push({ sheetId: sh.id, kind: 'topic', id: t.id, topicId: t.id, text: t.title, depth })
      if (o.kinds.includes('note') && t.notes?.plain && re.test(t.notes.plain)) out.push({ sheetId: sh.id, kind: 'note', id: t.id, topicId: t.id, text: t.notes.plain, depth })
      if (o.kinds.includes('label')) for (const l of t.labels ?? []) if (re.test(l)) out.push({ sheetId: sh.id, kind: 'label', id: t.id, topicId: t.id, text: l, depth })
      if (o.kinds.includes('link') && t.href && re.test(t.href)) out.push({ sheetId: sh.id, kind: 'link', id: t.id, topicId: t.id, text: t.href, depth })
      if (o.kinds.includes('boundary')) for (const b of t.boundaries ?? []) if (b.title && re.test(b.title)) out.push({ sheetId: sh.id, kind: 'boundary', id: b.id, topicId: t.id, text: b.title, depth })
    }
    if (o.kinds.includes('relationship')) for (const rel of sh.relationships ?? []) if (rel.title && re.test(rel.title)) out.push({ sheetId: sh.id, kind: 'relationship', id: rel.id, topicId: rel.end1, text: rel.title, depth: 1 })
  }
  return out
}

/** Замена: в одном найденном месте или во всех (с учётом области и типов) */
export function replaceInDoc(d: MapDocument, sheetId: string, q: string, rep: string, o: SearchOpts, only?: Hit): number {
  const re = searchRegex(q, o, true)
  let n = 0
  const sub = (s: string) => s.replace(re, () => { n++; return rep })
  const want = (sh: Sheet, kind: Kind, id: string) => (only ? only.sheetId === sh.id && only.kind === kind && only.id === id : o.kinds.includes(kind))
  for (const sh of d.sheets) {
    if (!only && !o.file && sh.id !== sheetId) continue
    for (const r of indexSheet(sh).values()) {
      const t = r.topic
      if (want(sh, 'topic', t.id)) t.title = sub(t.title)
      if (t.notes && want(sh, 'note', t.id)) {
        const before = n
        if (t.notes.plain) t.notes.plain = sub(t.notes.plain)
        if (t.notes.html) { const k = n; t.notes.html = t.notes.html.replace(/>([^<]*)</g, (_, txt) => '>' + sub(txt) + '<'); n = Math.max(k, before + (n - k)) }
      }
      if (t.labels && want(sh, 'label', t.id)) t.labels = t.labels.map(sub)
      if (t.href && want(sh, 'link', t.id)) t.href = sub(t.href)
      for (const b of t.boundaries ?? []) if (b.title && want(sh, 'boundary', b.id)) b.title = sub(b.title)
    }
    for (const rel of sh.relationships ?? []) if (rel.title && want(sh, 'relationship', rel.id)) rel.title = sub(rel.title)
  }
  return n
}

function Highlight({ text, q, o }: { text: string; q: string; o: SearchOpts }) {
  if (!q) return <>{text}</>
  const re = searchRegex(q, o, true)
  const parts: (string | JSX.Element)[] = []
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text)) && i < 50) {
    parts.push(text.slice(last, m.index), <mark key={i++}>{m[0]}</mark>)
    last = m.index + m[0].length
    if (!m[0].length) re.lastIndex++
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

function goTo(sheetId: string, topicId?: string, element?: { kind: 'relationship' | 'boundary'; id: string }) {
  const ed = useEditor.getState()
  if (ed.sheet()?.id !== sheetId) ed.setSheetId(sheetId)
  setTimeout(() => {
    if (element) ed.selectElement(element)
    else if (topicId) { ed.revealTopic(topicId); ed.select([topicId]) }
    if (topicId) canvasApi.center(topicId)
  }, 30)
}

function SearchSettings({ onClose }: { onClose: () => void }) {
  const o = useSearchOpts()
  const set = (p: Partial<SearchOpts>) => useSearchOpts.setState(p)
  const item = (label: string, on: boolean, fn: () => void) => (
    <button role="menuitemcheckbox" aria-checked={on} onClick={fn}><span className="mi-check">{on && <svg width={14} height={14} viewBox="0 0 14 14"><path d="M3 7.2l2.6 2.6L11 4.4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>{label}</button>
  )
  return (
    <div className="menu nav-settings" role="menu" onPointerDown={e => e.stopPropagation()}>
      {item('Find', !o.replace, () => { set({ replace: false }); onClose() })}
      {item('Find & Replace', o.replace, () => { set({ replace: true }); onClose() })}
      <div className="menu-sep" />
      {item('Current Sheet', !o.file, () => set({ file: false }))}
      {item('Entire File', o.file, () => set({ file: true }))}
      <div className="menu-sep" />
      {item('Whole Words', o.whole, () => set({ whole: !o.whole }))}
      {item('Match Case', o.matchCase, () => set({ matchCase: !o.matchCase }))}
      <div className="menu-sep" />
      {KIND_NAMES.map(([k, n]) => item(n, o.kinds.includes(k), () => set({ kinds: o.kinds.includes(k) ? o.kinds.filter(x => x !== k) : [...o.kinds, k] })))}
    </div>
  )
}

function Empty({ icon, text }: { icon: JSX.Element; text: string }) {
  return <div className="nav-empty">{icon}<span>{text}</span></div>
}

const NOTE_ICON = <svg width={64} height={64} viewBox="0 0 64 64" fill="none" stroke="#a9aeb3" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round"><path d="M44 10H14a4 4 0 00-4 4v36a4 4 0 004 4h36a4 4 0 004-4V30" /><path d="M20 26h16M20 36h12M48 8l8 8-20 20-10 2 2-10z" /></svg>
const TAG_ICON = <svg width={64} height={64} viewBox="0 0 64 64" fill="none" stroke="#a9aeb3" strokeWidth={4.5} strokeLinejoin="round"><path d="M34 8h18a4 4 0 014 4v18L30 56a4 4 0 01-5.6 0L8 39.6A4 4 0 018 34z" /><circle cx={44} cy={20} r={4} /></svg>
const FIND_ICON = <svg width={64} height={64} viewBox="0 0 64 64" fill="none" stroke="#a9aeb3" strokeWidth={5} strokeLinecap="round"><circle cx={28} cy={28} r={18} /><path d="M41 41l15 15" /></svg>

export default function NavPanel({ sheet }: { sheet: Sheet }) {
  const { nav } = useEditor()
  const doc = useDoc(s => s.doc)
  const ed = useEditor.getState()
  const o = useSearchOpts()
  const [q, setQ] = useState('')
  const [rep, setRep] = useState('')
  const [settings, setSettings] = useState(false)
  const [res, setRes] = useState<'all' | 'files' | 'media' | 'links'>('all')
  const [msg, setMsg] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => (doc ? searchDoc(doc, sheet.id, q, o) : []), [doc, sheet.id, q, o])

  // подсветка найденных тем на холсте
  useEffect(() => {
    const ids = [...new Set(hits.filter(h => h.sheetId === sheet.id && h.topicId).map(h => h.topicId!))]
    useEditor.setState(s => ({ search: { ...s.search, open: !!q, query: q, hits: ids, index: 0 } }))
  }, [hits, q, sheet.id])
  useEffect(() => () => useEditor.setState(s => ({ search: { ...s.search, open: false, query: '', hits: [] } })), [])
  useEffect(() => {
    if (!settings) return
    const close = () => setSettings(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [settings])
  useEffect(() => { if (nav === 'outline') input.current?.focus() }, [nav])
  if (!nav || !doc) return null

  const idx = indexSheet(sheet)
  const all = [...idx.values()]
  const tabs: [NonNullable<typeof nav>, string][] = [['outline', 'Topic'], ['notes', 'Note'], ['tags', 'Marker & Label'], ['resources', 'Resources']]
  const doReplace = (only?: Hit) => {
    let n = 0
    ed.mutateDocument(d => { n = replaceInDoc(d, sheet.id, q, rep, o, only) })
    setMsg(n ? `Replaced: ${n}` : 'No matches')
  }

  const searchBox = (
    <div className="nav-find" onKeyDown={e => e.stopPropagation()}>
      <div className="nav-input">
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><circle cx={7} cy={7} r={4.6} /><path d="M10.5 10.5l3 3" /></svg>
        <input ref={input} placeholder="Find" aria-label="Find" value={q} onChange={e => { setQ(e.target.value); setMsg('') }}
          onKeyDown={e => { if (e.key === 'Enter' && hits[0]) goTo(hits[0].sheetId, hits[0].topicId) ; if (e.key === 'Escape') { setQ(''); canvasApi.focus() } }} />
        {q && <button className="nav-clear" aria-label="Clear" onClick={() => setQ('')}><Icon name="close" size={9} /></button>}
      </div>
      <div className="nav-gear-wrap">
        <button className={'ibtn' + (settings ? ' on' : '')} aria-label="Search options" onPointerDown={e => e.stopPropagation()} onClick={() => setSettings(s => !s)}>
          <Icon name="settings" size={18} />
        </button>
        {settings && <SearchSettings onClose={() => setSettings(false)} />}
      </div>
      {o.replace && (
        <div className="nav-replace">
          <input placeholder="Replace with" aria-label="Replace with" value={rep} onChange={e => setRep(e.target.value)} />
          <button disabled={!hits.length} onClick={() => doReplace(hits[0])}>Replace</button>
          <button disabled={!hits.length} onClick={() => doReplace()}>Replace All</button>
        </div>
      )}
      {msg && <div className="nav-msg">{msg}</div>}
    </div>
  )

  const results = (
    <div className="nav-results" data-testid="nav-results">
      {hits.map((h, i) => {
        const sh = doc.sheets.find(s => s.id === h.sheetId)
        return (
          <button key={i} className="nav-row hit" onClick={() => goTo(h.sheetId, h.topicId, h.kind === 'relationship' || h.kind === 'boundary' ? { kind: h.kind, id: h.id } : undefined)}>
            <i className="nav-bullet" />
            <span className="nav-text"><Highlight text={h.text.length > 120 ? h.text.slice(0, 120) + '…' : h.text} q={q} o={o} /></span>
            {(h.kind !== 'topic' || (o.file && doc.sheets.length > 1)) && <em className="nav-kind">{h.kind !== 'topic' ? KIND_NAMES.find(k => k[0] === h.kind)![1] : ''}{o.file && doc.sheets.length > 1 ? ` · ${sh?.title}` : ''}</em>}
          </button>
        )
      })}
      {!hits.length && <Empty icon={FIND_ICON} text="No results found." />}
    </div>
  )

  const tree = (t: Topic, depth: number): JSX.Element => (
    <div key={t.id}>
      <button className={'nav-row d' + Math.min(depth, 2)} style={{ paddingLeft: depth ? 20 + (depth - 1) * 20 : 0 }} onClick={() => goTo(sheet.id, t.id)}>
        {depth > 0 && <i className="nav-bullet" />}<span className="nav-text">{t.title || '(Untitled)'}</span>
      </button>
      {(t.children ?? []).map(c => tree(c, depth + 1))}
    </div>
  )

  const notes = all.filter(r => r.topic.notes?.plain?.trim() || r.topic.notes?.html)
  const markerUse = new Map<string, string[]>(), labelUse = new Map<string, string[]>()
  for (const r of all) {
    for (const m of r.topic.markers ?? []) markerUse.set(m, [...(markerUse.get(m) ?? []), r.topic.id])
    for (const l of r.topic.labels ?? []) labelUse.set(l, [...(labelUse.get(l) ?? []), r.topic.id])
  }
  type Res = { kind: 'files' | 'media' | 'links'; name: string; topic: Topic; icon: string }
  const resources: Res[] = []
  for (const r of all) {
    const t = r.topic
    if (t.attachment) resources.push({ kind: 'files', name: t.attachment.name, topic: t, icon: 'attach' })
    if (t.image && !t.image.src.startsWith('emoji:')) resources.push({ kind: 'media', name: t.title || 'Image', topic: t, icon: 'image' })
    if (t.audio) resources.push({ kind: 'media', name: `Audio Note · ${Math.round(t.audio.duration)} s`, topic: t, icon: 'mic' })
    if (t.href) resources.push({ kind: 'links', name: t.href, topic: t, icon: 'link' })
  }
  const shownRes = resources.filter(x => (res === 'all' || x.kind === res) && (!q || searchRegex(q, o).test(x.name + ' ' + x.topic.title)))
  const notesShown = notes.filter(r => !q || searchRegex(q, o).test(r.topic.title + ' ' + (r.topic.notes?.plain ?? '')))

  return (
    <div className="nav-panel" data-testid="nav-panel" onKeyDown={e => e.stopPropagation()}>
      <div className="nav-head">
        <div className="nav-tabs" role="tablist">
          {tabs.map(([k, n]) => <button key={k} role="tab" aria-selected={nav === k} className={nav === k ? 'on' : ''} onClick={() => ed.setNav(k)}>{n}</button>)}
        </div>
        <button className="tk-x" aria-label="Close navigation panel" onClick={() => ed.setNav(null)}><Icon name="close" size={12} /></button>
      </div>
      {nav !== 'tags' && searchBox}
      {nav === 'resources' && (
        <div className="nav-seg">
          {([['all', 'All'], ['files', 'Files'], ['media', 'Media'], ['links', 'Links']] as const).map(([k, n]) => <button key={k} className={res === k ? 'on' : ''} onClick={() => setRes(k)}>{n}</button>)}
        </div>
      )}
      <div className="nav-body">
        {nav === 'outline' && (q ? results : <div className="nav-tree">{tree(sheet.rootTopic, 0)}</div>)}
        {nav === 'notes' && (notesShown.length ? notesShown.map(r => (
          <button key={r.topic.id} className="nav-note" onClick={() => goTo(sheet.id, r.topic.id)}>
            <b><Highlight text={r.topic.title} q={q} o={o} /></b>
            <span><Highlight text={(r.topic.notes?.plain ?? '').slice(0, 200)} q={q} o={o} /></span>
          </button>
        )) : <Empty icon={NOTE_ICON} text={q ? 'No results found.' : 'No notes.'} />)}
        {nav === 'tags' && (markerUse.size || labelUse.size ? <>
          {[...markerUse].map(([m, ids]) => (
            <button key={m} className="nav-tag" onClick={() => { ed.select(ids); canvasApi.center(ids[0]) }}>
              <svg width={18} height={18}><MarkerIcon id={m} size={18} /></svg><span>{markerName(m)}</span><em>{ids.length}</em>
            </button>
          ))}
          {[...labelUse].map(([l, ids]) => (
            <button key={'l' + l} className="nav-tag" onClick={() => { ed.select(ids); canvasApi.center(ids[0]) }}>
              <span className="nav-label">{l}</span><em>{ids.length}</em>
            </button>
          ))}
        </> : <Empty icon={TAG_ICON} text="No markers or labels." />)}
        {nav === 'resources' && (shownRes.length ? shownRes.map((x, i) => (
          <button key={i} className="nav-res" onClick={() => goTo(sheet.id, x.topic.id)}>
            <Icon name={x.icon as 'link'} size={16} /><span className="nav-text">{x.name}</span><em>{x.topic.title}</em>
          </button>
        )) : <Empty icon={FIND_ICON} text="No attachments, images, audio notes or links." />)}
      </div>
    </div>
  )
}
