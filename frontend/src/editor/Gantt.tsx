// Задачи и диаграмма Ганта (как в веб-версии). Панель «Задача» слева: прогресс, приоритет,
// длительность (фикс./авто), даты, предшественники и последователи, исполнитель и общие
// настройки задач. Окно Ганта — плавающее, перетаскивается за заголовок: таблица задач,
// шкала дней с линией «сегодня», полосы цвета ветки (двигаются и растягиваются), связи задач,
// экспорт и печать, масштаб.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Sheet, Topic } from './model'
import { indexSheet } from './model'
import { useEditor } from './store'
import { resolveStyle } from './themes'
import { pluralDays, taskDays } from './measure'
import Icon from '../ui/Icon'
import { avatarColor } from '../ui/avatar'
import { Tip } from './Chrome'

type Info = NonNullable<Topic['taskInfo']>
const DAY = 86400000
export const toDay = (iso?: string) => (iso ? Math.floor(new Date(iso + 'T00:00:00Z').getTime() / DAY) : NaN)
export const fromDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10)
const today = () => Math.floor(Date.now() / DAY - new Date().getTimezoneOffset() / 1440)
const fmtDate = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', '') : '')

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={'tk-switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}><i /></button>
}

function DateField({ value, onChange, label }: { value?: string; onChange: (v?: string) => void; label: string }) {
  return (
    <div className={'tk-date' + (value ? ' has' : '')}>
      <span className="tk-date-text">{value ? fmtDate(value) : 'Выберите дату'}</span>
      {value && <button className="tk-clear" aria-label={`Очистить: ${label}`} onClick={() => onChange(undefined)}><Icon name="close" size={10} /></button>}
      <svg width={10} height={10} viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.2} /></svg>
      <input type="date" aria-label={label} value={value ?? ''} onChange={e => onChange(e.target.value || undefined)} />
    </div>
  )
}

/** Список связанных задач (предшественники / последователи) с добавлением через «+». */
function Links({ label, ids, options, onAdd, onRemove }: { label: string; ids: string[]; options: { id: string; title: string }[]; onAdd: (id: string) => void; onRemove: (id: string) => void }) {
  const [adding, setAdding] = useState(false)
  const free = options.filter(o => !ids.includes(o.id))
  return (
    <div className="tk-sec">
      <div className="tk-row"><span className="tk-lab">{label}</span><div className="spacer" />
        <button className="tk-plus" aria-label={`Добавить: ${label}`} disabled={!free.length} onClick={() => setAdding(a => !a)}><Icon name="plus" size={14} /></button></div>
      {adding && (
        <select className="tk-select wide" autoFocus aria-label={label} value="" onBlur={() => setAdding(false)}
          onChange={e => { if (e.target.value) onAdd(e.target.value); setAdding(false) }}>
          <option value="">Выберите задачу</option>
          {free.map(o => <option key={o.id} value={o.id}>{o.title || '(без названия)'}</option>)}
        </select>
      )}
      {ids.map(id => {
        const o = options.find(x => x.id === id)
        return o ? <div key={id} className="tk-link"><span>{o.title || '(без названия)'}</span><button aria-label="Убрать связь" onClick={() => onRemove(id)}><Icon name="close" size={10} /></button></div> : null
      })}
    </div>
  )
}

