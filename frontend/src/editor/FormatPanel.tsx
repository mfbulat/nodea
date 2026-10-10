// Панель «Формат» (как в XMind): вкладки «Стиль / Презентация / Карта».
import { SlideView, type Slide } from './Presentation'
import { ReactNode, useEffect, useRef, useState } from 'react'
import type { Boundary, BorderStyle, LineShape, Relationship, ShapeId, Sheet, StructureId, Topic, TopicStyle } from './model'
import { indexSheet, levelOf } from './model'
import { STRUCTURES } from './layout'
import { COLOR_THEMES, ColorTheme, FullStyle, getColorTheme, isColored, MAP_FONT, resolveStyle, sheetBackground } from './themes'
import { shapePath, edgePath } from './paths'
import { useEditor } from './store'
import Icon from '../ui/Icon'

// ---------- элементы управления ----------

const SHAPES: [ShapeId, string][] = [['rect', 'Прямоугольник'], ['rounded', 'Скруглённый'], ['capsule', 'Капсула'],
  ['ellipse', 'Эллипс'], ['diamond', 'Ромб'], ['hexagon', 'Шестиугольник'], ['parallelogram', 'Параллелограмм'],
  ['underline', 'Подчёркивание'], ['none', 'Без формы']]
const LINES: [LineShape, string][] = [['curve', 'Кривая'], ['straight', 'Прямая'], ['elbow', 'Ломаная'],
  ['rounded', 'Ломаная скруглённая'], ['taper', 'Сужающаяся'], ['none', 'Нет']]
const BORDERS: [BorderStyle, string][] = [['solid', 'Сплошная'], ['dashed', 'Штрих'], ['dotted', 'Точки'], ['none', 'Нет']]
const THICK: [number, string][] = [[0, 'Нет'], [1, 'Тонкая'], [2, 'Средняя'], [3, 'Толстая'], [5, 'Очень толстая']]
const WEIGHT: [NonNullable<TopicStyle['fontWeight']>, string][] = [['normal', 'Обычный'], ['medium', 'Средний'], ['bold', 'Жирный'], ['extrabold', 'Сверхжирный']]
const SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 30, 36, 42, 48, 56, 64]
export const FONTS = [MAP_FONT, 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 'Arial, sans-serif', 'Verdana, sans-serif',
  '"Trebuchet MS", sans-serif', 'Georgia, serif', '"Times New Roman", serif', '"Courier New", monospace']
export const fontName = (f: string) => f.split(',')[0].replace(/"/g, '').replace('system-ui', 'Системный')
const thickName = (w: number) => (THICK.reduce((a, t) => (Math.abs(t[0] - w) < Math.abs(a[0] - w) ? t : a))[1])

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="fp-section">
      <div className="fp-head">
        <button className="group-head" onClick={() => setOpen(o => !o)}>
          <span className={'caret' + (open ? '' : ' closed')}><svg width={8} height={8}><path d="M0,1.5L8,1.5L4,6.5Z" fill="currentColor" /></svg></span>{title}
        </button>
        {right}
      </div>
      {open && children}
    </div>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fp-row"><span>{label}</span><div className="fp-ctl">{children}</div></div>
}

