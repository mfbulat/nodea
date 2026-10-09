import katex from 'katex'
import type { FullStyle } from './themes'
import type { Topic } from './model'

let ctx: CanvasRenderingContext2D | null = null
const cache = new Map<string, TextBox>()

export interface TextBox { lines: string[]; textW: number; textH: number; lineHeight: number }

export function fontString(s: Pick<FullStyle, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>) {
  return `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`
}

function canvas() {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!
  return ctx
}

export function measureText(text: string, s: FullStyle): TextBox {
  const font = fontString(s)
  const key = `${font}|${s.maxWidth}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = canvas()
  c.font = font
  const lines: string[] = []
  for (const para of (text || ' ').split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      const next = line + word
      if (line && c.measureText(next.trimEnd()).width > s.maxWidth) {
        lines.push(line.trimEnd())
        line = word.trimStart()
        // очень длинное слово — режем посимвольно
        while (c.measureText(line).width > s.maxWidth && line.length > 1) {
          let cut = line.length - 1
          while (cut > 1 && c.measureText(line.slice(0, cut)).width > s.maxWidth) cut--
          lines.push(line.slice(0, cut))
          line = line.slice(cut)
        }
      } else line = next
    }
    lines.push(line || ' ')
  }
  const lineHeight = Math.round(s.fontSize * 1.3)
  const textW = Math.max(...lines.map(l => c.measureText(l).width), s.fontSize * 0.5)
  const box = { lines, textW: Math.ceil(textW), textH: lines.length * lineHeight, lineHeight }
  if (cache.size > 5000) cache.clear()
  cache.set(key, box)
  return box
}

const eqCache = new Map<string, { html: string; w: number; h: number }>()

/** Сброс кешей после загрузки веб-шрифтов (KaTeX грузит свои шрифты лениво) */
export function onFontsChanged(cb: () => void): () => void {
  const handler = () => { cache.clear(); eqCache.clear(); cb() }
  document.fonts.addEventListener('loadingdone', handler)
  return () => document.fonts.removeEventListener('loadingdone', handler)
}
let eqHost: HTMLDivElement | null = null

/** Формула LaTeX → HTML KaTeX и её размер */
export function measureEquation(tex: string, fontSize: number) {
  const key = fontSize + '|' + tex
  const hit = eqCache.get(key)
  if (hit) return hit
  let html: string
  try { html = katex.renderToString(tex, { throwOnError: false, displayMode: false, output: 'html' }) }
  catch { html = `<span style="color:#c00">${tex.replace(/</g, '&lt;')}</span>` }
  if (!eqHost) {
    eqHost = document.createElement('div')
    eqHost.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;white-space:nowrap'
    document.body.appendChild(eqHost)
  }
  eqHost.style.fontSize = fontSize + 'px'
  eqHost.innerHTML = `<span class="eq">${html}</span>`
  const r = (eqHost.firstChild as HTMLElement).getBoundingClientRect()
  const out = { html, w: Math.ceil(r.width) + 4, h: Math.ceil(r.height) + 4 }
  eqCache.set(key, out)
  return out
}

export type IconKind = 'task' | 'marker' | 'link' | 'note' | 'attachment' | 'comments'
export interface Content {
  w: number; h: number; padX: number; padY: number
  text: (TextBox & { x: number; y: number; w: number }) | null
  image?: { x: number; y: number; w: number; h: number; src: string }
  icons: { kind: IconKind; id?: string; x: number; y: number; size: number }[]
  equation?: { x: number; y: number; w: number; h: number; html: string }
  labels: { text: string; x: number; y: number; w: number; h: number }[]
}

const GAP = 4

/** Раскладка содержимого темы: изображение / [задача, маркеры, текст, значки] / формула / метки */
export function layoutContent(t: Topic, s: FullStyle): Content {
  const icon = Math.round(Math.max(14, s.fontSize * 1.1))
  const hasText = !!t.title || (!t.image && !t.equation)
  const tb = hasText ? measureText(t.title, s) : null
  const left: { kind: IconKind; id?: string }[] = []
  if (t.task) left.push({ kind: 'task' })
  for (const m of t.markers ?? []) left.push({ kind: 'marker', id: m })
  const right: { kind: IconKind }[] = []
  if (t.href) right.push({ kind: 'link' })
  if (t.notes?.plain?.trim() || t.notes?.html) right.push({ kind: 'note' })
  if (t.attachment) right.push({ kind: 'attachment' })
  if (t.comments?.length) right.push({ kind: 'comments' })

  const rowItemsW = (left.length + right.length) * (icon + GAP)
  const rowH = Math.max(tb?.textH ?? 0, left.length + right.length ? icon : 0)
  const rowW = (tb?.textW ?? 0) + rowItemsW - (tb ? 0 : GAP)
  const eq = t.equation ? measureEquation(t.equation, s.fontSize) : null
  const img = t.image
  const labelFont = 11
  const c = canvas()
  c.font = `normal ${labelFont}px ${s.fontFamily}`
  const labels = (t.labels ?? []).map(l => ({ text: l, w: Math.ceil(c.measureText(l).width) + 12, h: labelFont + 6 }))
  const labelsW = labels.reduce((a, l) => a + l.w + GAP, 0) - (labels.length ? GAP : 0)

  const innerW = Math.max(rowW, img?.width ?? 0, eq?.w ?? 0, labelsW, 8)
  const parts: number[] = []
  if (img) parts.push(img.height)
  if (rowH) parts.push(rowH)
  if (eq) parts.push(eq.h)
  if (labels.length) parts.push(labels[0].h)
  const innerH = parts.reduce((a, p) => a + p, 0) + GAP * Math.max(0, parts.length - 1)

  // поля зависят от формы
  let padX = 14, padY = 8
  switch (s.shape) {
    case 'capsule': padX = 10 + (innerH + 16) / 2; break
    case 'ellipse': padX = innerW * 0.22 + 16; padY = innerH * 0.3 + 10; break
    case 'diamond': padX = innerW * 0.5 + 16; padY = innerH * 0.5 + 12; break
    case 'hexagon': padX = 26; break
    case 'parallelogram': padX = 26; break
    case 'underline': padX = 6; padY = 5; break
    case 'none': padX = 6; padY = 5; break
  }
  if (s.fontSize >= 20) { padX += 6; padY += 4 }
  const w = innerW + padX * 2, h = innerH + padY * 2

  const out: Content = { w, h, padX, padY, text: null, icons: [], labels: [] }
  let y = padY
  if (img) { out.image = { x: (w - img.width) / 2, y, w: img.width, h: img.height, src: img.src }; y += img.height + GAP }
  if (rowH) {
    // ряд центрируется по ширине; выравнивание текста действует внутри текстового блока
    const extra = innerW - rowW
    let x = padX + (s.textAlign === 'left' ? 0 : s.textAlign === 'right' ? extra : extra / 2)
    for (const it of left) { out.icons.push({ ...it, x, y: y + (rowH - icon) / 2, size: icon }); x += icon + GAP }
    if (tb) {
      const tw = s.textAlign === 'center' ? tb.textW : tb.textW
      out.text = { ...tb, x, y: y + (rowH - tb.textH) / 2, w: tw }
      x += tb.textW + GAP
    }
    for (const it of right) { out.icons.push({ ...it, x, y: y + (rowH - icon) / 2, size: icon }); x += icon + GAP }
    y += rowH + GAP
  }
  if (eq) { out.equation = { x: (w - eq.w) / 2, y, w: eq.w, h: eq.h, html: eq.html }; y += eq.h + GAP }
  if (labels.length) {
    let x = (w - labelsW) / 2
    for (const l of labels) { out.labels.push({ ...l, x, y }); x += l.w + GAP }
  }
  return out
}
