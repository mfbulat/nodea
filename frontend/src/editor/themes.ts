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
  { id: 'dawn', name: 'Заря', colors: ['#ff6b6b', '#ff9f69', '#97d3b6', '#88e2d7', '#6fd0f9', '#e18bee'] },
  { id: 'ocean', name: 'Океан', colors: ['#5b8def', '#4cc3d9', '#7bd4a8', '#3f6fb5', '#8fa7f5', '#5fb8c9'] },
  { id: 'forest', name: 'Лес', colors: ['#7cb66a', '#c7d36a', '#4f9a7d', '#a6c48a', '#e2b55e', '#6e9f5b'] },
  { id: 'candy', name: 'Карамель', colors: ['#ff8fab', '#ffc46b', '#9be08e', '#8ecbff', '#c9a0ff', '#ff9e80'] },
  { id: 'mono', name: 'Графит', colors: ['#5f6b7a', '#7d8896', '#9aa4b1', '#4a5562', '#6b7684', '#8b95a3'] },
  { id: 'vivid', name: 'Яркая', colors: ['#e5484d', '#f76b15', '#f5c400', '#30a46c', '#0090ff', '#8e4ec6'] },
]

/** Цветовые темы веб-версии: фон, цвет центральной темы, цвет линий (без цветных веток) и цвета основных тем */
export interface ColorTheme { id: string; name: string; group: 'colorful' | 'classic'; bg: string; central: string; line?: string; colors: string[]; swatch?: string[] }
const ct = (id: string, name: string, bg: string, central: string, colors: string[], swatch?: string[]): ColorTheme => ({ id, name, group: 'colorful', bg, central, colors, swatch })
const cl = (id: string, name: string, bg: string, central: string, line: string, main: string): ColorTheme =>
  ({ id, name, group: 'classic', bg, central, line, colors: [main], swatch: [bg, main, central, line, main, bg] })