export function Color({ value, onChange, allowNone }: { value: string; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  const isNone = value === 'transparent' || value === 'none'
  return (
    <span className="color-well">
      <span className="swatch" style={{ background: isNone ? 'repeating-linear-gradient(45deg,#fff 0 4px,#ddd 4px 8px)' : value }} />
      <input type="color" aria-label="Цвет" value={isNone || !/^#[0-9a-f]{6}$/i.test(value) ? '#ffffff' : value} onChange={e => onChange(e.target.value)} />
      {allowNone && <button className={'mini' + (isNone ? ' on' : '')} onClick={() => onChange('transparent')} title="Без заливки">∅</button>}
    </span>
  )
}

/** Выпадающий список с картинками (фигура, структура, линия ветки) */
function Picker<T extends string>({ value, options, render, onChange, label, cols = 3 }: {
  value: T; options: [T, string][]; render: (v: T) => ReactNode; onChange: (v: T) => void; label: string; cols?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="picker" ref={ref}>
      <button className="picker-btn" onClick={() => setOpen(o => !o)} aria-label={label} title={options.find(o => o[0] === value)?.[1] ?? label}>
        {render(value)}<Icon name="chevron" size={12} />
      </button>
      {open && (
        <div className="picker-pop" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="listbox" aria-label={label}>
          {options.map(([v, name]) => (
            <button key={v} role="option" aria-selected={v === value} className={v === value ? 'on' : ''} title={name}
              onClick={() => { onChange(v); setOpen(false) }}>{render(v)}<span>{name}</span></button>
          ))}
        </div>
      )}
    </div>
  )
}

const ShapeIcon = ({ s }: { s: ShapeId }) => (
  <svg width={30} height={18} viewBox="-2 -2 34 22">
    {s === 'underline' ? <path d="M0,17H30" stroke="currentColor" strokeWidth={1.6} />
      : s === 'none' ? <path d="M4,9H26" stroke="currentColor" strokeWidth={1.2} strokeDasharray="2 2" />
        : <path d={shapePath(s, 30, 18)} fill="none" stroke="currentColor" strokeWidth={1.6} />}
  </svg>
)

const LineIcon = ({ s }: { s: LineShape }) => {
  const e = { from: 'a', to: 'b', kind: 'h' as const, pts: [{ x: 2, y: 2 }, { x: 28, y: 16 }] }
  const { d, filled } = edgePath(e, s === 'none' ? 'straight' : s, 1.6)
  return <svg width={30} height={18}>{s !== 'none' && <path d={d} fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.6} />}</svg>
}

/** Схематичные значки структур */
export function StructureIcon({ s }: { s: StructureId | '' }) {
  const p: Record<string, string> = {
    'mindmap': 'M13,9h6M13,9C10,9 9,4 6,4M13,9C10,9 9,14 6,14M19,9C22,9 23,4 26,4M19,9C22,9 23,14 26,14',
    'mindmap-cw': 'M13,9h6M19,9C22,9 23,3 26,3M19,9h7M19,9C22,9 23,15 26,15M13,9C10,9 9,5 6,5M13,9C10,9 9,13 6,13',
    'mindmap-acw': 'M13,9h6M13,9C10,9 9,3 6,3M13,9h-7M13,9C10,9 9,15 6,15M19,9C22,9 23,5 26,5M19,9C22,9 23,13 26,13',
    'logic-right': 'M4,9h6M10,9V3h8M10,9h8M10,9v6h8', 'logic-left': 'M28,9h-6M22,9V3h-8M22,9h-8M22,9v6h-8',
    'brace-right': 'M6,9h3M12,2c-3,0 -3,7 -3,7c0,0 0,7 3,7M15,3h10M15,9h10M15,15h10', 'brace-left': 'M26,9h-3M20,2c3,0 3,7 3,7c0,0 0,7 -3,7M17,3h-10M17,9h-10M17,15h-10',
    'org-down': 'M16,2v5M6,7h20M6,7v5M16,7v5M26,7v5', 'org-up': 'M16,16v-5M6,11h20M6,11v-5M16,11v-5M26,11v-5',
    'tree-right': 'M6,2v14M6,6h8M6,11h8M6,16h8', 'tree-left': 'M26,2v14M26,6h-8M26,11h-8M26,16h-8',
    'timeline-h': 'M2,9h28M8,9v-5M16,9v5M24,9v-5', 'timeline-v': 'M16,1v16M16,5h8M16,9h-8M16,13h8',
    'fishbone-left': 'M4,9h26M10,9l5,-6M10,9l5,6M20,9l5,-6M20,9l5,6', 'fishbone-right': 'M28,9h-26M22,9l-5,-6M22,9l-5,6M12,9l-5,-6M12,9l-5,6',
    'tree-table': 'M3,2h26v14h-26zM3,6h26M12,6v10M3,11h26', 'matrix': 'M3,2h26v14h-26zM3,7h26M3,12h26M11,2v14M20,2v14',
    '': 'M8,9h16M12,5l-4,4 4,4',
  }
  return <svg width={32} height={18}><path d={p[s] ?? p['']} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /></svg>
}

const STRUCT_OPTS: [StructureId, string][] = STRUCTURES.map(s => [s.id, s.name])

// ---------- вкладка «Стиль» для темы ----------

function StylePreview({ s, label }: { s: FullStyle; label: string }) {
  return (
    <div className="style-preview">
      <div className="sp-topic" style={{
        background: s.fill === 'transparent' ? 'transparent' : s.fill, color: s.textColor,
        border: s.borderStyle === 'none' || !s.borderWidth ? '1px solid transparent' : `${Math.min(3, s.borderWidth)}px ${s.borderStyle} ${s.borderColor}`,
        borderRadius: s.shape === 'capsule' || s.shape === 'ellipse' ? 20 : s.shape === 'rect' ? 2 : 7,
        fontWeight: ({ normal: 400, medium: 500, bold: 700, extrabold: 800 } as Record<string, number>)[s.fontWeight],
        fontStyle: s.fontStyle, borderBottom: s.shape === 'underline' ? `2px solid ${s.borderColor}` : undefined,
      }}>{label}</div>
    </div>
  )
}

const LEVEL_NAME: Record<string, string> = { central: 'Центральная тема', main: 'Основная тема', sub: 'Подтема', floating: 'Плавающая тема', summary: 'Сводка', callout: 'Выноска' }

function TopicStyleTab({ sheet }: { sheet: Sheet }) {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const idx = indexSheet(sheet)
  const id = selection[selection.length - 1]
  const ref = id ? idx.get(id) : undefined
  if (!ref) return <p className="muted fp-empty">Выберите тему, чтобы изменить её стиль.</p>
  const s = resolveStyle(sheet, ref)
  const set = (p: TopicStyle) => ed.setStyle(p)
  const isRoot = ref.kind === 'root'
  const level = levelOf(ref)
  const structure: StructureId | '' = isRoot ? sheet.structure ?? 'mindmap' : (ref.topic.structure ?? '')
  const B = (on: boolean, label: string, ch: ReactNode, fn: () => void) =>
    <button className={'seg-btn' + (on ? ' on' : '')} title={label} aria-label={label} onClick={fn}>{ch}</button>
  return (
    <>
      {selection.length > 1 && <p className="muted" style={{ margin: '0 0 8px' }}>Выбрано тем: {selection.length}</p>}
      <StylePreview s={s} label={LEVEL_NAME[level]} />

      <Section title="Фигура" right={<Picker label="Фигура" value={s.shape} options={SHAPES} render={v => <ShapeIcon s={v} />} onChange={v => set({ shape: v })} />}>
        <Row label="Заливка">
          <select value={s.fill === 'transparent' ? 'none' : 'solid'} onChange={e => set({ fill: e.target.value === 'none' ? 'transparent' : (s.fill === 'transparent' ? '#eeeeee' : s.fill) })} aria-label="Тип заливки">
            <option value="solid">Сплошная</option><option value="none">Нет</option>
          </select>
          <Color value={s.fill} onChange={v => set({ fill: v })} />
        </Row>
        <Row label="Граница">
          <select value={s.borderStyle} onChange={e => set({ borderStyle: e.target.value as BorderStyle, ...(e.target.value !== 'none' && !s.borderWidth ? { borderWidth: 1 } : {}) })} aria-label="Тип границы">
            {BORDERS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
          <Color value={s.borderColor} onChange={v => set({ borderColor: v })} />
        </Row>
        <select className="wide" value={thickName(s.borderStyle === 'none' ? 0 : s.borderWidth)} aria-label="Толщина границы"
          onChange={e => { const w = THICK.find(t => t[1] === e.target.value)![0]; set(w ? { borderWidth: w, borderStyle: s.borderStyle === 'none' ? 'solid' : s.borderStyle } : { borderStyle: 'none' }) }}>
          {THICK.map(([, n]) => <option key={n}>{n}</option>)}
        </select>
      </Section>

      <div className="fp-section">
        <Row label="Длина">
          <input type="number" min={40} max={1200} placeholder="авто" value={s.width ?? ''} aria-label="Ширина темы, px"
            onChange={e => set({ width: e.target.value ? +e.target.value : undefined })} /><span className="muted">px</span>
          <button className={'mini' + (!s.width ? ' on' : '')} onClick={() => set({ width: undefined })}>По тексту</button>
        </Row>
      </div>

      <Section title="Текст">
        <div className="fp-row2">
          <select value={s.fontFamily} onChange={e => set({ fontFamily: e.target.value })} aria-label="Шрифт">
            {[...new Set([s.fontFamily, ...FONTS])].map(f => <option key={f} value={f}>{fontName(f)}</option>)}
          </select>
          <select value={s.fontSize} onChange={e => set({ fontSize: +e.target.value })} aria-label="Размер шрифта" className="narrow">
            {[...new Set([s.fontSize, ...SIZES])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="fp-row2">
          <select value={s.fontWeight} onChange={e => set({ fontWeight: e.target.value as TopicStyle['fontWeight'] })} aria-label="Начертание">
            {WEIGHT.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
          <Color value={s.textColor} onChange={v => set({ textColor: v })} />
        </div>
        <div className="seg-group">
          {B(s.fontWeight === 'bold' || s.fontWeight === 'extrabold', 'Жирный', <b>B</b>, () => set({ fontWeight: s.fontWeight === 'bold' || s.fontWeight === 'extrabold' ? 'normal' : 'bold' }))}
          {B(s.fontStyle === 'italic', 'Курсив', <i>I</i>, () => set({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' }))}
          {B(s.textDecoration === 'line-through', 'Зачёркнутый', <s>S</s>, () => set({ textDecoration: s.textDecoration === 'line-through' ? 'none' : 'line-through' }))}
          {B(s.textDecoration === 'underline', 'Подчёркнутый', <u>U</u>, () => set({ textDecoration: s.textDecoration === 'underline' ? 'none' : 'underline' }))}
          <select className="case-select" value={s.textTransform} onChange={e => set({ textTransform: e.target.value as TopicStyle['textTransform'] })} aria-label="Регистр" title="Регистр">
            <option value="none">Aa</option><option value="uppercase">AA</option><option value="lowercase">aa</option><option value="capitalize">Ab Cd</option>
          </select>
        </div>
        <div className="seg-group">
          {(['left', 'center', 'right'] as const).map(a => B(s.textAlign === a, a === 'left' ? 'По левому краю' : a === 'center' ? 'По центру' : 'По правому краю',
            <svg width={16} height={14}><path d={a === 'left' ? 'M2,3h12M2,7h8M2,11h12' : a === 'center' ? 'M2,3h12M4,7h8M2,11h12' : 'M2,3h12M6,7h8M2,11h12'} stroke="currentColor" strokeWidth={1.5} /></svg>,
            () => set({ textAlign: a })))}
        </div>
      </Section>

      <Section title="Структура" right={<Picker label="Структура" cols={3} value={structure as StructureId} options={[...(isRoot ? [] : [['' as StructureId, 'Как у родителя'] as [StructureId, string]]), ...STRUCT_OPTS]}
        render={v => <StructureIcon s={v} />} onChange={v => ed.setStructure((v || undefined) as StructureId | undefined)} />}>
        <select className="wide" value={structure} onChange={e => ed.setStructure((e.target.value || undefined) as StructureId | undefined)} aria-label="Структура">
          {!isRoot && <option value="">Как у родителя</option>}
          {STRUCTURES.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
      </Section>

      <Section title="Ветка" right={<Picker label="Форма линии" value={s.lineShape} options={LINES} render={v => <LineIcon s={v} />} onChange={v => set({ lineShape: v })} />}>
        <div className="fp-labels"><span>Линия</span><span>Конец</span></div>
        <div className="fp-row2">
          <select value={s.lineStyle} onChange={e => set({ lineStyle: e.target.value as TopicStyle['lineStyle'] })} aria-label="Штрих линии">
            <option value="solid">───────</option><option value="dashed">─ ─ ─ ─</option><option value="dotted">· · · · · ·</option>
          </select>
          <select className="narrow" value={s.lineEnd} onChange={e => set({ lineEnd: e.target.value as TopicStyle['lineEnd'] })} aria-label="Окончание линии">
            <option value="none">—</option><option value="arrow">→</option>
          </select>
        </div>
        <div className="fp-row2">
          <select value={thickName(s.lineWidth)} onChange={e => set({ lineWidth: THICK.find(t => t[1] === e.target.value)![0] || 1 })} aria-label="Толщина линии">
            {THICK.slice(1).map(([, n]) => <option key={n}>{n}</option>)}
          </select>
          <Color value={s.lineColor} onChange={v => set({ lineColor: v })} />
        </div>
        {isRoot && <>
          <label className="fp-toggle"><span>Цветные ветки</span><Toggle on={isColored(sheet)} onChange={v => ed.setSheet({ rainbow: v })} /></label>
          {isColored(sheet) && <ColorThemeSelect sheet={sheet} />}
        </>}
      </Section>

      <TopicElements topic={ref.topic} />
      <div className="fp-buttons fp-bottom">
        <button onClick={() => ed.copyStyle(s)} title="⌥⌘C">Копировать стиль</button>
        <button onClick={() => ed.pasteStyle()} disabled={!useEditor.getState().styleClipboard} title="⌥⌘V">Вставить стиль</button>
      </div>
      <button className="wide reset" onClick={() => ed.clearStyle()} title="⌥⌘0">Сбросить стиль</button>
    </>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={'toggle-sw' + (on ? ' on' : '')} onClick={() => onChange(!on)}><span /></button>
}

const Swatch = ({ t }: { t: ColorTheme }) => (
  t.id === 'rainbow'
    ? <span className="ct-bar" style={{ background: `linear-gradient(90deg, ${t.colors.join(', ')})` }} />
    : <span className="ct-bar">{(t.swatch ?? t.colors).slice(0, 6).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
)

/** «Цветовая тема» как в веб-версии: кнопка с образцом и всплывающий выбор «Цветные / Классические». */
function ColorThemeSelect({ sheet }: { sheet: Sheet }) {
  const ed = useEditor.getState()
  const cur = getColorTheme(sheet.palette)
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState<ColorTheme['group']>(cur.group)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="ct-select" ref={ref}>
      <button className="ct-btn" aria-label="Цветовая тема" aria-expanded={open} onClick={() => { setGroup(cur.group); setOpen(o => !o) }}>
        <span className="ct-mini">{cur.colors.slice(0, 6).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
        <span className="ct-name">{cur.name}</span>
        <svg width={10} height={10} viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.2} /></svg>
      </button>
      {open && (
        <div className="ct-pop" role="dialog" aria-label="Выбор цветовой темы" style={(() => {
          const r = ref.current!.getBoundingClientRect()
          return { top: Math.max(60, Math.min(r.top - 80, window.innerHeight - 420)), left: r.left - 330 }
        })()}>
          <div className="ct-tabs">
            <button className={group === 'colorful' ? 'on' : ''} onClick={() => setGroup('colorful')}>Цветные</button>
            <button className={group === 'classic' ? 'on' : ''} onClick={() => setGroup('classic')}>Классические</button>
          </div>
          <div className="ct-grid">
            {COLOR_THEMES.filter(t => t.group === group).map(t => (
              <button key={t.id} className={'ct-item' + (t.id === cur.id ? ' on' : '')} aria-label={'Цветовая тема ' + t.name}
                onClick={() => ed.setSheet({ palette: t.id, theme: 'classic', rainbow: undefined, background: undefined })}>
                <span className="ct-label">{t.name}</span><Swatch t={t} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Карточка структуры карты (как вверху вкладки «Карта» в веб-версии) */
function StructureCard({ sheet }: { sheet: Sheet }) {
  const ed = useEditor.getState()
  const cur = STRUCTURES.find(st => st.id === (sheet.structure ?? 'mindmap')) ?? STRUCTURES[0]
  return (
    <label className="struct-card">
      <svg width={64} height={32} viewBox="0 0 64 32" fill="none" stroke="#bdc2c7" strokeWidth={1.2} strokeLinecap="round">
        <rect x={24} y={13} width={16} height={6} rx={2} /><path d="M24 16C18 16 18 8 12 8M24 16C18 16 18 24 12 24M40 16C46 16 46 8 52 8M40 16C46 16 46 24 52 24" />
        <path d="M4 8h8M4 24h8M52 8h8M52 24h8" />
      </svg>
      <span>{cur.name}</span>
      <svg width={10} height={10} viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.2} /></svg>
      <select value={cur.id} aria-label="Структура карты" onChange={e => ed.setSheet({ structure: e.target.value as StructureId })}>
        {STRUCTURES.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
      </select>
    </label>
  )
}

function TopicElements({ topic }: { topic: Topic }) {
  const ed = useEditor.getState()
  const set = (p: Partial<Topic>) => ed.setTopic([topic.id], p)
  const img = topic.image
  const has = img || topic.attachment || topic.href || topic.equation || topic.labels?.length || topic.task || topic.markers?.length || topic.audio
  if (!has) return null
  return (
    <Section title="Элементы темы">
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
      {topic.audio && <Row label="Аудиозаметка"><audio controls src={topic.audio.url} style={{ width: 150, height: 28 }} />
        <button className="mini" onClick={() => set({ audio: undefined })}>×</button></Row>}
      {topic.href && <Row label="Ссылка"><button className="mini" onClick={() => ed.setDialog({ kind: 'link', id: topic.id })}>Изменить</button>
        <button className="mini" onClick={() => set({ href: undefined })}>×</button></Row>}
      {topic.equation && <Row label="Формула"><button className="mini" onClick={() => ed.setDialog({ kind: 'equation', id: topic.id })}>Изменить</button>
        <button className="mini" onClick={() => set({ equation: undefined })}>×</button></Row>}
      {!!topic.labels?.length && <Row label="Метки"><button className="mini" onClick={() => ed.setDialog({ kind: 'labels', id: topic.id })}>Изменить</button>
        <button className="mini" onClick={() => set({ labels: undefined })}>×</button></Row>}
      {topic.task && <Row label="To-Do"><label><input type="checkbox" checked={topic.task.done} onChange={() => ed.toggleTask(topic.id)} /> выполнено</label>
        <button className="mini" onClick={() => set({ task: undefined })}>×</button></Row>}
      {!!topic.markers?.length && <Row label="Маркеры"><button className="mini" onClick={() => set({ markers: undefined })}>Убрать все</button></Row>}
    </Section>
  )
}

// ---------- вкладка «Карта» ----------

function MapTab({ sheet }: { sheet: Sheet }) {
  const ed = useEditor.getState()
  const tog = (label: string, key: keyof Sheet, val?: boolean) => (
    <label className="fp-toggle"><span>{label}</span><Toggle label={label} on={val ?? !!sheet[key]} onChange={v => ed.setSheet({ [key]: v } as Partial<Sheet>)} /></label>
  )
  return (
    <>
      <div className="fp-section">
        <StructureCard sheet={sheet} />
      </div>
      <div className="fp-section">
        <div className="fp-cap">Цветовая тема</div>
        <ColorThemeSelect sheet={sheet} />
      </div>
      <div className="fp-section">
        <Row label="Цвет фона"><Color value={sheetBackground(sheet)} onChange={v => ed.setSheet({ background: v })} />
          {sheet.background && <button className="mini" onClick={() => ed.setSheet({ background: undefined })} title="Как в цветовой теме" aria-label="Сбросить цвет фона">↺</button>}</Row>
      </div>
      <div className="fp-section">
        <div className="fp-cap">Шрифт карты</div>
        <select className="wide" value={sheet.globalFont ?? ''} onChange={e => ed.setSheet({ globalFont: e.target.value || undefined })} aria-label="Шрифт карты">
          <option value="">По умолчанию</option>
          {FONTS.map(f => <option key={f} value={f}>{fontName(f)}</option>)}
        </select>
        <div className="fp-cap">Толщина линий веток</div>
        <select className="wide" value={sheet.branchLineWidth ?? ''} onChange={e => ed.setSheet({ branchLineWidth: e.target.value ? +e.target.value : undefined })} aria-label="Толщина линий веток">
          <option value="">По умолчанию</option>
          {THICK.slice(1).map(([w, n]) => <option key={w} value={w}>{n}</option>)}
        </select>
        <label className="fp-check"><input type="checkbox" role="switch" aria-label="Цветные ветки" checked={isColored(sheet)} onChange={e => ed.setSheet({ rainbow: e.target.checked })} />
          <span>Цветные ветки</span></label>
      </div>
      <div className="fp-section">
        <div className="fp-title">Стиль карты</div>
        {tog('Баланс карты', 'balance')}
        {tog('Компактная карта', 'compact')}
      </div>
      <div className="fp-section">
        <div className="fp-title">Отображение тем</div>
        {tog('Одинаковая длина тем', 'uniformWidth')}
        {tog('Показывать все заметки', 'showNotes')}
        {tog('Автоцвет плавающих тем', 'autoColorFloating')}
      </div>
      <div className="fp-section">
        <div className="fp-title">Связи</div>
        {tog('Цвет линии как у темы', 'relColorFollowTopic')}
      </div>
      <div className="fp-section">
        <div className="fp-title">Дополнительно</div>
        {tog('Свободное положение веток', 'freeBranch')}
        {tog('Легенда маркеров', 'legend')}
        <div className="fp-sub">Шрифт для CJK</div>
        <select className="wide" value={sheet.cjkFont ?? ''} onChange={e => ed.setSheet({ cjkFont: e.target.value || undefined })} aria-label="Шрифт CJK">
          <option value="">По умолчанию</option>
          <option value='"Noto Sans CJK SC", "PingFang SC", sans-serif'>Noto Sans CJK / PingFang</option>
          <option value='"Hiragino Sans", "Yu Gothic", sans-serif'>Hiragino / Yu Gothic</option>
          <option value='"Apple SD Gothic Neo", "Malgun Gothic", sans-serif'>Apple SD Gothic / Malgun</option>
        </select>
      </div>
    </>
  )
}

// ---------- вкладка «Презентация» ----------

function PitchTab({ sheet }: { sheet: Sheet }) {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const id = selection[selection.length - 1]
  const ref = id ? indexSheet(sheet).get(id) : undefined
  const p = ref?.topic.pitch ?? {}
  const setP = (patch: Partial<NonNullable<Topic['pitch']>>) => ref && ed.setTopic(selection, { pitch: { ...p, ...patch } })
  const dark = (sheet.pitchTheme ?? 'dark') === 'dark'
  const ratio = sheet.pitchRatio ?? 'auto'
  const kids = ref?.topic.children ?? []
  const layouts: [NonNullable<NonNullable<Topic['pitch']>['layout']>, string, string][] = [
    ['list', 'Скобка', 'M7,3Q5,3 5,5V7Q5,8 3.5,8Q5,8 5,9V11Q5,13 7,13M10,4h6M10,8h6M10,12h6'], ['bullets', 'Маркированный список', 'M4,4h.1M8,4h8M4,8h.1M8,8h8M4,12h.1M8,12h8'],
    ['indent', 'С отступом', 'M3,4h13M7,8h9M7,12h9M4.5,6v6'], ['branch', 'Ветка', 'M3,8h3M6,8Q8,8 9,4.5h7M6,8h10M6,8Q8,8 9,11.5h7'], ['columns', 'Колонки', 'M3,4h14M5,7v6M10,7v6M15,7v6'],
  ]
  const W = 232, H = Math.round(W / (ratio === 'auto' || ratio === '16:9' ? 16 / 9 : ratio === '4:3' ? 4 / 3 : ratio === '9:16' ? 9 / 16 : 3 / 4))
  const slide: Slide | null = ref ? (kids.length && p.subSlides !== 'no'
    ? { kind: 'overview', topic: ref.topic, items: kids, crumbs: [], layout: p.layout ?? 'list', reveal: false, root: ref.kind === 'root' }
    : { kind: 'title', topic: ref.topic, crumbs: [] }) : null
  const vis = (v: string | undefined) => v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'auto'
  return (
    <>
      <div className="fp-sub strong">Вид в режиме презентации</div>
      <div className="pitch-preview" style={{ height: Math.min(H, 232) }}>
        {slide ? <div className={'pitch ' + (dark ? 'dark' : 'light')} style={{ position: 'relative', inset: 'auto', width: W, height: Math.min(H, 232), zIndex: 0 }}>
          <div className="pitch-stage" style={{ width: W, height: Math.min(H, 232) }}><SlideView slide={slide} step={0} W={W} H={Math.min(H, 232)} anim={false} /></div>
        </div> : <span className="muted">Выберите тему</span>}
      </div>
      <button className="wide fp-btn" onClick={() => ed.setSheet({ pitchTheme: dark ? 'light' : 'dark' })}>Сменить тему</button>
      <Row label="Соотношение сторон">
        <select value={ratio} onChange={e => ed.setSheet({ pitchRatio: e.target.value as Sheet['pitchRatio'] })} aria-label="Соотношение сторон" className="sel-sm">
          <option value="auto">Авто</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="9:16">9:16</option><option value="3:4">3:4</option>
        </select>
      </Row>
      {ref && <>
        <div className="fp-sep" />
        <Row label="Слайд темы">
          <select value={vis(p.slide)} onChange={e => setP({ slide: e.target.value as 'auto' })} aria-label="Слайд темы" className="sel-sm">
            <option value="auto">Авто</option><option value="yes">Видимый</option><option value="no">Скрытый</option>
          </select>
        </Row>
        {kids.length > 0 && <>
          <div className="fp-sep" />
          <Row label="Слайд-список">
            <select value={vis(p.subSlides)} onChange={e => setP({ subSlides: e.target.value as 'auto' })} aria-label="Слайд-список" className="sel-sm">
              <option value="auto">Авто</option><option value="yes">Видимый</option><option value="no">Скрытый</option>
            </select>
          </Row>
          <div className="fp-cap">Показ</div>
          <select className="wide" value={p.delivery ?? 'drill'} onChange={e => setP({ delivery: e.target.value as 'drill' })} aria-label="Показ">
            <option value="drill">По одной — с погружением</option><option value="one">По одной</option><option value="all">Все сразу</option>
          </select>
          <div className="fp-cap">Раскладка</div>
          <div className="seg-group">
            {layouts.map(([v, n, d]) => (
              <button key={v} className={'seg-btn' + ((p.layout ?? 'list') === v ? ' on' : '')} title={n} aria-label={n} onClick={() => setP({ layout: v })}>
                <svg width={20} height={16}><path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
          </div>
        </>}
      </>}
    </>
  )
}

// ---------- связь / граница ----------

function ElementFormat({ sheet }: { sheet: Sheet }) {
  const { element } = useEditor()
  const ed = useEditor.getState()
  if (element?.kind === 'relationship') {
    const r = sheet.relationships?.find(x => x.id === element.id)
    if (!r) return null
    const up = (p: Partial<Relationship>) => ed.updateRelationship(r.id, p)
    return (
      <>
        <div className="fp-title">Связь</div>
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
        <label className="fp-toggle"><span>Стрелка в начале</span><Toggle on={!!r.arrowStart} onChange={v => up({ arrowStart: v })} /></label>
        <label className="fp-toggle"><span>Стрелка в конце</span><Toggle on={r.arrowEnd !== false} onChange={v => up({ arrowEnd: v })} /></label>
        <div className="fp-buttons" style={{ marginTop: 10 }}>
          <button onClick={() => up({ cp1: undefined, cp2: undefined })}>Сбросить изгиб</button>
          <button className="danger" onClick={ed.removeElement}>Удалить связь</button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Изгиб — перетаскиванием белых точек. Двойной щелчок по линии — подпись.</p>
      </>
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
      <>
        <div className="fp-title">Граница</div>
        <Row label="Заголовок"><input value={b.title ?? ''} onChange={e => up({ title: e.target.value })} /></Row>
        <Row label="Цвет линии"><Color value={b.color ?? '#667085'} onChange={v => up({ color: v })} /></Row>
        <Row label="Заливка"><Color value={b.fill ?? 'transparent'} allowNone onChange={v => up({ fill: v === 'transparent' ? undefined : v })} /></Row>
        <Row label="Линия">
          <select value={b.lineStyle ?? 'dashed'} onChange={e => up({ lineStyle: e.target.value as BorderStyle })}>
            {BORDERS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </Row>
        <div className="fp-buttons" style={{ marginTop: 10 }}><button className="danger" onClick={ed.removeElement}>Удалить границу</button></div>
      </>
    )
  }
  return null
}

// ---------- панель ----------

export default function FormatPanel({ sheet }: { sheet: Sheet }) {
  const { element } = useEditor()
  const [tab, setTab] = useState<'style' | 'pitch' | 'map'>('style')
  return (
    <div className="side-panel format-panel" data-testid="format-panel">
      <div className="seg-tabs">
        <button className={tab === 'style' ? 'on' : ''} onClick={() => setTab('style')}>Стиль</button>
        <button className={tab === 'pitch' ? 'on' : ''} onClick={() => setTab('pitch')}>Презентация</button>
        <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>Карта</button>
      </div>
      <div className="fp-scroll">
        {tab === 'style' && (element ? <ElementFormat sheet={sheet} /> : <TopicStyleTab sheet={sheet} />)}
        {tab === 'pitch' && <PitchTab sheet={sheet} />}
        {tab === 'map' && <MapTab sheet={sheet} />}
      </div>
    </div>
  )
}

