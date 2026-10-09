import { ReactNode, useState } from 'react'
import type { BorderStyle, LineShape, ShapeId, Sheet, StructureId, TopicStyle } from './model'
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

export default function FormatPanel({ sheet }: { sheet: Sheet }) {
  const { selection, styleClipboard } = useEditor()
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