export const COLOR_THEMES: ColorTheme[] = [
  ct('dawn', 'Заря', '#ffffff', '#000000', ['#ff6b6b', '#ff9f69', '#97d3b6', '#88e2d7', '#6fd0f9', '#e18bee']),
  ct('rainbow', 'Радуга', '#ffffff', '#000229', ['#f9423a', '#f6a04d', '#f3d321', '#00bc7b', '#486aff', '#a34fde']),
  ct('iris', 'Ирис', '#ffffff', '#2e0f6b', ['#9257ff', '#9d02ea', '#5c14c8', '#c5aef9'], ['#ffffff', '#9257ff', '#9d02ea', '#5c14c8', '#2e0f6b', '#c5aef9']),
  ct('energy', 'Энергия', '#ffffff', '#0d0d0d', ['#f22816', '#f2b807', '#233ed9'], ['#ffffff', '#f2f2f2', '#f22816', '#f2b807', '#233ed9', '#0d0d0d']),
  ct('dancing', 'Танец', '#ffffff', '#363026', ['#4e60ef', '#eb4758', '#aa0e1d'], ['#4e60ef', '#eb4758', '#ffffff', '#fff8e0', '#aa0e1d', '#363026']),
  ct('code', 'Код', '#2c2d30', '#ffffff', ['#fff0b8', '#cbffb8', '#db8fff', '#8abeff'], ['#fff0b8', '#cbffb8', '#ffffff', '#db8fff', '#8abeff', '#2c2d30']),
  ct('kimono', 'Кимоно', '#ffffff', '#191959', ['#ffabaa', '#ff7b31', '#8cb5ff', '#4a51d9'], ['#ffffff', '#ffabaa', '#ff7b31', '#8cb5ff', '#4a51d9', '#191959']),
  ct('islands', 'Острова', '#ffe8d6', '#6b705c', ['#ddbea9', '#cb997e', '#b7b7a4', '#a5a58d'], ['#ffe8d6', '#ddbea9', '#cb997e', '#b7b7a4', '#a5a58d', '#6b705c']),
  ct('roses', 'Розы', '#fff0f3', '#a4133c', ['#ffb3c1', '#ff758f', '#c9184a'], ['#fff0f3', '#ffccd5', '#ffb3c1', '#ff758f', '#c9184a', '#a4133c']),
  ct('mint', 'Мята', '#ffffff', '#046562', ['#9ceaef', '#68d8d6', '#06afa9'], ['#ffffff', '#c4fff9', '#9ceaef', '#68d8d6', '#06afa9', '#046562']),
  ct('green-tea', 'Зелёный чай', '#1f2b1d', '#d6d9c3', ['#b6ad90', '#579360', '#656d4a', '#265834'], ['#d6d9c3', '#b6ad90', '#579360', '#656d4a', '#265834', '#1f2b1d']),
  ct('space', 'Космос', '#0d2f42', '#d9dcd6', ['#81c3d7', '#3a7ca5', '#2f6690', '#16425b'], ['#d9dcd6', '#81c3d7', '#3a7ca5', '#2f6690', '#16425b', '#0d2f42']),
  ct('sophisticated', 'Изысканная', '#fdfbf7', '#1e1d1a', ['#7d5a2c', '#dfcaa4', '#c49c64', '#d3381d'], ['#7d5a2c', '#fdfbf7', '#dfcaa4', '#c49c64', '#d3381d', '#1e1d1a']),
  ct('innocence', 'Невинность', '#fdf8e7', '#3c4244', ['#fdc9d1', '#ea618a', '#a4d0f9', '#4f73ba'], ['#fdc9d1', '#ea618a', '#a4d0f9', '#4f73ba', '#fdf8e7', '#3c4244']),
  ct('macaron', 'Макарон', '#ecf6f6', '#3c4244', ['#cab08f', '#feb58c', '#afd4c4'], ['#cab08f', '#feb58c', '#afd4c4', '#ecf6f6', '#f9e088', '#3c4244']),
  ct('woodland', 'Лесная', '#f9ffeb', '#1f2513', ['#e1c356', '#5b805c', '#86964f', '#b3c785'], ['#e1c356', '#5b805c', '#86964f', '#b3c785', '#f9ffeb', '#1f2513']),
  ct('cream', 'Сливки', '#ffffff', '#7d6e83', ['#d4d0de', '#c9dbec', '#dcc4c0'], ['#d8ead2', '#d4d0de', '#ffffff', '#c9dbec', '#dcc4c0', '#7d6e83']),
  ct('hawaii', 'Гавайи', '#ffffff', '#254b85', ['#b7d6e8', '#4a94c3', '#4b9383', '#d29f55'], ['#b7d6e8', '#4a94c3', '#254b85', '#4b9383', '#d29f55', '#f3e6cf']),
  ct('pinecone', 'Шишка', '#1d414b', '#c8c6cb', ['#64625c', '#978477', '#aa9fa3', '#d1bfaf'], ['#64625c', '#978477', '#1d414b', '#c8c6cb', '#aa9fa3', '#d1bfaf']),
  ct('dystopia', 'Антиутопия', '#f4f5f6', '#2a2c2c', ['#bd2828', '#a5acb1', '#606466'], ['#bd2828', '#f4f5f6', '#dfe4e7', '#a5acb1', '#606466', '#2a2c2c']),
  ct('freshness', 'Свежесть', '#f0f0f0', '#3c74a6', ['#f2bdc7', '#5ba683', '#b796d9'], ['#f0f0f0', '#f2bdc7', '#f2dc6b', '#5ba683', '#b796d9', '#3c74a6']),
  ct('florid', 'Пышная', '#edf3ff', '#0a052e', ['#ffaa39', '#d389d5', '#1692d2'], ['#edf3ff', '#c1e554', '#ffaa39', '#d389d5', '#1692d2', '#0a052e']),
  ct('quaint', 'Старинная', '#f9f5de', '#153e5d', ['#4b9d9d', '#7884a4', '#aa79aa'], ['#f9f5de', '#dfddce', '#4b9d9d', '#7884a4', '#aa79aa', '#153e5d']),
  ct('variety', 'Разнообразие', '#f6f5f5', '#070d59', ['#ffc947', '#e46d57', '#1f3c88'], ['#f6f5f5', '#9bffed', '#ffc947', '#e46d57', '#1f3c88', '#070d59']),
  ct('dazzling', 'Ослепительная', '#ffffff', '#092933', ['#efd7e6', '#ff7dc1', '#a239ea', '#5c37e5'], ['#ffffff', '#efd7e6', '#ff7dc1', '#a239ea', '#5c37e5', '#092933']),
  ct('vintage', 'Винтаж', '#264653', '#e9c46a', ['#f4a261', '#dc856f', '#a4705e', '#2a9d8f'], ['#e9c46a', '#f4a261', '#dc856f', '#a4705e', '#2a9d8f', '#264653']),
  ct('dessert', 'Десерт', '#f9f8ed', '#006d77', ['#ffbc9f', '#d8ac8f', '#83c5be'], ['#f9f8ed', '#ffedd2', '#ffbc9f', '#d8ac8f', '#83c5be', '#006d77']),
  ct('vanilla', 'Ваниль', '#ffffff', '#0d4040', ['#30e3ca', '#11999e', '#40514e'], ['#ffffff', '#e4f9f5', '#30e3ca', '#11999e', '#40514e', '#0d4040']),
  ct('candy', 'Конфеты', '#ffffff', '#101010', ['#ff9c72', '#f5cd6c', '#f09e3a', '#9cc3e4'], ['#ffffff', '#ff9c72', '#f5cd6c', '#f09e3a', '#9cc3e4', '#54a6d6']),
  ct('cyberpunk', 'Киберпанк', '#ffffff', '#7400b8', ['#72efdd', '#56cfe1', '#4ea8de', '#5e60ce'], ['#ffffff', '#72efdd', '#56cfe1', '#4ea8de', '#5e60ce', '#7400b8']),
  ct('sakura', 'Сакура', '#ffe3e8', '#101010', ['#ffb4b6', '#d1c3bd', '#c1cfde'], ['#ffe3e8', '#ffdcc8', '#ffb4b6', '#ffa9c6', '#d1c3bd', '#c1cfde']),
  ct('fireplace', 'Камин', '#ffffff', '#6d3b37', ['#fdd29a', '#f9a655', '#fc901a', '#e04b51', '#a4564c'], ['#fdd29a', '#f9a655', '#fc901a', '#e04b51', '#a4564c', '#6d3b37']),
  ct('holiday', 'Праздник', '#101f23', '#d5f2e3', ['#f0a346', '#e12a37', '#bc191e', '#2d6c65'], ['#d5f2e3', '#f0a346', '#e12a37', '#bc191e', '#2d6c65', '#101f23']),
  ct('ocean-web', 'Океан', '#000d2d', '#b4f2fd', ['#6ee2fd', '#3bb6e3', '#135cae'], ['#b4f2fd', '#6ee2fd', '#3bb6e3', '#135cae', '#01206a', '#000d2d']),
  ct('violet', 'Фиалка', '#fffbef', '#72369d', ['#fbd58a', '#dcbef4', '#b67be6', '#9d4edd'], ['#fffbef', '#fbd58a', '#dcbef4', '#b67be6', '#9d4edd', '#72369d']),
  cl('constancy', 'Постоянство', '#ffffff', '#3949ab', '#141414', '#eeeeee'),
  cl('cream-classic', 'Крем', '#ffe0e5', '#000000', '#ffffff', '#ffffff'),
  cl('flowers', 'Цветы', '#ffffff', '#a61d39', '#4a1019', '#d02f48'),
  cl('coral', 'Коралл', '#140407', '#ef6c70', '#fdf1f1', '#d02f48'),
  cl('gorgeous', 'Роскошь', '#d02f48', '#3e0e15', '#ffffff', '#ffffff'),
  cl('champagne', 'Шампань', '#eee8e6', '#000000', '#88675e', '#c1aba5'),
  cl('perfume', 'Парфюм', '#efe6c6', '#000000', '#201e14', '#ab9446'),
  cl('zen', 'Дзен', '#ffffff', '#000000', '#232323', '#d6d6d6'),
  cl('groove', 'Грув', '#ffffff', '#f44336', '#f44336', '#f44336'),
]
/** цветовая тема листа (старые палитры — как цветные темы на белом фоне) */
export function getColorTheme(id?: string): ColorTheme {
  const t = COLOR_THEMES.find(x => x.id === (id ?? 'dawn'))
  if (t) return t
  const p = PALETTES.find(x => x.id === id)
  return p ? { id: p.id, name: p.name, group: 'colorful', bg: '#ffffff', central: '#000000', colors: p.colors } : COLOR_THEMES[0]
}
export const getPalette = (id?: string) => PALETTES.find(p => p.id === id) ?? COLOR_THEMES.find(t => t.id === id)
/** относительная яркость (sRGB) */
export function luminance(c: string) {
  const p = hex(c)
  if (!p) return 1
  const [r, g, b] = p.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** текст на заливке цвета ветки: белый на тёмных, чёрный на светлых (порог как в веб-версии) */
export const textOn = (c: string) => (luminance(c) < 0.305 ? '#ffffff' : '#000000')

export const MAP_FONT = '"Manrope", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
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
    { fill: '#f2f2f2', borderStyle: 'none', borderWidth: 0, textColor: '#333333', fontSize: 14, textAlign: 'left',
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
export const isColored = (sheet: Sheet) => sheet.rainbow ?? (!!getTheme(sheet.theme).colored && getColorTheme(sheet.palette).group === 'colorful')

export function branchColor(sheet: Sheet, branch: number) {
  const th = getTheme(sheet.theme)
  const ctm = getColorTheme(sheet.palette)
  const pal = th.colored ? (ctm.group === 'classic' ? COLOR_THEMES[0].colors : ctm.colors) : (getPalette(sheet.palette)?.colors ?? th.rainbow)
  return pal[branch % pal.length]
}

export function resolveStyle(sheet: Sheet, ref: TopicRef): FullStyle {
  const th = getTheme(sheet.theme)
  const level = levelOf(ref)
  const s: FullStyle = { ...th.levels[level] }
  if (sheet.globalFont) s.fontFamily = sheet.globalFont
  if (sheet.cjkFont) s.fontFamily = s.fontFamily + ', ' + sheet.cjkFont
  if (sheet.branchLineWidth) s.lineWidth = sheet.branchLineWidth
  if (th.colored) {
    // цветовая тема веб-версии: фон, цвет центральной, линии и заливки основных тем
    const ctm = getColorTheme(sheet.palette)
    const dark = luminance(sheetBackground(sheet)) < 0.2
    if (level === 'central') s.textColor = ctm.central
    if (!isColored(sheet) || ref.branch < 0) {
      const line = ctm.line ?? ctm.central
      s.lineColor = line
      const c = ctm.colors[0]
      if (level === 'main' || level === 'floating') { s.fill = c; s.textColor = textOn(c) }
      else if (level === 'sub' || level === 'summary') { s.fill = ref.depth === 2 || level === 'summary' ? rgba(c, 0.2) : 'transparent'; s.textColor = dark ? tone(c, 0.85) : ctm.group === 'classic' ? ctm.central : darkTone(c) }
    }
  }
  if (isColored(sheet) && ref.branch >= 0) {
    const c = branchColor(sheet, ref.branch)
    s.lineColor = c
    if (th.colored) {
      const dark = luminance(sheetBackground(sheet)) < 0.2
      // как в теме по умолчанию: основная — цвет ветки, глубже — светлый оттенок с тёмным текстом того же тона
      if (level === 'main') { s.fill = c; s.textColor = textOn(c) }
      else if (level === 'sub' || level === 'summary') {
        // как в веб-версии: второй уровень — цвет ветки с прозрачностью 20 %, глубже — без заливки; текст — тёмный тон цвета ветки
        s.fill = ref.depth === 2 || level === 'summary' ? rgba(c, 0.2) : 'transparent'
        s.textColor = dark ? tone(c, 0.85) : darkTone(c)
      }
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
  const th = getTheme(sheet.theme)
  return sheet.background || (th.colored ? getColorTheme(sheet.palette).bg : th.background)
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

function rgba(c: string, a: number) {
  const p = hex(c)
  return p ? `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${a})` : c
}

/** Тот же оттенок, насыщенность 100 %, светлота 20 % (#ff6b6b → #660000) */
/** тон цвета с заданной светлотой (насыщенность 100 %) */
export function tone(c: string, l: number) {
  const p = hex(c)
  if (!p) return '#333333'
  const [r, g, b] = p.map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  const sat = 1, cc = (1 - Math.abs(2 * l - 1)) * sat, x = cc * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - cc / 2
  const [rr, gg, bb] = h < 60 ? [cc, x, 0] : h < 120 ? [x, cc, 0] : h < 180 ? [0, cc, x] : h < 240 ? [0, x, cc] : h < 300 ? [x, 0, cc] : [cc, 0, x]
  return '#' + [rr, gg, bb].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')
}
export const darkTone = (c: string) => tone(c, 0.2)
