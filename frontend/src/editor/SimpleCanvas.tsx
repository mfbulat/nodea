// Временный холст этапа 1: показывает центральную тему и её подтемы, чтобы
// проверить сохранение. В этапе 2 заменяется полноценным движком раскладок.
import { useState } from 'react'
import type { MapDocument, Topic } from '../api/types'

const uid = () => Math.random().toString(36).slice(2, 14)

export default function SimpleCanvas({ doc, onChange }: { doc: MapDocument; onChange: (d: MapDocument) => void }) {
  const [sheetIdx] = useState(0)
  const root = doc.sheets[sheetIdx].rootTopic
  const children = root.children ?? []

  const update = (root: Topic) => {
    const sheets = doc.sheets.map((s, i) => (i === sheetIdx ? { ...s, rootTopic: root } : s))
    onChange({ ...doc, sheets })
  }
  const rename = (id: string, title: string) => update(id === root.id ? { ...root, title }
    : { ...root, children: children.map(c => (c.id === id ? { ...c, title } : c)) })
  const edit = (t: Topic) => {
    const title = prompt('Текст темы', t.title)
    if (title !== null) rename(t.id, title)
  }
  const add = () => update({ ...root, children: [...children, { id: uid(), title: `Тема ${children.length + 1}`, children: [] }] })
  const remove = (id: string) => update({ ...root, children: children.filter(c => c.id !== id) })

  const cx = 200, cy = 60 + Math.max(children.length, 1) * 25
  return (
    <div style={{ padding: 16 }}>
      <button onClick={add}>+ Подтема</button>
      <svg width="100%" height={cy * 2 + 40} style={{ fontFamily: 'var(--font-map)' }}>
        {children.map((c, i) => {
          const y = 40 + i * 50
          return (
            <g key={c.id}>
              <path d={`M${cx + 80},${cy} C${cx + 140},${cy} ${cx + 140},${y + 15} ${cx + 200},${y + 15}`}
                fill="none" stroke="var(--color-border)" strokeWidth={2} />
              <g onDoubleClick={() => edit(c)} style={{ cursor: 'pointer' }}>
                <rect x={cx + 200} y={y} width={160} height={30} rx={6} fill="var(--color-surface-2)" />
                <text x={cx + 280} y={y + 20} textAnchor="middle">{c.title}</text>
              </g>
              <text x={cx + 370} y={y + 20} fill="var(--color-danger)" style={{ cursor: 'pointer' }}
                onClick={() => remove(c.id)}>×</text>
            </g>
          )
        })}
        <g onDoubleClick={() => edit(root)} style={{ cursor: 'pointer' }}>
          <rect x={cx - 80} y={cy - 22} width={160} height={44} rx={10} fill="var(--color-accent)" />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--color-accent-contrast)" fontWeight={600}>{root.title}</text>
        </g>
      </svg>
      <p className="muted">Двойной щелчок — правка текста. Полноценный редактор — этап 2.</p>
    </div>
  )
}
