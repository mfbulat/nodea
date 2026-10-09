// Задачи и диаграмма Ганта (как в веб-версии): у темы — сведения о задаче,
// отдельное окно с таблицей задач и шкалой дней; полосы перетаскиваются и растягиваются.
import { useMemo, useRef, useState } from 'react'
import type { Sheet, Topic } from './model'
import { indexSheet } from './model'
import { useEditor } from './store'
import Icon from '../ui/Icon'

type Info = NonNullable<Topic['taskInfo']>
const DAY = 86400000
export const toDay = (iso?: string) => (iso ? Math.floor(new Date(iso + 'T00:00:00').getTime() / DAY) : NaN)
export const fromDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10)
const today = () => Math.floor(Date.now() / DAY - new Date().getTimezoneOffset() / 1440)

export function TaskDialog({ sheet }: { sheet: Sheet }) {
  const { taskDialog } = useEditor()
  const ed = useEditor.getState()
  const idx = indexSheet(sheet)
  const ref = taskDialog ? idx.get(taskDialog) : undefined
  const [info, setInfo] = useState<Info>(() => ref?.topic.taskInfo ?? { start: fromDay(today()), end: fromDay(today() + 2), progress: 0 })
  if (!taskDialog || !ref) return null
  const close = () => ed.setTaskDialog(null)
  const save = () => { ed.setTopic([taskDialog], { taskInfo: info }); close() }
  const dur = Math.max(1, toDay(info.end) - toDay(info.start) + 1)
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) close() }} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') close() }}>
      <div className="modal task-modal" role="dialog" aria-label="Задача">
        <h3 style={{ margin: 0 }}>Задача: {ref.topic.title}</h3>
        <div className="task-grid">
          <label>Начало<input type="date" value={info.start ?? ''} onChange={e => setInfo({ ...info, start: e.target.value })} /></label>
          <label>Окончание<input type="date" value={info.end ?? ''} onChange={e => setInfo({ ...info, end: e.target.value })} /></label>
          <label>Длительность, дн.<input type="number" min={1} value={Number.isFinite(dur) ? dur : 1}
            onChange={e => setInfo({ ...info, end: fromDay(toDay(info.start) + Math.max(1, +e.target.value) - 1) })} /></label>
          <label>Прогресс, %<input type="number" min={0} max={100} step={5} value={info.progress ?? 0} onChange={e => setInfo({ ...info, progress: Math.min(100, Math.max(0, +e.target.value)) })} /></label>
          <label>Исполнитель<input value={info.assignee ?? ''} onChange={e => setInfo({ ...info, assignee: e.target.value })} placeholder="Имя" /></label>
          <label>Приоритет<select value={info.priority ?? 0} onChange={e => setInfo({ ...info, priority: +e.target.value || undefined })}>
            <option value={0}>—</option>{[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>{p}</option>)}</select></label>
          <label className="wide">Зависит от
            <select value={info.dependsOn?.[0] ?? ''} onChange={e => setInfo({ ...info, dependsOn: e.target.value ? [e.target.value] : undefined })}>
              <option value="">—</option>
              {[...idx.values()].filter(r => r.topic.taskInfo && r.topic.id !== taskDialog).map(r => <option key={r.topic.id} value={r.topic.id}>{r.topic.title}</option>)}
            </select></label>
        </div>
        <div className="modal-actions">
          {ref.topic.taskInfo && <button className="danger" onClick={() => { ed.setTopic([taskDialog], { taskInfo: undefined }); close() }}>Удалить задачу</button>}
          <div className="spacer" />
          <button onClick={close}>Отмена</button>
          <button className="btn-create" onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