/** Панель «Задача» (слева), открывается из «Вставить → Задача» и двойным щелчком по задаче в Ганте. */
export function TaskPanel({ sheet }: { sheet: Sheet }) {
  const { taskDialog, userName } = useEditor()
  const ed = useEditor.getState()
  const idx = indexSheet(sheet)
  const ref = taskDialog ? idx.get(taskDialog) : undefined
  // новая задача создаётся сразу, как в веб-версии
  useEffect(() => {
    if (taskDialog && ref && !ref.topic.taskInfo) ed.setTopic([taskDialog], { taskInfo: { progress: 0, creator: userName, durationMode: 'fixed' } })
  }, [taskDialog, !!ref])
  if (!taskDialog || !ref) return null
  const info: Info = ref.topic.taskInfo ?? { progress: 0 }
  const set = (patch: Partial<Info>) => ed.setTopic([taskDialog], { taskInfo: { ...info, ...patch } })
  const close = () => ed.setTaskDialog(null)
  const dur = info.start ? taskDays(info.start, info.end ?? info.start, sheet.taskSkipWeekends) : 1
  const fixed = info.durationMode !== 'auto'
  const tasks = [...idx.values()].filter(r => r.topic.taskInfo && r.topic.id !== taskDialog).map(r => ({ id: r.topic.id, title: r.topic.title }))
  const successors = [...idx.values()].filter(r => r.topic.taskInfo?.dependsOn?.includes(taskDialog)).map(r => r.topic.id)
  const setStart = (v?: string) => {
    if (!v) return set({ start: undefined, end: fixed ? undefined : info.end })
    if (fixed || !info.end) return set({ start: v, end: fromDay(toDay(v) + (info.start ? toDay(info.end ?? info.start) - toDay(info.start) : 0)) })
    set({ start: v, end: toDay(info.end) < toDay(v) ? v : info.end })
  }
  const setEnd = (v?: string) => set({ end: v, start: v && info.start && toDay(info.start) > toDay(v) ? v : info.start ?? v })
  const setDur = (n: number) => { const s = info.start ?? fromDay(today()); set({ start: s, end: fromDay(toDay(s) + Math.max(1, n) - 1) }) }
  return (
    <div className="task-panel" data-testid="task-panel" onKeyDown={e => e.stopPropagation()}>
      <div className="tk-head"><b>Задача</b><div className="spacer" /><button className="tk-x" aria-label="Закрыть" onClick={close}><Icon name="close" size={12} /></button></div>
      <div className="tk-body">
        <div className="tk-sec">
          <div className="tk-row"><span className="tk-lab">Задача</span><span className="tk-val">{ref.topic.title || '(без названия)'}</span></div>
          <div className="tk-row"><span className="tk-lab">Автор</span><span className="tk-val"><span className="cm-ava" style={{ width: 16, height: 16, fontSize: 9, background: avatarColor(info.creator ?? userName) }}>{(info.creator ?? userName ?? '?')[0]?.toUpperCase()}</span>{info.creator ?? userName}</span></div>
        </div>
        <div className="tk-sec">
          <div className="tk-row"><span className="tk-lab">Прогресс</span>
            <select className="tk-select" aria-label="Прогресс" value={info.progress ?? 0} onChange={e => set({ progress: +e.target.value })}>
              {[0, 25, 50, 75, 100].map(p => <option key={p} value={p}>{p}%</option>)}
              {![0, 25, 50, 75, 100].includes(info.progress ?? 0) && <option value={info.progress}>{info.progress}%</option>}
            </select></div>
          <div className="tk-row"><span className="tk-lab">Приоритет</span>
            <select className="tk-select" aria-label="Приоритет" value={info.priority ?? -1} onChange={e => set({ priority: +e.target.value < 0 ? undefined : +e.target.value })}>
              <option value={-1}>Нет</option>{Array.from({ length: 10 }, (_, p) => <option key={p} value={p}>P{p}</option>)}
            </select></div>
        </div>
        <div className="tk-sec">
          <div className="tk-row"><span className="tk-lab">Длительность</span>
            <span className="tk-dur"><input type="number" min={1} aria-label="Длительность" value={dur} onChange={e => setDur(+e.target.value || 1)} /><em>дн.</em></span>
            <span className="tk-seg"><button className={fixed ? 'on' : ''} onClick={() => set({ durationMode: 'fixed' })}>Фикс.</button><button className={!fixed ? 'on' : ''} onClick={() => set({ durationMode: 'auto' })}>Авто</button></span></div>
          <div className="tk-row"><span className="tk-lab">Начало</span><DateField label="Начало" value={info.start} onChange={setStart} /></div>
          <div className="tk-row"><span className="tk-lab">Окончание</span><DateField label="Окончание" value={info.end} onChange={setEnd} /></div>
        </div>
        <Links label="Предшественник" ids={info.dependsOn ?? []} options={tasks}
          onAdd={id => set({ dependsOn: [...(info.dependsOn ?? []), id] })} onRemove={id => set({ dependsOn: (info.dependsOn ?? []).filter(x => x !== id) })} />
        <Links label="Последователь" ids={successors} options={tasks}
          onAdd={id => { const t = idx.get(id)!.topic; ed.setTopic([id], { taskInfo: { ...t.taskInfo!, dependsOn: [...(t.taskInfo!.dependsOn ?? []), taskDialog] } }) }}
          onRemove={id => { const t = idx.get(id)!.topic; ed.setTopic([id], { taskInfo: { ...t.taskInfo!, dependsOn: (t.taskInfo!.dependsOn ?? []).filter(x => x !== taskDialog) } }) }} />
        <div className="tk-sec">
          <div className="tk-row"><span className="tk-lab">Исполнитель</span>
            <input className="tk-input" placeholder="Имя или e-mail" aria-label="Исполнитель" value={info.assignee ?? ''} onChange={e => set({ assignee: e.target.value || undefined })} /></div>
        </div>
        <div className="tk-sec">
          <div className="tk-cap">Общие настройки задач</div>
          <div className="tk-row"><span className="tk-lab wide">Показывать в теме</span><div className="spacer" />
            <Toggle label="Показывать в теме" on={sheet.taskInTopic !== false} onChange={v => ed.setSheet({ taskInTopic: v })} /></div>
          <div className="tk-row"><span className="tk-lab wide">Скрывать автора на карте</span><div className="spacer" />
            <Toggle label="Скрывать автора на карте" on={sheet.taskHideCreator !== false} onChange={v => ed.setSheet({ taskHideCreator: v })} /></div>
          <div className="tk-row"><span className="tk-lab wide">Пропускать выходные</span><div className="spacer" />
            <Toggle label="Пропускать выходные" on={!!sheet.taskSkipWeekends} onChange={v => ed.setSheet({ taskSkipWeekends: v })} /></div>
        </div>
      </div>
      <div className="tk-foot"><button className="tk-remove" onClick={() => { ed.setTopic([taskDialog], { taskInfo: undefined }); close() }}>Удалить</button></div>
    </div>
  )
}

