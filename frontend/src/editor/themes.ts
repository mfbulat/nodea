import type { Level, Sheet, Topic, TopicRef, TopicStyle } from './model'
import { levelOf } from './model'

export type FullStyle = Required<Omit<TopicStyle, 'maxWidth' | 'width'>> & { maxWidth: number; width?: number }

export interface Theme {
  id: string
  name: string
  background: string
  rainbow: string[]
  levels: Record<Level, FullStyle>
  /** цветные ветки включены по умолчанию: основная тема залита цветом ветки, подтемы — его оттенком */
  colored?: boolean
}

/** Цветовые палитры веток (выбираются отдельно от темы) */
export const PALETTES: { id: string; name: string; colors: string[] }[] = [
  { id: 'dawn', name: 'Заря', colors: ['#f07470', '#f3a06e', '#a5d3b9', '#9fe2d8', '#8dcdf4', '#d48dea'] },
  { id: 'ocean', name: 'Океан', colors: ['#5b8def', '#4cc3d9', '#7bd4a8', '#3f6fb5', '#8fa7f5', '#5fb8c9'] },
  { id: 'forest', name: 'Лес', colors: ['#7cb66a', '#c7d36a', '#4f9a7d', '#a6c48a', '#e2b55e', '#6e9f5b'] },
  { id: 'candy', name: 'Карамель', colors: ['#ff8fab', '#ffc46b', '#9be08e', '#8ecbff', '#c9a0ff', '#ff9e80'] },
  { id: 'mono', name: 'Графит', colors: ['#5f6b7a', '#7d8896', '#9aa4b1', '#4a5562', '#6b7684', '#8b95a3'] },
  { id: 'vivid', name: 'Яркая', colors: ['#e5484d', '#f76b15', '#f5c400', '#30a46c', '#0090ff', '#8e4ec6'] },
]
export const getPalette = (id?: string) => PALETTES.find(p => p.id === id)

export const MAP_FONT = '"Montserrat", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT = MAP_FONT

function base(o: Partial<FullStyle>): FullStyle {
  return {
    shape: 'rounded', fill: '#ffffff', borderColor: '#9aa4b2', borderWidth: 1, borderStyle: 'solid',
    fontFamily: FONT, fontSize: 14, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
    textColor: '#1f2328', textAlign: 'center', lineShape: 'curve', lineWidth: 2, lineColor: '#9aa4b2',
    lineStyle: 'solid', lineEnd: 'none', textTransform: 'none',
    maxWidth: 260, ...o,
  }
}

function theme(id: string, name: string, background: string, rainbow: string[],
  central: Partial<FullStyle>, main: Partial<FullStyle>, sub: Partial<FullStyle>, floating?: Partial<FullStyle>, colored = false): Theme {
  const subStyle = base(sub)
  return {
    id, name, background, rainbow, colored,
    levels: {
      central: base({ fontSize: 22, fontWeight: 'bold', ...central }),
      main: base({ fontSize: 16, ...main }),
      sub: subStyle,
      floating: base({ fontSize: 15, ...(floating ?? main) }),
      summary: base({ fontSize: 15, ...main }),
      callout: base({ fontSize: 13, shape: 'rounded', fill: '#fff8db', borderColor: '#e2c35b', textColor: '#3d3200', lineColor: '#e2c35b' }),
    },
  }
}

const RAINBOW = ['#e05a47', '#f0a33a', '#d6c12f', '#4fae5b', '#3a9bd8', '#5a63d6', '#a35bd0', '#d4568f']

