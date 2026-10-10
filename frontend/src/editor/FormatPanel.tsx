// Панель «Формат» (как в XMind): вкладки «Стиль / Презентация / Карта».
import { SlideView, type Slide } from './Presentation'
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Boundary, BorderStyle, LineShape, Relationship, ShapeId, Sheet, StructureId, Topic, TopicStyle } from './model'
import { indexSheet, levelOf } from './model'
import { STRUCTURES } from './layout'
import { COLOR_THEMES, ColorTheme, FullStyle, WEIGHTS, getColorTheme, isColored, MAP_FONT, resolveStyle, sheetBackground } from './themes'
import { shapePath, edgePath } from './paths'
import { currentLayout, useEditor } from './store'
import { sheetSvgMarkup } from '../io/image'
import Icon from '../ui/Icon'
import { Select } from '../ui/Select'

// ---------- элементы управления ----------

const SHAPES: [ShapeId, string][] = [['rect', 'Rectangle'], ['rounded', 'Rounded Rectangle'], ['capsule', 'Capsule'],
  ['ellipse', 'Ellipse'], ['diamond', 'Diamond'], ['hexagon', 'Hexagon'], ['parallelogram', 'Parallelogram'],
  ['underline', 'Underline'], ['none', 'No Shape']]
const LINES: [LineShape, string][] = [['curve', 'Curve'], ['straight', 'Straight'], ['elbow', 'Elbow'],
  ['rounded', 'Rounded Elbow'], ['taper', 'Tapered'], ['none', 'None']]
const BORDERS: [BorderStyle, string][] = [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['none', 'None']]
const THICK: [number, string][] = [[0, 'None'], [1, 'Extra Thin'], [2, 'Thin'], [3, 'Medium'], [4, 'Bold'], [5, 'Extra Bold']]
const WEIGHT: [NonNullable<TopicStyle['fontWeight']>, string][] = [['normal', 'Regular'], ['medium', 'Medium'], ['bold', 'Bold'], ['extrabold', 'ExtraBold']]
const SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 30, 36, 42, 48, 56, 64]
export const FONTS = [MAP_FONT, 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 'Arial, sans-serif', 'Verdana, sans-serif',
  '"Trebuchet MS", sans-serif', 'Georgia, serif', '"Times New Roman", serif', '"Courier New", monospace']
export const fontName = (f: string) => f.split(',')[0].replace(/"/g, '').replace('system-ui', 'System')
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
      <input type="color" aria-label="Color" value={isNone || !/^#[0-9a-f]{6}$/i.test(value) ? '#ffffff' : value} onChange={e => onChange(e.target.value)} />
      {allowNone && <button className={'mini' + (isNone ? ' on' : '')} onClick={() => onChange('transparent')} title="No Fill">∅</button>}
    </span>
  )
}

