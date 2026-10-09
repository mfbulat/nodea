import { ReactNode, useState } from 'react'
import type { Boundary, BorderStyle, LineShape, Relationship, ShapeId, Sheet, StructureId, Topic, TopicStyle } from './model'
import { indexSheet } from './model'
import { STRUCTURES } from './layout'
import { getTheme, resolveStyle, THEMES } from './themes'
import { useEditor } from './store'

const SHAPES: [ShapeId, string][] = [['rect', 'Прямоугольник'], ['rounded', 'Скруглённый'], ['capsule', 'Капсула'],
  ['ellipse', 'Эллипс'], ['diamond', 'Ромб'], ['hexagon', 'Шестиугольник'], ['parallelogram', 'Параллелограмм'],
  ['underline', 'Подчёркивание'], ['none', 'Без формы']]
const LINES: [LineShape, string][] = [['curve', 'Кривая'], ['straight', 'Прямая'], ['elbow', 'Ломаная'],
  ['rounded', 'Ломаная скруглённая'], ['taper', 'Сужающаяся'], ['none', 'Нет']]
const BORDERS: [BorderStyle, string][] = [['solid', 'Сплошная'], ['dashed', 'Штрих'], ['dotted', 'Точки'], ['none', 'Нет']]
const FONTS = ['system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 'Arial, sans-serif', 'Verdana, sans-serif',
  '"Trebuchet MS", sans-serif', 'Georgia, serif', '"Times New Roman", serif', '"Courier New", monospace']
const fontName = (f: string) => f.split(',')[0].replace(/"/g, '').replace('system-ui', 'Системный')

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fp-row"><span>{label}</span><div className="fp-ctl">{children}</div></div>
}