export const THEMES: Theme[] = [
  // тема по умолчанию: центральная без рамки, основные залиты цветом ветки, подтемы — его светлым оттенком
  theme('classic', 'Классика', '#ffffff', PALETTES[0].colors,
    { fill: 'transparent', borderStyle: 'none', borderWidth: 0, textColor: '#000000', fontSize: 30, fontWeight: 'extrabold', maxWidth: 480,
      lineWidth: 2, lineShape: 'curve', lineColor: '#9a9a9a' },
    { fill: '#eeeeee', borderStyle: 'none', borderWidth: 0, textColor: '#000000', fontSize: 18, fontWeight: 'medium',
      lineWidth: 2, lineShape: 'rounded', lineColor: '#9a9a9a' },
    { fill: '#f2f2f2', borderStyle: 'none', borderWidth: 0, textColor: '#333333', fontSize: 14,
      lineWidth: 2, lineShape: 'rounded', lineColor: '#9a9a9a' },
    { fill: '#e6e6e6', borderStyle: 'none', borderWidth: 0, textColor: '#000000', fontSize: 16, fontWeight: 'medium', lineWidth: 2, lineShape: 'rounded', lineColor: '#9a9a9a' },
    true),
  // строгая: тёмные рамки и линии 2px, синяя центральная, серые основные, подчёркнутые подтемы
  theme('plain', 'Строгая', '#ffffff', RAINBOW,
    { fill: '#3d4aa8', borderColor: '#141414', borderWidth: 2, textColor: '#ffffff', fontSize: 30, fontWeight: 'bold', maxWidth: 480,
      lineColor: '#141414', lineWidth: 2, lineShape: 'curve' },
    { fill: '#eeeeee', borderColor: '#141414', borderWidth: 2, textColor: '#333333', fontSize: 18,
      lineColor: '#141414', lineWidth: 2, lineShape: 'rounded' },
    { shape: 'underline', fill: 'transparent', borderColor: '#141414', borderWidth: 2, textColor: '#141414', fontSize: 14,
      lineColor: '#141414', lineWidth: 2, lineShape: 'rounded' },
    { fill: '#2f7d74', borderColor: '#141414', borderWidth: 2, textColor: '#ffffff', fontSize: 14, lineColor: '#141414', lineWidth: 2, lineShape: 'rounded' }),
  theme('fresh', 'Свежая', '#f7fbf8', RAINBOW,
    { fill: '#2e8b6a', borderColor: '#2e8b6a', textColor: '#ffffff', shape: 'capsule' },
    { fill: '#d8f0e6', borderColor: '#2e8b6a', lineColor: '#2e8b6a', shape: 'capsule' },
    { shape: 'capsule', fill: '#ffffff', borderColor: '#9fd4bf', lineColor: '#5fae8f', lineWidth: 1.5 }),
  theme('dark', 'Тёмная', '#1f232b', ['#ff7a6b', '#ffc35c', '#e8dc5a', '#6fd17d', '#5cbaf5', '#8a90ff', '#c88aff', '#ff85b8'],
    { fill: '#e9ecf2', borderColor: '#e9ecf2', textColor: '#1f232b' },
    { fill: '#353b47', borderColor: '#5c6577', textColor: '#e9ecf2', lineColor: '#7f8899' },
    { shape: 'underline', fill: 'transparent', borderColor: '#7f8899', textColor: '#d4d8e0', lineColor: '#7f8899', lineWidth: 1.5 }),
  theme('pastel', 'Пастель', '#fffaf5', ['#f4a6a0', '#f7c98b', '#e9dc8a', '#a8d8a0', '#9ccbe8', '#b4b0ea', '#d7aee6', '#f0b0cb'],
    { fill: '#f6d6c9', borderColor: '#d99a85', textColor: '#5a3a30', shape: 'ellipse' },
    { fill: '#fdeee6', borderColor: '#e2b4a2', textColor: '#5a3a30', lineColor: '#d99a85' },
    { shape: 'rounded', fill: '#ffffff', borderColor: '#efd2c5', textColor: '#5a3a30', lineColor: '#e2b4a2', lineWidth: 1.5 }),
  theme('contrast', 'Контраст', '#ffffff', RAINBOW,
    { fill: '#000000', borderColor: '#000000', textColor: '#ffffff', shape: 'rect' },
    { fill: '#ffd400', borderColor: '#000000', borderWidth: 2, shape: 'rect', lineColor: '#000000', fontWeight: 'bold' },
    { shape: 'rect', fill: '#ffffff', borderColor: '#000000', lineColor: '#000000', lineShape: 'elbow' }),
  theme('minimal', 'Минимал', '#ffffff', RAINBOW,
    { fill: 'transparent', borderColor: '#1f2328', borderWidth: 2, textColor: '#1f2328', shape: 'rounded' },
    { shape: 'underline', fill: 'transparent', borderColor: '#667085', lineColor: '#667085', lineWidth: 1.5 },
    { shape: 'none', fill: 'transparent', borderColor: '#667085', lineColor: '#b0b7c3', lineWidth: 1, fontSize: 13 }),
]

export const getTheme = (id?: string) => THEMES.find(t => t.id === id) ?? THEMES[0]

/** Итоговый стиль темы: тема оформления → радужные ветки → собственный стиль */
/** Цветные ветки: явная настройка листа или значение темы */
export const isColored = (sheet: Sheet) => sheet.rainbow ?? !!getTheme(sheet.theme).colored

export function branchColor(sheet: Sheet, branch: number) {
  const th = getTheme(sheet.theme)
  const pal = getPalette(sheet.palette)?.colors ?? th.rainbow
  return pal[branch % pal.length]
}

export function resolveStyle(sheet: Sheet, ref: TopicRef): FullStyle {
  const th = getTheme(sheet.theme)
  const level = levelOf(ref)
  const s: FullStyle = { ...th.levels[level] }
  if (sheet.globalFont) s.fontFamily = sheet.globalFont
  if (sheet.cjkFont) s.fontFamily = s.fontFamily + ', ' + sheet.cjkFont
  if (sheet.branchLineWidth) s.lineWidth = sheet.branchLineWidth
  if (isColored(sheet) && ref.branch >= 0) {
    const c = branchColor(sheet, ref.branch)
    s.lineColor = c
    if (th.colored) {
      // как в теме по умолчанию: основная — цвет ветки, глубже — светлый оттенок с тёмным текстом того же тона
      if (level === 'main') { s.fill = c; s.textColor = '#000000' }
      else if (level === 'sub' || level === 'summary') { s.fill = mix(c, '#ffffff', 0.8); s.textColor = mix(c, '#000000', 0.62) }
    } else if (level === 'main') { s.borderColor = c; s.fill = mix(c, th.background, 0.8) }
    else if (s.shape === 'underline') s.borderColor = c
  }
  return { ...s, ...clean(ref.topic.style) }
}

export const WEIGHTS: Record<string, number> = { normal: 400, medium: 500, bold: 700, extrabold: 800 }

function clean(style?: TopicStyle): Partial<FullStyle> {
  if (!style) return {}
  return Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined && v !== '')) as Partial<FullStyle>
}

export function sheetBackground(sheet: Sheet) {
  return sheet.background || getTheme(sheet.theme).background
}

export function mix(a: string, b: string, t: number) {
  const pa = hex(a), pb = hex(b)
  if (!pa || !pb) return a
  const c = pa.map((v, i) => Math.round(v * (1 - t) + pb[i] * t))
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}

function hex(c: string): number[] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(c)
  return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null
}

export const STYLE_KEYS: (keyof TopicStyle)[] = ['shape', 'fill', 'borderColor', 'borderWidth', 'borderStyle',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'textColor', 'textAlign',
  'lineShape', 'lineWidth', 'lineColor', 'lineStyle', 'lineEnd', 'textTransform', 'maxWidth', 'width']

export type { Topic }