/** Выпадающий список с картинками (фигура, структура, линия ветки) */
function Picker<T extends string>({ value, options, render, onChange, label, cols = 3, button, className = '' }: {
  value: T; options: [T, string][]; render: (v: T) => ReactNode; onChange: (v: T) => void; label: string; cols?: number
  /** своё содержимое кнопки (широкий список, карточка структуры) */
  button?: ReactNode; className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !pop.current?.contains(t)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const away = () => setOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    window.addEventListener('resize', away)
    // прокрутка панели уводит кнопку — закрываем, как обычный выпадающий список
    const scroller = ref.current?.closest('.fp-scroll')
    scroller?.addEventListener('scroll', away)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); window.removeEventListener('resize', away); scroller?.removeEventListener('scroll', away) }
  }, [open])
  // список поверх интерфейса (портал): под кнопкой по правому краю, у краёв окна — сдвиг и переворот вверх
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = ref.current!.getBoundingClientRect(), w = pop.current!.offsetWidth, h = pop.current!.offsetHeight
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
    let top = r.bottom + 4
    if (top + h > window.innerHeight - 8) top = r.top - h - 4 >= 8 ? r.top - h - 4 : Math.max(8, window.innerHeight - h - 8)
    setPos({ left, top })
  }, [open])
  return (
    <div className={'picker ' + className} ref={ref}>
      <button className={'picker-btn' + (open ? ' on' : '')} onClick={() => setOpen(o => !o)} aria-label={label} aria-expanded={open} title={options.find(o => o[0] === value)?.[1] ?? label}>
        {button ?? <>{render(value)}<Icon name="chevron" size={12} /></>}
      </button>
      {open && createPortal(
        <div ref={pop} className="picker-pop" role="listbox" aria-label={label}
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, position: 'fixed', zIndex: 1000, right: 'auto', left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          {options.map(([v, name]) => (
            <button key={v} role="option" aria-selected={v === value} className={v === value ? 'on' : ''} title={name}
              onClick={() => { onChange(v); setOpen(false) }}>{render(v)}<span>{name}</span></button>
          ))}
        </div>, document.body)}
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

const NUMBERING: { value: NonNullable<Topic['numbering']>; label: string }[] = [
  { value: 'none', label: 'None' }, { value: '1', label: '1.2.3.' }, { value: 'A', label: 'A.B.C.' }, { value: 'a', label: 'a.b.c.' }, { value: 'I', label: 'I.II.III.' }]
const VIS_OPTS = [{ value: 'auto', label: 'Auto (Visible)' }, { value: 'yes', label: 'Visible' }, { value: 'no', label: 'Hidden' }]
const STRUCT_OPTS: [StructureId, string][] = STRUCTURES.map(s => [s.id, s.name])

// ---------- вкладка «Стиль» для темы ----------

/** Готовые стили темы (как в веб-версии): «Очень важно», «Важно», «Зачёркнуто», «По умолчанию» */
function presets(s: FullStyle): [string, TopicStyle | null, Partial<FullStyle>][] {
  return [
    ['Very Important', { fill: '#7f00ac', textColor: '#ffffff', fontWeight: 'bold', borderStyle: 'none', borderWidth: 0, textDecoration: 'none' }, {}],
    ['Important', { fill: '#82004a', textColor: '#ffffff', fontWeight: 'bold', borderStyle: 'none', borderWidth: 0, textDecoration: 'none' }, {}],
    ['Strikethrough', { fill: '#ffffff', textColor: '#000000', borderStyle: 'solid', borderWidth: 2, borderColor: s.lineColor, textDecoration: 'line-through' }, {}],
    ['Default', null, {}],
  ]
}

function StylePreview({ s, label, bg, base }: { s: FullStyle; label: string; bg?: string; base?: FullStyle }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  const ed = useEditor.getState()
  const pill = (st: FullStyle, text: string) => (
    <span className="sp-topic" style={{
      background: st.fill === 'transparent' ? 'transparent' : st.fill, color: st.textColor,
      border: st.borderStyle === 'none' || !st.borderWidth ? '1px solid transparent' : `${Math.min(3, st.borderWidth)}px ${st.borderStyle} ${st.borderColor}`,
      fontWeight: WEIGHTS[st.fontWeight], textDecoration: st.textDecoration,
    }}>{text}</span>
  )
  return (
    <div className="style-preview-wrap" ref={ref}>
      <button className="style-preview-btn" aria-label="Style presets" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width={10} height={10} viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.2} /></svg>
      </button>
      {open && base && (
        <div className="style-presets" role="menu">
          {presets(base).map(([n, st]) => (
            <button key={n} role="menuitem" aria-label={'Style ' + n} onClick={() => {
              const sel = useEditor.getState().selection
              if (st) ed.setStyle(st)
              else ed.setTopic(sel, { style: undefined })
              setOpen(false)
            }}>{pill(st ? { ...base, ...st } as FullStyle : base, n)}</button>
          ))}
        </div>
      )}
    <div className="style-preview" style={bg ? { background: bg } : undefined}>
      <div className="sp-topic" style={{
        background: s.fill === 'transparent' ? 'transparent' : s.fill, color: s.textColor,
        border: s.borderStyle === 'none' || !s.borderWidth ? '1px solid transparent' : `${Math.min(3, s.borderWidth)}px ${s.borderStyle} ${s.borderColor}`,
        borderRadius: s.shape === 'capsule' || s.shape === 'ellipse' ? 20 : s.shape === 'rect' ? 2 : 7,
        fontWeight: ({ normal: 400, medium: 500, bold: 700, extrabold: 800 } as Record<string, number>)[s.fontWeight],
        fontStyle: s.fontStyle, borderBottom: s.shape === 'underline' ? `2px solid ${s.borderColor}` : undefined,
      }}>{label}</div>
    </div>
    </div>
  )
}

const LEVEL_NAME: Record<string, string> = { central: 'Central Topic', main: 'Main Topic', sub: 'Subtopic', floating: 'Floating Topic', summary: 'Summary', callout: 'Callout' }

