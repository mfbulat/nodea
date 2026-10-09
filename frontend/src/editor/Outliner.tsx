// Режим «Структура»: та же карта в виде списка. Изменения сразу видны и на карте.
import { useEffect, useMemo, useRef } from 'react'
import type { Sheet, Topic } from './model'
import { uid } from './model'
import { MarkerIcon } from './markers'
import { locate, useEditor } from './store'
import { displaySheet } from './MapCanvas'

interface Row { topic: Topic; depth: number; parentId: string | null; kind: string }

function rows(sheet: Sheet): Row[] {
  const out: Row[] = []
  const walk = (t: Topic, depth: number, parentId: string | null, kind: string) => {
    out.push({ topic: t, depth, parentId, kind })
    if (t.collapsed) return
    t.children?.forEach(c => walk(c, depth + 1, t.id, 'child'))
  }
  walk(sheet.rootTopic, 0, null, 'root')
  sheet.floatingTopics?.forEach(f => walk(f, 1, null, 'floating'))
  return out
}

export default function Outliner({ sheet: realSheet, readOnly = false }: { sheet: Sheet; readOnly?: boolean }) {
  const { selection, drillId } = useEditor()
  const ed = useEditor.getState
  const sheet = useMemo(() => displaySheet(realSheet, drillId), [realSheet, drillId])
  const list = useMemo(() => rows(sheet), [sheet])
  const inputs = useRef(new Map<string, HTMLTextAreaElement>())
  const focusNext = useRef<{ id: string; caret?: 'start' | 'end' } | null>(null)
  const current = selection[selection.length - 1]

  // фокус после структурных изменений (новая строка, сдвиг уровня)
  useEffect(() => {
    const f = focusNext.current
    if (!f) return
    const el = inputs.current.get(f.id)
    if (el) {
      el.focus()
      const pos = f.caret === 'start' ? 0 : el.value.length
      el.setSelectionRange(pos, pos)
      focusNext.current = null
    }
  })

  const focus = (id: string, caret: 'start' | 'end' = 'end') => { focusNext.current = { id, caret }; ed().select([id]) }
  const indexOf = (id: string) => list.findIndex(r => r.topic.id === id)

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>, row: Row) {
    e.stopPropagation()
    if (readOnly) {
      const i = indexOf(row.topic.id)
      if (e.key === 'ArrowUp' && list[i - 1]) { e.preventDefault(); focus(list[i - 1].topic.id) }
      if (e.key === 'ArrowDown' && list[i + 1]) { e.preventDefault(); focus(list[i + 1].topic.id) }
      return
    }
    const id = row.topic.id
    const el = e.currentTarget
    const mod = e.metaKey || e.ctrlKey
    const i = indexOf(id)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const t: Topic = { id: uid(), title: '', children: [] }
      // разбиваем строку по курсору, как в текстовых аутлайнерах
      const before = el.value.slice(0, el.selectionStart), after = el.value.slice(el.selectionEnd)
      ed().mutate(sh => {
        const l = locate(sh, id)!
        if (l.kind === 'root' || (l.topic.children?.length && !l.topic.collapsed)) {
          l.topic.title = before
          t.title = after
          ;(l.topic.children ??= []).unshift(t)
        } else {
          l.topic.title = before
          t.title = after
          if (l.floating) t.position = { x: (l.topic.position?.x ?? 0), y: (l.topic.position?.y ?? 0) + 50 }
          l.siblings.splice(l.index + 1, 0, t)
        }
      })
      focus(t.id, 'start')
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const l = locate(ed().sheet()!, id)
      if (!l || l.kind !== 'child' || l.index === 0) return
      ed().move([id], l.siblings[l.index - 1].id, 'child')
      focus(id)
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const sh = ed().sheet()!
      const l = locate(sh, id)
      if (!l || l.kind !== 'child' || !l.parent || l.parent.id === sh.rootTopic.id || l.parent.id === drillId) return
      ed().move([id], l.parent.id, 'after')
      focus(id)
    } else if (e.key === 'Backspace' && !el.value && row.kind !== 'root') {
      e.preventDefault()
      const prev = list[i - 1]?.topic.id
      ed().select([id])
      ed().removeSelected()
      if (prev) focus(prev)
    } else if (e.key === 'ArrowUp' && (e.altKey || !el.value.slice(0, el.selectionStart).includes('\n'))) {
      e.preventDefault()
      if (e.altKey) {
        const l = locate(ed().sheet()!, id)
        if (l && l.kind === 'child' && l.index > 0) { ed().move([id], l.siblings[l.index - 1].id, 'before'); focus(id) }
      } else if (list[i - 1]) focus(list[i - 1].topic.id)
    } else if (e.key === 'ArrowDown' && (e.altKey || !el.value.slice(el.selectionEnd).includes('\n'))) {
      e.preventDefault()
      if (e.altKey) {
        const l = locate(ed().sheet()!, id)
        if (l && l.kind === 'child' && l.index < l.siblings.length - 1) { ed().move([id], l.siblings[l.index + 1].id, 'after'); focus(id) }
      } else if (list[i + 1]) focus(list[i + 1].topic.id)
    } else if (mod && (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault()
      ed().select([id]); ed().toggleCollapse()
    } else if (mod && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
      e.preventDefault()
      if (e.shiftKey) ed().redo(); else ed().undo()
    }
  }

  return (
    <div className="outliner" data-testid="outliner">
      {list.map(row => {
        const t = row.topic
        const n = t.children?.length ?? 0
        return (
          <div key={t.id} className={'ol-row' + (current === t.id ? ' on' : '') + (row.kind === 'root' ? ' root' : '')}
            style={{ paddingLeft: 12 + row.depth * 22 }}>
            <button className="ol-toggle" disabled={!n || row.kind === 'root'} onClick={() => { ed().select([t.id]); ed().toggleCollapse() }}
              aria-label={t.collapsed ? 'Развернуть' : 'Свернуть'}>{n && row.kind !== 'root' ? (t.collapsed ? '▸' : '▾') : '•'}</button>
            {t.task && <input type="checkbox" checked={t.task.done} onChange={() => ed().toggleTask(t.id)} />}
            {t.markers?.map(m => <svg key={m} width={16} height={16} className="ol-marker"><MarkerIcon id={m} size={16} /></svg>)}
            <textarea rows={1} readOnly={readOnly} ref={el => { if (el) inputs.current.set(t.id, el); else inputs.current.delete(t.id) }}
              defaultValue={t.title} key={t.id + '|' + t.title} spellCheck={false}
              placeholder={row.kind === 'root' ? 'Центральная тема' : ''}
              onFocus={() => { if (current !== t.id) ed().select([t.id]) }}
              onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }}
              onBlur={e => { if (e.target.value !== t.title) ed().setTitle(t.id, e.target.value) }}
              onKeyDown={e => onKey(e, row)} />
            {t.collapsed && n > 0 && <span className="ol-count">{n}</span>}
            {t.labels?.map(l => <span key={l} className="ol-label">{l}</span>)}
            {t.notes?.plain && <span className="ol-note" title={t.notes.plain}>📝</span>}
          </div>
        )
      })}
      <p className="muted ol-hint">Enter — новая строка, Tab / Shift+Tab — уровень, Alt+↑/↓ — переместить, Backspace на пустой строке — удалить, Ctrl+/ — свернуть.</p>
    </div>
  )
}