const ROW = 43

export default function Gantt({ sheet }: { sheet: Sheet }) {
  const ed = useEditor.getState()
  const { selection } = useEditor()
  const [dayW, setDayW] = useState(87)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [linking, setLinking] = useState<string | null | false>(false)
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'end'; x0: number; info: Info; delta: number } | null>(null)
  const win = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const chart = useRef<HTMLDivElement>(null)
  const idx = useMemo(() => indexSheet(sheet), [sheet])
  const tasks = useMemo(() => [...idx.values()].filter(r => r.topic.taskInfo), [idx])
  const t0 = today()
  const dated = tasks.filter(r => r.topic.taskInfo!.start)
  const starts = dated.map(r => toDay(r.topic.taskInfo!.start)), ends = dated.map(r => toDay(r.topic.taskInfo!.end ?? r.topic.taskInfo!.start))
  const from = Math.min(t0, ...starts) - 30, to = Math.max(t0 + 30, ...ends) + 30
  const days = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const months = days.filter((d, i) => i === 0 || new Date(d * DAY).getUTCDate() === 1)

  // при открытии шкала показывает «сегодня» у левого края
  useEffect(() => { if (chart.current) chart.current.scrollLeft = (t0 - from - 1) * dayW }, [])

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
  const clickBar = (id: string) => {
    if (linking === false) { ed.select([id]); return }
    if (linking === null) { setLinking(id); return }
    if (linking !== id) {
      const t = idx.get(id)!.topic
      if (!t.taskInfo!.dependsOn?.includes(linking)) ed.setTopic([id], { taskInfo: { ...t.taskInfo!, dependsOn: [...(t.taskInfo!.dependsOn ?? []), linking] } })
    }
    setLinking(false)
  }
  const snapshot = async () => {
    const { toPng } = await import('html-to-image')
    return toPng(body.current!, { backgroundColor: '#ffffff', pixelRatio: 2 })
  }
  const exportPng = async () => {
    const a = document.createElement('a'); a.href = await snapshot(); a.download = `${sheet.title || 'gantt'}-gantt.png`; a.click()
  }
  const print = async () => {
    const src = await snapshot(), w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<title>${sheet.title}</title><img src="${src}" style="max-width:100%" onload="print()">`)
    w.document.close()
  }
  const startMove = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button, input')) return
    const r = win.current!.getBoundingClientRect(), p = win.current!.offsetParent!.getBoundingClientRect()
    const ox = e.clientX - r.left, oy = e.clientY - r.top
    const mv = (ev: PointerEvent) => setPos({ x: Math.max(0, Math.min(p.width - 80, ev.clientX - p.left - ox)), y: Math.max(0, Math.min(p.height - 40, ev.clientY - p.top - oy)) })
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up)
  }
  const rowOf = new Map(tasks.map((r, i) => [r.topic.id, i]))

  return (
    <div className="gantt" ref={win} data-testid="gantt" style={pos ? { left: pos.x, top: pos.y, bottom: 'auto' } : undefined}
      onPointerMove={e => drag && setDrag({ ...drag, delta: Math.round((e.clientX - drag.x0) / dayW) })} onPointerUp={finish}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setLinking(false) }}>
      <div className="gantt-head" onPointerDown={startMove}>
        <b>Диаграмма Ганта</b>
        <div className="gantt-tools">
          <Tip title="Связать задачи" desc="Щёлкните две полосы: первая станет предшественником второй.">
            <button className={'ibtn' + (linking !== false ? ' on' : '')} aria-label="Связать задачи" disabled={tasks.length < 2} onClick={() => setLinking(l => (l === false ? null : false))}>
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"><rect x={1.5} y={2.5} width={5} height={3} rx={1} /><rect x={9.5} y={10.5} width={5} height={3} rx={1} /><path d="M4 5.5v6.5h5.5" /></svg>
            </button></Tip>
          <i />
          <Tip title="Экспорт" desc="Сохранить диаграмму как PNG."><button className="ibtn" aria-label="Экспорт диаграммы" onClick={exportPng}><Icon name="upload" size={16} /></button></Tip>
          <Tip title="Печать"><button className="ibtn" aria-label="Печать диаграммы" onClick={print}><Icon name="print" size={16} /></button></Tip>
          <i />
          <button className="ibtn" aria-label="Уменьшить масштаб" onClick={() => setDayW(w => Math.max(24, w - 16))}>
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}><circle cx={8} cy={8} r={6} /><path d="M5.5 8h5" /></svg></button>
          <input className="gantt-zoom" type="range" min={24} max={160} value={dayW} onChange={e => setDayW(+e.target.value)} aria-label="Масштаб шкалы" />
          <button className="ibtn" aria-label="Увеличить масштаб" onClick={() => setDayW(w => Math.min(160, w + 16))}>
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}><circle cx={8} cy={8} r={6} /><path d="M5.5 8h5M8 5.5v5" /></svg></button>
          <button className="gantt-close" aria-label="Закрыть" onClick={() => ed.setGantt(false)}><Icon name="close" size={10} /></button>
        </div>
      </div>
      {linking !== false && <div className="gantt-hint">{linking ? 'Теперь щёлкните задачу-последователя.' : 'Щёлкните задачу-предшественника.'} Esc — отмена.</div>}
      <div className="gantt-body" ref={body}>
        <div className="gantt-table">
          <div className="gt-row head"><span>Задача</span><span>Начало</span><span>Длительность</span></div>
          {tasks.map(r => {
            const i = r.topic.taskInfo!
            const has = !!i.start, { s, e } = has ? span(i, r.topic.id) : { s: 0, e: 0 }
            return (
              <div key={r.topic.id} className={'gt-row' + (selection.includes(r.topic.id) ? ' on' : '')} onClick={() => ed.select([r.topic.id])} onDoubleClick={() => ed.setTaskDialog(r.topic.id)}>
                <span className="name" title={r.topic.title}>{r.topic.title || '(без названия)'}</span>
                <span>{has ? fmtDate(fromDay(s)) : ''}</span>
                <span>{has ? pluralDays(sheet.taskSkipWeekends ? taskDays(fromDay(s), fromDay(e), true) : e - s + 1) : ''}</span>
              </div>
            )
          })}
          {!tasks.length && (
            <div className="gantt-empty">
              <svg width={96} height={66} viewBox="0 0 96 66" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x={4} y={4} width={84} height={52} rx={4} fill="#fff" stroke="#1f2326" strokeWidth={2.4} /><path d="M28 4v52M4 16h84" stroke="#1f2326" strokeWidth={2} />
                <path d="M10 25h10M10 34h10M10 43h10" stroke="#d6dade" strokeWidth={3} /><path d="M36 25h40" stroke="#a5a6f6" strokeWidth={3} /><path d="M50 34h20" stroke="#ff9f69" strokeWidth={3} /><path d="M36 43h22" stroke="#ff9f69" strokeWidth={3} />
                <path d="M62 38l12 22 3-8 8-2z" fill="#fff" stroke="#1f2326" strokeWidth={2} />
              </svg>
              <b>Нет задач</b><span>Выберите тему, чтобы добавить её как задачу.</span>
            </div>
          )}
        </div>
        <div className="gantt-chart" ref={chart}>
          <div className="gc-inner" style={{ width: days.length * dayW }}>
            <div className="gc-months">
              {months.map((d, i) => {
                const next = months[i + 1] ?? to + 1
                return <span key={d} style={{ left: (d - from) * dayW, width: (next - d) * dayW }}><em>{new Date(d * DAY).toLocaleDateString('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(' г.', '')}</em></span>
              })}
            </div>
            <div className="gc-days">
              {days.map(d => {
                const wd = new Date(d * DAY).getUTCDay()
                return <span key={d} className={(d === t0 ? 'today ' : '') + (wd === 0 || wd === 6 ? 'wk' : '')} style={{ width: dayW }}>{new Date(d * DAY).getUTCDate()}</span>
              })}
            </div>
            <div className="gc-rows" style={{ backgroundSize: `${dayW}px ${ROW}px`, minHeight: Math.max(tasks.length, 8) * ROW }}>
              <div className="gc-today" style={{ left: (t0 - from) * dayW }} />
              {tasks.map((r, row) => <div key={r.topic.id} className={'gc-row' + (selection.includes(r.topic.id) ? ' on' : '')} style={{ top: row * ROW }} />)}
              <svg className="gc-deps" width={days.length * dayW} height={Math.max(tasks.length, 8) * ROW}>
                <defs><marker id="gc-arrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={7} markerHeight={7} orient="auto"><path d="M0,0L8,4L0,8z" fill="#878c92" /></marker></defs>
                {tasks.flatMap(r => (r.topic.taskInfo!.dependsOn ?? []).map(p => {
                  const pr = idx.get(p)?.topic.taskInfo, ri = rowOf.get(p)
                  if (!pr?.start || !r.topic.taskInfo!.start || ri === undefined) return null
                  const a = span(pr, p), b = span(r.topic.taskInfo!, r.topic.id)
                  const x1 = (a.e + 1 - from) * dayW - 6, y1 = ri * ROW + ROW / 2, x2 = (b.s - from) * dayW + 4, y2 = rowOf.get(r.topic.id)! * ROW + ROW / 2
                  const mx = Math.max(x1 + 10, Math.min(x2 - 10, (x1 + x2) / 2))
                  return <path key={p + r.topic.id} d={`M${x1},${y1} H${mx} V${y2} H${x2}`} fill="none" stroke="#878c92" strokeWidth={1.2} markerEnd="url(#gc-arrow)" />
                }))}
              </svg>
              {tasks.map((r, row) => {
                const i = r.topic.taskInfo!
                if (!i.start) return null
                const { s, e } = span(i, r.topic.id)
                const color = resolveStyle(sheet, r).lineColor
                const w = (e - s + 1) * dayW - 8
                return (
                  <div key={r.topic.id} className={'gc-bar' + (selection.includes(r.topic.id) ? ' on' : '') + (linking === r.topic.id ? ' linking' : '')}
                    style={{ left: (s - from) * dayW + 4, top: row * ROW + 9, width: w, background: color }}
                    title={`${r.topic.title}: ${i.progress ?? 0}%${i.assignee ? ' · ' + i.assignee : ''}`}
                    onPointerDown={ev => { if (linking !== false) return; ev.preventDefault(); ed.select([r.topic.id]); setDrag({ id: r.topic.id, mode: 'move', x0: ev.clientX, info: i, delta: 0 }) }}
                    onClick={() => clickBar(r.topic.id)} onDoubleClick={() => ed.setTaskDialog(r.topic.id)}>
                    {(i.progress ?? 0) > 0 && <span className="gc-progress" style={{ width: `${i.progress}%` }} />}
                    <span className="gc-label">{w > r.topic.title.length * 7 + 16 ? r.topic.title : r.topic.title.slice(0, 1)}</span>
                    <span className="gc-handle" onPointerDown={ev => { if (linking !== false) return; ev.stopPropagation(); ev.preventDefault(); setDrag({ id: r.topic.id, mode: 'end', x0: ev.clientX, info: i, delta: 0 }) }} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