function TopicStyleTab({ sheet }: { sheet: Sheet }) {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const idx = indexSheet(sheet)
  const id = selection[selection.length - 1]
  const ref = id ? idx.get(id) : undefined
  if (!ref) return <p className="muted fp-empty">Select a topic to change its style.</p>
  const s = resolveStyle(sheet, ref)
  const set = (p: TopicStyle) => ed.setStyle(p)
  const isRoot = ref.kind === 'root'
  const level = levelOf(ref)
  const structure: StructureId | '' = isRoot ? sheet.structure ?? 'mindmap' : (ref.topic.structure ?? '')
  const B = (on: boolean, label: string, ch: ReactNode, fn: () => void) =>
    <button className={'seg-btn' + (on ? ' on' : '')} title={label} aria-label={label} onClick={fn}>{ch}</button>
  return (
    <>
      {selection.length > 1 && <p className="muted" style={{ margin: '0 0 8px' }}>{selection.length} topics selected</p>}
      <StylePreview s={s} label={LEVEL_NAME[level]} bg={sheetBackground(sheet)} base={resolveStyle(sheet, { ...ref, topic: { ...ref.topic, style: undefined } })} />

      <Section title="Shape" right={<Picker label="Shape" value={s.shape} options={SHAPES} render={v => <ShapeIcon s={v} />} onChange={v => set({ shape: v })} />}>
        <Row label="Fill">
          <Select label="Fill type" className="fill-type" minWidth={120} value={s.fill === 'transparent' ? 'none' : 'solid'} onChange={v => set({ fill: v === 'none' ? 'transparent' : (s.fill === 'transparent' ? '#eeeeee' : s.fill) })}
            options={[{ value: 'solid', label: <i className="fill-ico" /> }, { value: 'none', label: 'None' }]} />
          <Color value={s.fill} onChange={v => set({ fill: v })} />
        </Row>
        <Row label="Border">
          {/* тип линии рамки; толщина «None» ниже убирает рамку, как в веб-версии */}
          <Select label="Border style" className="fill-type" minWidth={120} value={s.borderStyle === 'none' ? 'solid' : s.borderStyle}
            onChange={v => set({ borderStyle: v, ...(s.borderStyle === 'none' && !s.borderWidth ? { borderWidth: 1 } : {}) })}
            options={BORDERS.filter(b => b[0] !== 'none').map(([v, n]) => ({ value: v, label: <i className={'border-ico ' + v} title={n} /> }))} />
          <Color value={s.borderColor} onChange={v => set({ borderColor: v })} />
        </Row>
        <Select className="wide" label="Border width" value={thickName(s.borderStyle === 'none' ? 0 : s.borderWidth)}
          onChange={n => { const w = THICK.find(t => t[1] === n)![0]; set(w ? { borderWidth: w, borderStyle: s.borderStyle === 'none' ? 'solid' : s.borderStyle } : { borderStyle: 'none' }) }}
          options={THICK.map(([, n]) => ({ value: n, label: n }))} />
      </Section>

      <div className="fp-section">
        <Row label="Length">
          <label className="len-box"><input type="number" min={40} max={1200} placeholder={String(Math.round(currentLayout()?.boxes.get(ref.topic.id)?.w ?? 0) || 'auto')} value={s.width ?? ''} aria-label="Topic width, px"
            onChange={e => set({ width: e.target.value ? +e.target.value : undefined })} /><span>PX</span></label>
          <button className="fit-btn" disabled={!s.width} onClick={() => set({ width: undefined })}>Fit</button>
        </Row>
      </div>

      <Section title="Text">
        <div className="fp-row2">
          <Select label="Font" value={s.fontFamily} onChange={v => set({ fontFamily: v })}
            options={[...new Set([s.fontFamily, ...FONTS])].map(f => ({ value: f, label: <span style={{ fontFamily: f }}>{fontName(f)}</span> }))} display={fontName(s.fontFamily)} />
          <Select label="Font size" className="narrow" value={s.fontSize} onChange={v => set({ fontSize: v })}
            options={[...new Set([s.fontSize, ...SIZES])].sort((a, b) => a - b).map(n => ({ value: n, label: String(n) }))} />
        </div>
        <div className="fp-row2">
          <Select label="Font weight" value={s.fontWeight} onChange={v => set({ fontWeight: v })} options={WEIGHT.map(([v, n]) => ({ value: v, label: n }))} />
          <Color value={s.textColor} onChange={v => set({ textColor: v })} />
        </div>
        <div className="seg-group">
          {B(s.fontWeight === 'bold' || s.fontWeight === 'extrabold', 'Bold', <b>B</b>, () => set({ fontWeight: s.fontWeight === 'bold' || s.fontWeight === 'extrabold' ? 'normal' : 'bold' }))}
          {B(s.fontStyle === 'italic', 'Italic', <i>I</i>, () => set({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' }))}
          {B(s.textDecoration === 'line-through', 'Strikethrough', <s>S</s>, () => set({ textDecoration: s.textDecoration === 'line-through' ? 'none' : 'line-through' }))}
          {B(s.textDecoration === 'underline', 'Underline', <u>U</u>, () => set({ textDecoration: s.textDecoration === 'underline' ? 'none' : 'underline' }))}
          <Select label="Text case" title="Text case" className="case-select" minWidth={140} value={s.textTransform} onChange={v => set({ textTransform: v })} display="Tt"
            options={[{ value: 'none', label: 'None' }, { value: 'uppercase', label: 'UPPERCASE' }, { value: 'lowercase', label: 'lowercase' }, { value: 'capitalize', label: 'Capitalize' }] as { value: NonNullable<TopicStyle['textTransform']>; label: string }[]} />
        </div>
        <div className="seg-group">
          {(['left', 'center', 'right'] as const).map(a => B(s.textAlign === a, a === 'left' ? 'Align Left' : a === 'center' ? 'Align Center' : 'Align Right',
            <svg width={16} height={14}><path d={a === 'left' ? 'M2,3h12M2,7h8M2,11h12' : a === 'center' ? 'M2,3h12M4,7h8M2,11h12' : 'M2,3h12M6,7h8M2,11h12'} stroke="currentColor" strokeWidth={1.5} /></svg>,
            () => set({ textAlign: a })))}
        </div>
      </Section>

      <Section title="Structure" right={<Picker label="Structure" cols={3} value={structure as StructureId} options={[...(isRoot ? [] : [['' as StructureId, 'Follow Parent'] as [StructureId, string]]), ...STRUCT_OPTS]}
        render={v => <StructureIcon s={v} />} onChange={v => ed.setStructure((v || undefined) as StructureId | undefined)} />}>
        <Select className="wide" label="Structure name" value={structure} onChange={v => ed.setStructure((v || undefined) as StructureId | undefined)}
          options={[...(isRoot ? [] : [{ value: '' as StructureId | '', label: 'Follow Parent' }]), ...STRUCTURES.map(x => ({ value: x.id as StructureId | '', label: x.name }))]} />
      </Section>

      <Section title="Branch" right={<Picker label="Line shape" value={s.lineShape} options={LINES} render={v => <LineIcon s={v} />} onChange={v => set({ lineShape: v })} />}>
        <div className="fp-labels"><span>Line</span><span>End</span></div>
        <div className="fp-row2">
          <Select label="Line style" value={s.lineStyle} onChange={v => set({ lineStyle: v })}
            options={(['solid', 'dashed', 'dotted'] as const).map(v => ({ value: v, label: <i className={'line-ico ' + v} /> }))} />
          <Select label="Line end" className="narrow" minWidth={110} value={s.lineEnd} onChange={v => set({ lineEnd: v })}
            options={[{ value: 'none', label: <i className="line-ico solid" /> }, { value: 'arrow', label: <i className="line-ico arrow" /> }] as { value: NonNullable<TopicStyle['lineEnd']>; label: ReactNode }[]} />
        </div>
        <div className="fp-row2">
          <Select label="Line width" value={thickName(s.lineWidth)} onChange={n => set({ lineWidth: THICK.find(t => t[1] === n)![0] || 1 })}
            options={THICK.slice(1).map(([, n]) => ({ value: n, label: n }))} />
          <Color value={s.lineColor} onChange={v => set({ lineColor: v })} />
        </div>
        {isRoot && <>
          <label className="fp-toggle"><span>Colored Branch</span><Toggle on={isColored(sheet)} onChange={v => ed.setSheet({ rainbow: v })} /></label>
          {isColored(sheet) && <ColorThemeSelect sheet={sheet} />}
        </>}
      </Section>

      <Section title="Numbering">
        <Select className="wide" label="Numbering" value={ref.topic.numbering ?? 'none'} onChange={v => ed.setTopic(selection, { numbering: v === 'none' ? undefined : v })}
          options={NUMBERING} />
      </Section>

      <TopicElements topic={ref.topic} />
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
      <button className="ct-btn" aria-label="Color Theme" aria-expanded={open} onClick={() => { setGroup(cur.group); setOpen(o => !o) }}>
        <span className="ct-mini">{cur.colors.slice(0, 6).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
        <span className="ct-name">{cur.name}</span>
        <svg width={10} height={10} viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth={1.2} /></svg>
      </button>
      {open && (
        <div className="ct-pop" role="dialog" aria-label="Choose color theme" style={(() => {
          const r = ref.current!.getBoundingClientRect()
          return { top: Math.max(60, Math.min(r.top - 80, window.innerHeight - 420)), left: r.left - 330 }
        })()}>
          <div className="ct-tabs">
            <button className={group === 'colorful' ? 'on' : ''} onClick={() => setGroup('colorful')}>Colorful</button>
            <button className={group === 'classic' ? 'on' : ''} onClick={() => setGroup('classic')}>Classic</button>
          </div>
          <div className="ct-grid">
            {COLOR_THEMES.filter(t => t.group === group).map(t => (
              <button key={t.id} className={'ct-item' + (t.id === cur.id ? ' on' : '')} aria-label={'Color Theme ' + t.name}
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

/** Группы структур в окне выбора (как в веб-версии: Mind Map, Logic Chart, Brace Map, …) */
const STRUCT_GROUPS: [string, StructureId[]][] = [
  ['Mind Map', ['mindmap', 'mindmap-cw', 'mindmap-acw']], ['Logic Chart', ['logic-right', 'logic-left']], ['Brace Map', ['brace-right', 'brace-left']],
  ['Org Chart', ['org-down', 'org-up']], ['Tree Chart', ['tree-right', 'tree-left']], ['Timeline', ['timeline-h', 'timeline-v']],
  ['Fishbone', ['fishbone-right', 'fishbone-left']], ['Tree Table', ['tree-table']], ['Matrix', ['matrix']],
]
const groupOf = (id: StructureId) => STRUCT_GROUPS.find(g => g[1].includes(id))?.[0] ?? 'Mind Map'
const previewCache = new Map<string, string>()
/** серое превью структуры на образце карты */
function StructPreview({ id }: { id: StructureId }) {
  let src = previewCache.get(id)
  if (!src) {
    const t = (title: string, children: Topic[] = []): Topic => ({ id: title, title, children })
    const sample: Sheet = { id: 'p', title: '', structure: id, rainbow: false, rootTopic: t('Central Topic', [
      t('Main Topic', [t('Subtopic'), t('Subtopic 2')]), t('Main Topic 2', [t('Subtopic 3')]), t('Main Topic 3', [t('Subtopic 4')]), t('Main Topic 4', [t('Subtopic 5'), t('Subtopic 6')])]) }
    src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sheetSvgMarkup(sample).markup)
    previewCache.set(id, src)
  }
  return <img src={src} alt="" />
}

/** Карточка структуры карты и окно выбора слева от панели (как в веб-версии) */
function StructureCard({ sheet }: { sheet: Sheet }) {
  const ed = useEditor.getState()
  const cur = (sheet.structure ?? 'mindmap') as StructureId
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; height: number } | null>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', down); window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key) }
  }, [open])
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = btn.current!.getBoundingClientRect(), W = 390
    setPos({ left: Math.max(8, r.left - 12 - W), top: r.top, height: Math.min(422, window.innerHeight - r.top - 16) })
  }, [open])
  return (
    <>
      <button ref={btn} className={'struct-card' + (open ? ' on' : '')} aria-label="Map structure" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="sc-thumb"><StructPreview id={cur} /></span>
        <span className="sc-name">{groupOf(cur)}</span>
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 4.25 6 8.25l4.5-4" /></svg>
      </button>
      {open && createPortal(
        <div ref={pop} className="struct-gallery" role="listbox" aria-label="Map structure"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, maxHeight: pos?.height, visibility: pos ? 'visible' : 'hidden' }}>
          {STRUCT_GROUPS.map(([name, ids]) => (
            <div key={name} className="sg-group">
              <button className="sg-head" onClick={() => setClosed(c => { const n = new Set(c); if (n.has(name)) n.delete(name); else n.add(name); return n })}>
                <span className={'caret' + (closed.has(name) ? ' closed' : '')}><svg width={8} height={8}><path d="M0,1.5L8,1.5L4,6.5Z" fill="currentColor" /></svg></span>{name}
              </button>
              {!closed.has(name) && <div className="sg-grid">
                {ids.map(id => (
                  <button key={id} role="option" aria-selected={id === cur} aria-label={STRUCTURES.find(x => x.id === id)?.name} title={STRUCTURES.find(x => x.id === id)?.name}
                    className={'sg-item' + (id === cur ? ' on' : '')} onClick={() => { ed.setSheet({ structure: id }); setOpen(false) }}><StructPreview id={id} /></button>
                ))}
              </div>}
            </div>
          ))}
        </div>, document.body)}
    </>
  )
}

function TopicElements({ topic }: { topic: Topic }) {
  const ed = useEditor.getState()
  const set = (p: Partial<Topic>) => ed.setTopic([topic.id], p)
  const img = topic.image
  const has = img || topic.attachment || topic.href || topic.equation || topic.labels?.length || topic.task || topic.markers?.length || topic.audio
  if (!has) return null
  return (
    <Section title="Topic Elements">
      {img && !img.src.startsWith('emoji:') && (
        <Row label="Image width">
          <input type="number" min={16} max={1200} value={img.width}
            onChange={e => { const w = +e.target.value; set({ image: { ...img, width: w, height: Math.round(img.height * w / img.width) } }) }} />
          <button className="mini" onClick={() => set({ image: undefined })}>×</button>
        </Row>
      )}
      {img?.src.startsWith('emoji:') && <Row label="Sticker"><span>{img.src.slice(6)}</span>
        <input type="number" min={16} max={400} value={img.width} onChange={e => set({ image: { ...img, width: +e.target.value, height: +e.target.value } })} />
        <button className="mini" onClick={() => set({ image: undefined })}>×</button></Row>}
      {topic.attachment && <Row label="Attachment"><a href={topic.attachment.url} target="_blank" rel="noreferrer" className="ellipsis">{topic.attachment.name}</a>
        <button className="mini" onClick={() => set({ attachment: undefined })}>×</button></Row>}
      {topic.audio && <Row label="Audio Note"><audio controls src={topic.audio.url} style={{ width: 150, height: 28 }} />
        <button className="mini" onClick={() => set({ audio: undefined })}>×</button></Row>}
      {topic.href && <Row label="Link"><button className="mini" onClick={() => ed.setDialog({ kind: 'link', id: topic.id })}>Edit</button>
        <button className="mini" onClick={() => set({ href: undefined })}>×</button></Row>}
      {topic.equation && <Row label="Equation"><button className="mini" onClick={() => ed.setDialog({ kind: 'equation', id: topic.id })}>Edit</button>
        <button className="mini" onClick={() => set({ equation: undefined })}>×</button></Row>}
      {!!topic.labels?.length && <Row label="Labels"><button className="mini" onClick={() => ed.setDialog({ kind: 'labels', id: topic.id })}>Edit</button>
        <button className="mini" onClick={() => set({ labels: undefined })}>×</button></Row>}
      {topic.task && <Row label="To-Do"><label><input type="checkbox" checked={topic.task.done} onChange={() => ed.toggleTask(topic.id)} /> Done</label>
        <button className="mini" onClick={() => set({ task: undefined })}>×</button></Row>}
      {!!topic.markers?.length && <Row label="Markers"><button className="mini" onClick={() => set({ markers: undefined })}>Remove All</button></Row>}
    </Section>
  )
}

// ---------- вкладка «Карта» ----------

function MapTab({ sheet }: { sheet: Sheet }) {
  const ed = useEditor.getState()
  const tog = (label: string, key: keyof Sheet, val?: boolean, set?: (v: boolean) => void) => (
    <label className="fp-toggle"><span>{label}</span><Toggle label={label} on={val ?? !!sheet[key]} onChange={v => set ? set(v) : ed.setSheet({ [key]: v } as Partial<Sheet>)} /></label>
  )
  return (
    <>
      <div className="fp-section">
        <StructureCard sheet={sheet} />
      </div>
      <div className="fp-section">
        <div className="fp-cap">Color Theme</div>
        <ColorThemeSelect sheet={sheet} />
      </div>
      <div className="fp-section">
        <Row label="Background Color"><Color value={sheetBackground(sheet)} onChange={v => ed.setSheet({ background: v })} />
          {sheet.background && <button className="mini" onClick={() => ed.setSheet({ background: undefined })} title="From color theme" aria-label="Reset background color">↺</button>}</Row>
      </div>
      <div className="fp-section">
        <div className="fp-cap">Global Font</div>
        <Select className="wide" label="Global Font" value={sheet.globalFont ?? ''} onChange={v => ed.setSheet({ globalFont: v || undefined })}
          options={[{ value: '', label: 'Default' }, ...FONTS.map(f => ({ value: f, label: <span style={{ fontFamily: f }}>{fontName(f)}</span> }))]} />
        <div className="fp-cap">Branch Line Width</div>
        <Select className="wide" label="Branch Line Width" value={sheet.branchLineWidth ?? 0} onChange={v => ed.setSheet({ branchLineWidth: v || undefined })}
          options={[{ value: 0, label: 'Default' }, ...THICK.slice(1).map(([w, n]) => ({ value: w, label: n }))]} />
        <label className="fp-check"><input type="checkbox" role="switch" aria-label="Colored Branch" checked={isColored(sheet)} onChange={e => ed.setSheet({ rainbow: e.target.checked })} />
          <span>Colored Branch</span></label>
      </div>
      <div className="fp-section">
        <div className="fp-title">Map Style</div>
        {tog('Balance Map', 'balance', sheet.balance !== false, v => ed.setBalance(v))}
        {tog('Compact Map', 'compact')}
      </div>
      <div className="fp-section">
        <div className="fp-title">Topic Display</div>
        {tog('Uniform Topic Length', 'uniformWidth')}
        {tog('Display All Notes', 'showNotes')}
        {tog('Auto-color Floating Topic', 'autoColorFloating', sheet.autoColorFloating !== false)}
      </div>
      <div className="fp-section">
        <div className="fp-title">Relationship</div>
        {tog('Line Color Follow Topic', 'relColorFollowTopic', sheet.relColorFollowTopic !== false)}
      </div>
      <div className="fp-section">
        <div className="fp-title">Advanced</div>
        {tog('Free Branch Position', 'freeBranch')}
        {tog('Flexible Floating Topic', 'flexibleFloating')}
        {tog('Topic Overlap', 'topicOverlap', sheet.topicOverlap !== false)}
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
    ['list', 'Brace', 'M7,3Q5,3 5,5V7Q5,8 3.5,8Q5,8 5,9V11Q5,13 7,13M10,4h6M10,8h6M10,12h6'], ['bullets', 'Bullets', 'M4,4h.1M8,4h8M4,8h.1M8,8h8M4,12h.1M8,12h8'],
    ['indent', 'Indent', 'M3,4h13M7,8h9M7,12h9M4.5,6v6'], ['branch', 'Branch', 'M3,8h3M6,8Q8,8 9,4.5h7M6,8h10M6,8Q8,8 9,11.5h7'], ['columns', 'Columns', 'M3,4h14M5,7v6M10,7v6M15,7v6'],
  ]
  const W = 232, H = Math.round(W / (ratio === 'auto' || ratio === '16:9' ? 16 / 9 : ratio === '4:3' ? 4 / 3 : ratio === '9:16' ? 9 / 16 : 3 / 4))
  const slide: Slide | null = ref ? (kids.length && p.subSlides !== 'no'
    ? { kind: 'overview', topic: ref.topic, items: kids, crumbs: [], layout: p.layout ?? 'list', reveal: false, root: ref.kind === 'root' }
    : { kind: 'title', topic: ref.topic, crumbs: [] }) : null
  const vis = (v: string | undefined) => v === 'yes' ? 'yes' : v === 'no' ? 'no' : 'auto'
  return (
    <>
      <div className="fp-sub strong">Display in Pitch Mode</div>
      <div className="pitch-preview" style={{ height: Math.min(H, 232) }}>
        {slide ? <div className={'pitch ' + (dark ? 'dark' : 'light')} style={{ position: 'relative', inset: 'auto', width: W, height: Math.min(H, 232), zIndex: 0 }}>
          <div className="pitch-stage" style={{ width: W, height: Math.min(H, 232) }}><SlideView slide={slide} step={0} W={W} H={Math.min(H, 232)} anim={false} /></div>
        </div> : <span className="muted">Select a topic</span>}
      </div>
      <button className="wide fp-btn" onClick={() => ed.setSheet({ pitchTheme: dark ? 'light' : 'dark' })}>Change Theme</button>
      <Row label="Aspect Ratio">
        <Select label="Aspect Ratio" className="sel-sm" value={ratio} onChange={v => ed.setSheet({ pitchRatio: v })}
          options={(['auto', '16:9', '4:3', '9:16', '3:4'] as NonNullable<Sheet['pitchRatio']>[]).map(v => ({ value: v, label: v === 'auto' ? 'Auto' : v }))} />
      </Row>
      {ref && <>
        <div className="fp-sep" />
        <Row label="Topic Slide">
          <Select label="Topic Slide" className="sel-sm" minWidth={140} value={vis(p.slide)} onChange={v => setP({ slide: v as 'auto' })} display={vis(p.slide) === 'auto' ? 'Auto' : undefined} options={VIS_OPTS} />
        </Row>
        {kids.length > 0 && <>
          <div className="fp-sep" />
          <Row label="List Slide">
            <Select label="List Slide" className="sel-sm" minWidth={140} value={vis(p.subSlides)} onChange={v => setP({ subSlides: v as 'auto' })} display={vis(p.subSlides) === 'auto' ? 'Auto' : undefined} options={VIS_OPTS} />
          </Row>
          <div className="fp-cap">Delivery</div>
          <Select className="wide" label="Delivery" value={p.delivery ?? 'drill'} onChange={v => setP({ delivery: v })}
            options={([['drill', 'One by One - Drill in'], ['one', 'One by One'], ['all', 'All at Once']] as const).map(([value, label]) => ({ value, label }))} />
          <div className="fp-cap">Layout</div>
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
        <div className="fp-title">Relationship</div>
        <Row label="Label"><input value={r.title ?? ''} onChange={e => up({ title: e.target.value })} /></Row>
        <Row label="Color / Width">
          <Color value={r.color ?? '#667085'} onChange={v => up({ color: v })} />
          <input type="number" min={1} max={8} value={r.width ?? 2} onChange={e => up({ width: +e.target.value })} />
        </Row>
        <Row label="Line">
          <Select label="Line style" value={r.lineStyle ?? 'dashed'} onChange={v => up({ lineStyle: v })} options={BORDERS.filter(b => b[0] !== 'none').map(([v, n]) => ({ value: v, label: n }))} />
        </Row>
        <label className="fp-toggle"><span>Start Arrow</span><Toggle on={!!r.arrowStart} onChange={v => up({ arrowStart: v })} /></label>
        <label className="fp-toggle"><span>End Arrow</span><Toggle on={r.arrowEnd !== false} onChange={v => up({ arrowEnd: v })} /></label>
        <div className="fp-buttons" style={{ marginTop: 10 }}>
          <button onClick={() => up({ cp1: undefined, cp2: undefined })}>Reset Curve</button>
          <button className="danger" onClick={ed.removeElement}>Delete Relationship</button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Drag the white handles to bend the line. Double-click the line to add a label.</p>
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
        <div className="fp-title">Boundary</div>
        <Row label="Title"><input value={b.title ?? ''} onChange={e => up({ title: e.target.value })} /></Row>
        <Row label="Line Color"><Color value={b.color ?? '#667085'} onChange={v => up({ color: v })} /></Row>
        <Row label="Fill"><Color value={b.fill ?? 'transparent'} allowNone onChange={v => up({ fill: v === 'transparent' ? undefined : v })} /></Row>
        <Row label="Line">
          <Select label="Line style" value={b.lineStyle ?? 'dashed'} onChange={v => up({ lineStyle: v })} options={BORDERS.map(([v, n]) => ({ value: v, label: n }))} />
        </Row>
        <div className="fp-buttons" style={{ marginTop: 10 }}><button className="danger" onClick={ed.removeElement}>Delete Boundary</button></div>
      </>
    )
  }
  return null
}

// ---------- панель ----------

export default function FormatPanel({ sheet }: { sheet: Sheet }) {
  const { element } = useEditor()
  const [tab, setTab] = useState<'style' | 'pitch' | 'map'>('style')
  const none = !useEditor(s => s.selection.length)
  // как в веб-версии: без выделения — вкладка «Карта», «Стиль» и «Презентация» недоступны
  useEffect(() => { const was = prevNone.current; setTab(t => (none ? 'map' : t === 'map' && was ? 'style' : t)); prevNone.current = none }, [none])
  const prevNone = useRef(none)
  useEffect(() => {
    const f = (e: Event) => setTab((e as CustomEvent).detail)
    window.addEventListener('mm:format-tab', f)
    return () => window.removeEventListener('mm:format-tab', f)
  }, [])
  return (
    <div className="side-panel format-panel" data-testid="format-panel">
      <div className="seg-tabs">
        <button className={tab === 'style' ? 'on' : ''} disabled={none} onClick={() => setTab('style')}>Style</button>
        <button className={tab === 'pitch' ? 'on' : ''} disabled={none} onClick={() => setTab('pitch')}>Pitch</button>
        <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>Map</button>
      </div>
      <div className="fp-scroll">
        {tab === 'style' && (element ? <ElementFormat sheet={sheet} /> : <TopicStyleTab sheet={sheet} />)}
        {tab === 'pitch' && <PitchTab sheet={sheet} />}
        {tab === 'map' && <MapTab sheet={sheet} />}
      </div>
    </div>
  )
}