export default function Gantt({ sheet }: { sheet: Sheet }) {
  const ed = useEditor.getState()
  const { selection } = useEditor()
  const [dayW, setDayW] = useState(36)
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'end'; x0: number; info: Info; delta: number } | null>(null)
  const tasks = useMemo(() => [...indexSheet(sheet).values()].filter(r => r.topic.taskInfo?.start), [sheet])
  const t0 = today()
  const starts = tasks.map(r => toDay(r.topic.taskInfo!.start)), ends = tasks.map(r => toDay(r.topic.taskInfo!.end ?? r.topic.taskInfo!.start))
  const from = Math.min(t0, ...starts) - 3, to = Math.max(t0 + 14, ...ends) + 7
  const days = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const scroll = useRef<HTMLDivElement>(null)
  const sel = selection[selection.length - 1]
  const selRef = sel ? indexSheet(sheet).get(sel) : undefined

  const span = (info: Info, id: string) => {
    let s = toDay(info.start), e = toDay(info.end ?? info.start)
    if (drag?.id === id) { if (drag.mode === 'move') { s += drag.delta; e += drag.delta } else e = Math.max(s, e + drag.delta) }
    return { s, e }
  }
  const finish = () => {
    if (!drag) return
    const { info, delta, mode, id } = drag
    if (delta) {
      const s = toDay(info.start), e = toDay(info.end ?? info.start)
      ed.setTopic([id], { taskInfo: { ...info, start: fromDay(mode === 'move' ? s + delta : s), end: fromDay(mode === 'move' ? e + delta : Math.max(s, e + delta)) } })
    }
    setDrag(null)
  }

  return (
    <div className="gantt" data-testid="gantt" onPointerMove={e => drag && setDrag({ ...drag, delta: Math.round((e.clientX - drag.x0) / dayW) })} onPointerUp={finish}>
      <div className="gantt-head">
        <b>Диаграмма Ганта</b>
        <div className="spacer" />
        {selRef && !selRef.topic.taskInfo && <button className="share-btn" onClick={() => ed.setTopic([sel], { taskInfo: { start: fromDay(t0), end: fromDay(t0 + 2), progress: 0 } })}>Добавить «{selRef.topic.title}» как задачу</button>}
        <button className="ibtn" aria-label="Уменьшить шкалу" onClick={() => setDayW(w => Math.max(14, w - 6))}><Icon name="chevron" size={14} /></button>
        <input type="range" min={14} max={80} value={dayW} onChange={e => setDayW(+e.target.value)} aria-label="Масштаб шкалы" />
        <button className="ibtn" aria-label="Закрыть" onClick={() => ed.setGantt(false)}><Icon name="close" size={16} /></button>
      </div>
      <div className="gantt-body">
        <div className="gantt-table">
          <div className="gt-row head"><span>Задача</span><span>Начало</span><span>Дней</span></div>
          {tasks.map(r => {
            const i = r.topic.taskInfo!
            const { s, e } = span(i, r.topic.id)
            return (
              <div key={r.topic.id} className={'gt-row' + (selection.includes(r.topic.id) ? ' on' : '')} onClick={() => ed.select([r.topic.id])} onDoubleClick={() => ed.setTaskDialog(r.topic.id)}>
                <span className="name" title={r.topic.title}>{r.topic.title}</span><span>{new Date(s * DAY).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span><span>{e - s + 1}</span>
              </div>
            )
          })}
          {!tasks.length && <div className="gantt-empty"><Icon name="gantt" size={36} /><b>Нет задач</b><span>Выберите тему, чтобы добавить её как задачу.</span></div>}
        </div>
        <div className="gantt-chart" ref={scroll}>
          <div className="gc-days" style={{ width: days.length * dayW }}>
            {days.map(d => {
              const dt = new Date(d * DAY)
              return <span key={d} className={(d === t0 ? 'today ' : '') + ([0, 6].includes(dt.getUTCDay()) ? 'wk' : '')} style={{ width: dayW }}>
                {dt.getUTCDate() === 1 || d === from ? <em>{dt.toLocaleDateString('ru', { month: 'short' })}</em> : null}{dt.getUTCDate()}</span>
            })}
          </div>
          <div className="gc-rows" style={{ width: days.length * dayW, backgroundSize: `${dayW}px 100%` }}>
            <div className="gc-today" style={{ left: (t0 - from) * dayW + dayW / 2 }} />
            {tasks.map(r => {
              const i = r.topic.taskInfo!
              const { s, e } = span(i, r.topic.id)
              const color = '#4dabf7'
              return (
                <div key={r.topic.id} className="gc-row">
                  <div className={'gc-bar' + (selection.includes(r.topic.id) ? ' on' : '')} style={{ left: (s - from) * dayW + 2, width: (e - s + 1) * dayW - 4, background: color }}
                    title={`${r.topic.title}: ${i.progress ?? 0}%${i.assignee ? ' · ' + i.assignee : ''}`}
                    onPointerDown={ev => { ev.preventDefault(); ed.select([r.topic.id]); setDrag({ id: r.topic.id, mode: 'move', x0: ev.clientX, info: i, delta: 0 }) }}
                    onDoubleClick={() => ed.setTaskDialog(r.topic.id)}>
                    <span className="gc-progress" style={{ width: `${i.progress ?? 0}%` }} />
                    <span className="gc-label">{r.topic.title}{i.assignee ? ` · ${i.assignee}` : ''}</span>
                    <span className="gc-handle" onPointerDown={ev => { ev.stopPropagation(); ev.preventDefault(); setDrag({ id: r.topic.id, mode: 'end', x0: ev.clientX, info: i, delta: 0 }) }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
