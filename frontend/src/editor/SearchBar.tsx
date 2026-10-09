import { useEffect, useRef, useState } from 'react'
import { useEditor } from './store'
import { canvasApi } from './MapCanvas'

export default function SearchBar() {
  const { search } = useEditor()
  const ed = useEditor.getState
  const ref = useRef<HTMLInputElement>(null)
  const [replace, setReplace] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (search.open) { ref.current?.focus(); ref.current?.select() } }, [search.open])
  if (!search.open) return null
  const go = (delta: number) => {
    const n = search.hits.length
    if (!n) return
    const index = (search.index + delta + n) % n
    ed().setSearch({ index })
    setTimeout(() => canvasApi.center(search.hits[index]), 30)
  }
  const close = () => { ed().setSearch({ open: false }); canvasApi.focus() }
  return (
    <div className="search-bar" data-testid="search-bar" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') close() }}>
      <input ref={ref} placeholder="Поиск по темам, заметкам и меткам" value={search.query}
        onChange={e => { ed().setSearch({ query: e.target.value }); setMsg('') }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1) } }} />
      <span className="muted">{search.hits.length ? `${search.index + 1} из ${search.hits.length}` : search.query ? 'нет' : ''}</span>
      <button className="mini" onClick={() => go(-1)} title="Предыдущий (Shift+Enter)">↑</button>
      <button className="mini" onClick={() => go(1)} title="Следующий (Enter)">↓</button>
      <button className={'mini' + (showReplace ? ' on' : '')} onClick={() => setShowReplace(v => !v)} title="Замена">⇄</button>
      {showReplace && <>
        <input placeholder="Заменить на" value={replace} onChange={e => setReplace(e.target.value)} />
        <button className="mini" onClick={() => setMsg(`Заменено: ${ed().replaceAll(search.query, replace)}`)}>Заменить все</button>
      </>}
      {msg && <span className="muted">{msg}</span>}
      <button className="mini" onClick={close} aria-label="Закрыть">×</button>
    </div>
  )
}
