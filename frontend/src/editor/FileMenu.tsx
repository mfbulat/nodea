import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { MapFull } from '../api/types'
import { useDoc } from '../store/doc'
import { useEditor } from './store'
import { EXPORTS, ExportFormat, exportMap, IMPORT_ACCEPT, importFile } from '../io'
import { pickFile } from './actions'

/** Открыть файл как новую карту (общая логика для списка карт и редактора) */
export async function importAsNewMap(): Promise<string | null> {
  const file = await pickFile(IMPORT_ACCEPT)
  if (!file) return null
  const { title, document } = await importFile(file)
  const m = await api<MapFull>('/api/maps', { method: 'POST', json: { title, document } })
  return m.id
}

export default function FileMenu() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  async function run(label: string, fn: () => Promise<unknown>) {
    setOpen(false)
    setBusy(label)
    try { await fn() } catch (e) { alert(`${label}: ${(e as Error).message}`) } finally { setBusy('') }
  }

  const doExport = (fmt: ExportFormat) => run('Экспорт', async () => {
    await useDoc.getState().flush()
    const { doc, title } = useDoc.getState()
    const sheet = useEditor.getState().sheet()
    if (doc && sheet) await exportMap(fmt, doc, sheet, title)
  })

  return (
    <div className="menu-wrap" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className={open ? 'on' : ''} disabled={!!busy}>{busy ? busy + '…' : 'Файл ▾'}</button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={() => run('Импорт', async () => { const id = await importAsNewMap(); if (id) nav(`/map/${id}`) })}>
            <span>Открыть файл как новую карту…</span></button>
          <div className="menu-hint">.xmind, Markdown, OPML, FreeMind</div>
          <div className="menu-sep" />
          <div className="menu-hint">Экспорт</div>
          {EXPORTS.map(e => <button key={e.id} role="menuitem" onClick={() => doExport(e.id)}><span>{e.label}</span></button>)}
        </div>
      )}
    </div>
  )
}
