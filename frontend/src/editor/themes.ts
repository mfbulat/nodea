import type { Level, Sheet, Topic, TopicRef, TopicStyle } from './model'
import { levelOf } from './model'

export type FullStyle = Required<Omit<TopicStyle, 'maxWidth'>> & { maxWidth: number }

export interface Theme {
  id: string
  name: string
  background: string
  rainbow: string[]
  levels: Record<Level, FullStyle>
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

function base(o: Partial<FullStyle>): FullStyle {
  return {
    shape: 'rounded', fill: '#ffffff', borderColor: '#9aa4b2', borderWidth: 1, borderStyle: 'solid',
    fontFamily: FONT, fontSize: 14, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none',
    textColor: '#1f2328', textAlign: 'center', lineShape: 'curve', lineWidth: 2, lineColor: '#9aa4b2',
    maxWidth: 260, ...o,
  }
}

function theme(id: string, name: string, background: string, rainbow: string[],
  central: Partial<FullStyle>, main: Partial<FullStyle>, sub: Partial<FullStyle>, floating?: Partial<FullStyle>): Theme {
  const subStyle = base(sub)
  return {
    id, name, background, rainbow,
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
  theme('classic', 'Классика', '#ffffff', RAINBOW,
    { fill: '#2f4a7a', borderColor: '#2f4a7a', textColor: '#ffffff', shape: 'rounded' },
    { fill: '#e8eef8', borderColor: '#2f4a7a', lineColor: '#2f4a7a' },
    { shape: 'underline', fill: 'transparent', borderColor: '#2f4a7a', lineColor: '#2f4a7a', lineWidth: 1.5 }),
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
export function resolveStyle(sheet: Sheet, ref: TopicRef): FullStyle {
  const th = getTheme(sheet.theme)
  const level = levelOf(ref)
  const s: FullStyle = { ...th.levels[level] }
  if (sheet.rainbow && ref.branch >= 0) {
    const c = th.rainbow[ref.branch % th.rainbow.length]
    s.lineColor = c
    if (level === 'main') { s.borderColor = c; s.fill = mix(c, th.background, 0.8) }
    else if (s.shape === 'underline') s.borderColor = c
  }
  return { ...s, ...clean(ref.topic.style) }
}

function clean(style?: TopicStyle): Partial<FullStyle> {
  if (!style) return {}
  return Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined && v !== '')) as Partial<FullStyle>
}

export function sheetBackground(sheet: Sheet) {
  return sheet.background || getTheme(sheet.theme).background
}

function mix(a: string, b: string, t: number) {
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
  'lineShape', 'lineWidth', 'lineColor', 'maxWidth']

export type { Topic }
