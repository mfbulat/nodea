import { useMemo } from 'react'
import type { Sheet } from './model'
import { indexSheet } from './model'
import { MarkerIcon, markerName } from './markers'
import { useEditor } from './store'

export default function FilterPanel({ sheet }: { sheet: Sheet }) {
  const { filter } = useEditor()
  const ed = useEditor.getState()
  const { markers, labels } = useMemo(() => {
    const m = new Map<string, number>(), l = new Map<string, number>()
    for (const r of indexSheet(sheet).values()) {
      r.topic.markers?.forEach(x => m.set(x, (m.get(x) ?? 0) + 1))
      r.topic.labels?.forEach(x => l.set(x, (l.get(x) ?? 0) + 1))
    }
    return { markers: [...m], labels: [...l] }
  }, [sheet])
  const cur = filter ?? { markers: [], labels: [] }
  const toggle = (kind: 'markers' | 'labels', v: string) => {
    const list = cur[kind].includes(v) ? cur[kind].filter(x => x !== v) : [...cur[kind], v]
    ed.setFilter({ ...cur, [kind]: list })
  }
  return (
    <div className="side-panel" data-testid="filter-panel">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Filter</h3><div className="spacer" />
        <button onClick={() => ed.setPanel(null)} aria-label="Close">×</button>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Topics without the selected markers and labels are dimmed.</p>
      <h4 className="panel-sub">Markers</h4>
      {!markers.length && <p className="muted">No markers on this sheet.</p>}
      {markers.map(([m, n]) => (
        <label key={m} className="fp-check">
          <input type="checkbox" checked={cur.markers.includes(m)} onChange={() => toggle('markers', m)} />
          <svg width={16} height={16}><MarkerIcon id={m} size={16} /></svg> {markerName(m)} <span className="muted">({n})</span>
        </label>
      ))}
      <h4 className="panel-sub">Labels</h4>
      {!labels.length && <p className="muted">No labels on this sheet.</p>}
      {labels.map(([l, n]) => (
        <label key={l} className="fp-check">
          <input type="checkbox" checked={cur.labels.includes(l)} onChange={() => toggle('labels', l)} />
          <span className="ol-label">{l}</span> <span className="muted">({n})</span>
        </label>
      ))}
      {filter && <button style={{ marginTop: 12 }} onClick={() => ed.setFilter(null)}>Reset Filter</button>}
    </div>
  )
}