function Color({ value, onChange, allowNone }: { value: string; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  const isNone = value === 'transparent' || value === 'none'
  return (
    <>
      <input type="color" value={isNone || !/^#[0-9a-f]{6}$/i.test(value) ? '#ffffff' : value} onChange={e => onChange(e.target.value)} />
      {allowNone && <button className={'mini' + (isNone ? ' on' : '')} onClick={() => onChange('transparent')}>Нет</button>}
    </>
  )
}

function ElementFormat({ sheet }: { sheet: Sheet }) {
  const { element } = useEditor()
  const ed = useEditor.getState()
  if (element?.kind === 'relationship') {
    const r = sheet.relationships?.find(x => x.id === element.id)
    if (!r) return null
    const up = (p: Partial<Relationship>) => ed.updateRelationship(r.id, p)
    return (
      <div className="side-panel format-panel" data-testid="format-panel">
        <h4>Связь</h4>
        <Row label="Подпись"><input value={r.title ?? ''} onChange={e => up({ title: e.target.value })} /></Row>
        <Row label="Цвет / толщина">
          <Color value={r.color ?? '#667085'} onChange={v => up({ color: v })} />
          <input type="number" min={1} max={8} value={r.width ?? 2} onChange={e => up({ width: +e.target.value })} />
        </Row>
        <Row label="Линия">
          <select value={r.lineStyle ?? 'dashed'} onChange={e => up({ lineStyle: e.target.value as BorderStyle })}>
            {BORDERS.filter(b => b[0] !== 'none').map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </Row>
        <label className="fp-check"><input type="checkbox" checked={!!r.arrowStart} onChange={e => up({ arrowStart: e.target.checked })} />Стрелка в начале</label>
        <label className="fp-check"><input type="checkbox" checked={r.arrowEnd !== false} onChange={e => up({ arrowEnd: e.target.checked })} />Стрелка в конце</label>
        <div className="fp-buttons" style={{ marginTop: 10 }}>
          <button onClick={() => up({ cp1: undefined, cp2: undefined })}>Сбросить изгиб</button>
          <button className="danger" onClick={ed.removeElement}>Удалить связь</button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Изгиб — перетаскиванием белых точек. Двойной щелчок по линии — подпись.</p>
      </div>
    )
  }
  if (element?.kind === 'boundary') {
    let b: Boundary | undefined
    const walk = (t: Topic) => { b ??= t.boundaries?.find(x => x.id === element.id); t.children?.forEach(walk); t.summaries?.forEach(s => walk(s.topic)) }
    walk(sheet.rootTopic); sheet.floatingTopics?.forEach(walk)
    if (!b) return null
    const id = b.id
    const up = (p: Partial<Boundary>) => ed.updateBoundary(id, p)
    return (
      <div className="side-panel format-panel" data-testid="format-panel">
        <h4>Граница</h4>
        <Row label="Заголовок"><input value={b.title ?? ''} onChange={e => up({ title: e.target.value })} /></Row>
        <Row label="Цвет линии"><Color value={b.color ?? '#667085'} onChange={v => up({ color: v })} /></Row>
        <Row label="Заливка"><Color value={b.fill ?? 'transparent'} allowNone onChange={v => up({ fill: v === 'transparent' ? undefined : v })} /></Row>
        <Row label="Линия">
          <select value={b.lineStyle ?? 'dashed'} onChange={e => up({ lineStyle: e.target.value as BorderStyle })}>
            {BORDERS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </Row>
        <div className="fp-buttons" style={{ marginTop: 10 }}><button className="danger" onClick={ed.removeElement}>Удалить границу</button></div>
      </div>
    )
  }
  return null
}

function TopicElements({ topic }: { topic: Topic }) {
  const ed = useEditor.getState()
  const set = (p: Partial<Topic>) => ed.setTopic([topic.id], p)
  const img = topic.image
  const has = img || topic.attachment || topic.href || topic.equation || topic.labels?.length || topic.task || topic.markers?.length
  if (!has) return null
  return (
    <>
      <h4>Элементы темы</h4>
      {img && !img.src.startsWith('emoji:') && (
        <Row label="Ширина картинки">
          <input type="number" min={16} max={1200} value={img.width}
            onChange={e => { const w = +e.target.value; set({ image: { ...img, width: w, height: Math.round(img.height * w / img.width) } }) }} />
          <button className="mini" onClick={() => set({ image: undefined })}>×</button>
        </Row>
      )}
      {img?.src.startsWith('emoji:') && <Row label="Стикер"><span>{img.src.slice(6)}</span>
        <input type="number" min={16} max={400} value={img.width} onChange={e => set({ image: { ...img, width: +e.target.value, height: +e.target.value } })} />
        <button className="mini" onClick={() => set({ image: undefined })}>×</button></Row>}
      {topic.attachment && <Row label="Вложение"><a href={topic.attachment.url} target="_blank" rel="noreferrer" className="ellipsis">{topic.attachment.name}</a>
        <button className="mini" onClick={() => set({ attachment: undefined })}>×</button></Row>}
      {topic.href && <Row label="Ссылка"><button className="mini" onClick={() => ed.setDialog({ kind: 'link', id: topic.id })}>Изменить</button>
        <button className="mini" onClick={() => set({ href: undefined })}>×</button></Row>}
      {topic.equation && <Row label="Формула"><button className="mini" onClick={() => ed.setDialog({ kind: 'equation', id: topic.id })}>Изменить</button>
        <button className="mini" onClick={() => set({ equation: undefined })}>×</button></Row>}
      {!!topic.labels?.length && <Row label="Метки"><button className="mini" onClick={() => ed.setDialog({ kind: 'labels', id: topic.id })}>Изменить</button>
        <button className="mini" onClick={() => set({ labels: undefined })}>×</button></Row>}
      {topic.task && <Row label="Задача"><label><input type="checkbox" checked={topic.task.done} onChange={() => ed.toggleTask(topic.id)} /> выполнено</label>
        <button className="mini" onClick={() => set({ task: undefined })}>×</button></Row>}
      {!!topic.markers?.length && <Row label="Маркеры"><button className="mini" onClick={() => set({ markers: undefined })}>Убрать все</button></Row>}
    </>
  )
}

export default function FormatPanel({ sheet }: { sheet: Sheet }) {
  const { selection, styleClipboard, element } = useEditor()
  if (element) return <ElementFormat sheet={sheet} />
  return <TopicFormat sheet={sheet} selection={selection} styleClipboard={styleClipboard} />
}

function TopicFormat({ sheet, selection, styleClipboard }: { sheet: Sheet; selection: string[]; styleClipboard: TopicStyle | null }) {
  const ed = useEditor.getState()
  const [tab, setTab] = useState<'topic' | 'map'>(selection.length ? 'topic' : 'map')
  const idx = indexSheet(sheet)
  const id = selection[selection.length - 1]
  const ref = id ? idx.get(id) : undefined
  const s = ref ? resolveStyle(sheet, ref) : null
  const set = (p: TopicStyle) => ed.setStyle(p)
  const isRoot = id === sheet.rootTopic.id
  const structure: StructureId | '' = isRoot ? sheet.structure ?? 'mindmap' : (ref?.topic.structure ?? '')

  return (
    <div className="side-panel format-panel" data-testid="format-panel">
      <div className="tabs">
        <button className={tab === 'topic' ? 'on' : ''} onClick={() => setTab('topic')}>Тема</button>
        <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>Карта</button>
      </div>
      {tab === 'topic' && (!s || !ref ? <p className="muted">Выберите тему.</p> : (
        <>
          {selection.length > 1 && <p className="muted">Выбрано тем: {selection.length}</p>}
          <h4>Структура {isRoot ? 'карты' : 'ветки'}</h4>
          <select value={structure} onChange={e => ed.setStructure((e.target.value || undefined) as StructureId | undefined)} aria-label="Структура">
            {!isRoot && <option value="">Как у родителя</option>}
            {STRUCTURES.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>

          <h4>Форма</h4>
          <Row label="Форма">
            <select value={s.shape} onChange={e => set({ shape: e.target.value as ShapeId })}>
              {SHAPES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Row>
          <Row label="Заливка"><Color value={s.fill} allowNone onChange={v => set({ fill: v })} /></Row>
          <Row label="Рамка">
            <Color value={s.borderColor} onChange={v => set({ borderColor: v })} />
            <input type="number" min={0} max={10} value={s.borderWidth} onChange={e => set({ borderWidth: +e.target.value })} />
          </Row>
          <Row label="Тип рамки">
            <select value={s.borderStyle} onChange={e => set({ borderStyle: e.target.value as BorderStyle })}>
              {BORDERS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Row>
          <Row label="Ширина текста">
            <input type="number" min={60} max={1000} step={10} value={s.maxWidth} onChange={e => set({ maxWidth: +e.target.value })} />
          </Row>

          <h4>Текст</h4>
          <Row label="Шрифт">
            <select value={s.fontFamily} onChange={e => set({ fontFamily: e.target.value })}>
              {[...new Set([s.fontFamily, ...FONTS])].map(f => <option key={f} value={f}>{fontName(f)}</option>)}
            </select>
          </Row>
          <Row label="Размер">
            <input type="number" min={8} max={96} value={s.fontSize} onChange={e => set({ fontSize: +e.target.value })} />
            <Color value={s.textColor} onChange={v => set({ textColor: v })} />
          </Row>
          <div className="fp-buttons">
            <button className={'mini' + (s.fontWeight === 'bold' ? ' on' : '')} title="Жирный"
              onClick={() => set({ fontWeight: s.fontWeight === 'bold' ? 'normal' : 'bold' })}><b>Ж</b></button>
            <button className={'mini' + (s.fontStyle === 'italic' ? ' on' : '')} title="Курсив"
              onClick={() => set({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>К</i></button>
            <button className={'mini' + (s.textDecoration === 'underline' ? ' on' : '')} title="Подчёркнутый"
              onClick={() => set({ textDecoration: s.textDecoration === 'underline' ? 'none' : 'underline' })}><u>Ч</u></button>
            <button className={'mini' + (s.textDecoration === 'line-through' ? ' on' : '')} title="Зачёркнутый"
              onClick={() => set({ textDecoration: s.textDecoration === 'line-through' ? 'none' : 'line-through' })}><s>З</s></button>
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} className={'mini' + (s.textAlign === a ? ' on' : '')} title="Выравнивание"
                onClick={() => set({ textAlign: a })}>{a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}</button>
            ))}
          </div>

          <h4>Линия ветки</h4>
          <Row label="Форма">
            <select value={s.lineShape} onChange={e => set({ lineShape: e.target.value as LineShape })}>
              {LINES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </Row>
          <Row label="Толщина / цвет">
            <input type="number" min={0.5} max={12} step={0.5} value={s.lineWidth} onChange={e => set({ lineWidth: +e.target.value })} />
            <Color value={s.lineColor} onChange={v => set({ lineColor: v })} />
          </Row>

          <TopicElements topic={ref.topic} />
          <h4>Стиль</h4>
          <div className="fp-buttons">
            <button onClick={() => ed.copyStyle(s)} title="Ctrl+Alt+C">Копировать стиль</button>
            <button onClick={() => ed.pasteStyle()} disabled={!styleClipboard} title="Ctrl+Alt+V">Вставить стиль</button>
            <button onClick={() => ed.clearStyle()}>Сбросить</button>
          </div>
        </>
      ))}
      {tab === 'map' && (
        <>
          <h4>Структура карты</h4>
          <select value={sheet.structure ?? 'mindmap'} onChange={e => ed.setSheet({ structure: e.target.value as StructureId })} aria-label="Структура карты">
            {STRUCTURES.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
          <h4>Тема оформления</h4>
          <div className="theme-grid">
            {THEMES.map(th => (
              <button key={th.id} className={'theme-card' + (getTheme(sheet.theme).id === th.id ? ' on' : '')}
                onClick={() => ed.setSheet({ theme: th.id, background: undefined })} style={{ background: th.background }}>
                <span className="swatch" style={{ background: th.levels.central.fill, borderColor: th.levels.central.borderColor }} />
                <span className="swatch" style={{ background: th.levels.main.fill, borderColor: th.levels.main.borderColor }} />
                <span style={{ color: th.levels.sub.textColor }}>{th.name}</span>
              </button>
            ))}
          </div>
          <h4>Фон</h4>
          <Row label="Цвет фона">
            <Color value={sheet.background || getTheme(sheet.theme).background} onChange={v => ed.setSheet({ background: v })} />
            <button className="mini" onClick={() => ed.setSheet({ background: undefined })}>По теме</button>
          </Row>
          <label className="fp-check">
            <input type="checkbox" checked={!!sheet.rainbow} onChange={e => ed.setSheet({ rainbow: e.target.checked })} />
            Радужные ветки
          </label>
        </>
      )}
    </div>
  )
}
