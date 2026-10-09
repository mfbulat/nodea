import { useEffect, useRef, useState } from 'react'
import { useEditor } from './store'
import Icon from '../ui/Icon'
import { pickFile, uploadToTopic } from './actions'
import { indexSheet } from './model'

interface Item { label: string; hint?: string; run: () => void; disabled?: boolean }

export default function InsertMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const id = selection[selection.length - 1]
  const none = !id
  const sheet = ed.sheet()
  const kind = id && sheet ? indexSheet(sheet).get(id)?.kind : undefined

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const items: (Item | '-')[] = [
    { label: 'Связь', hint: 'Ctrl+L', run: ed.startRelating, disabled: none },
    { label: 'Граница', hint: 'Ctrl+B', run: ed.addBoundary, disabled: none },
    { label: 'Сводка', hint: 'Ctrl+]', run: ed.addSummary, disabled: none || kind !== 'child' },
    { label: 'Выноска', run: ed.addCallout, disabled: none },
    '-',
    { label: 'Маркер…', run: () => ed.setPanel('markers'), disabled: none },
    { label: 'Стикер…', run: () => ed.setDialog({ kind: 'sticker', id }), disabled: none },
    { label: 'Метки…', run: () => ed.setDialog({ kind: 'labels', id }), disabled: none },
    { label: 'Заметка', hint: 'Ctrl+Shift+N', run: () => ed.setPanel('notes'), disabled: none },
    { label: 'Ссылка…', hint: 'Ctrl+K', run: () => ed.setDialog({ kind: 'link', id }), disabled: none },
    { label: 'Изображение…', run: async () => { const f = await pickFile('image/*'); if (f) uploadToTopic(id, f, 'image') }, disabled: none },
    { label: 'Вложение…', run: async () => { const f = await pickFile(); if (f) uploadToTopic(id, f, 'attachment') }, disabled: none },
    { label: 'Формула…', run: () => ed.setDialog({ kind: 'equation', id }), disabled: none },
    { label: 'Задача (чекбокс)', run: () => {
      const t = sheet && indexSheet(sheet).get(id)?.topic
      ed.setTopic(selection, { task: t?.task ? undefined : { done: false } })
    }, disabled: none },
    { label: 'Комментарий', run: () => ed.setPanel('comments'), disabled: none },
  ]

  return (
    <div className="menu-wrap" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className={'ibtn' + (open ? ' on' : '')} aria-label="Вставить" title="Вставить">
        <Icon name="plus" /><Icon name="chevron" size={12} /></button>
      {open && (
        <div className="menu right" role="menu">
          {items.map((it, i) => it === '-' ? <div key={i} className="menu-sep" /> : (
            <button key={i} role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.run() }}>
              <span>{it.label}</span>{it.hint && <kbd>{it.hint}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
