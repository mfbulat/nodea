import katex from 'katex'
import type { FullStyle } from './themes'
import { WEIGHTS } from './themes'
import type { Topic } from './model'

let ctx: CanvasRenderingContext2D | null = null
const cache = new Map<string, TextBox>()

export interface TextBox { lines: string[]; textW: number; textH: number; lineHeight: number }

export function fontString(s: Pick<FullStyle, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>) {
  return `${s.fontStyle} ${WEIGHTS[s.fontWeight] ?? 400} ${s.fontSize}px ${s.fontFamily}`
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
  const lineHeight = Math.round(s.fontSize * 1.18)
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

export type IconKind = 'task' | 'marker' | 'link' | 'note' | 'attachment' | 'comments' | 'audio'
export interface Content {
  /** w/h — габарит с метками; shapeW/shapeH — сама фигура темы */
  w: number; h: number; shapeW: number; shapeH: number; padX: number; padY: number
  text: (TextBox & { x: number; y: number; w: number }) | null
  image?: { x: number; y: number; w: number; h: number; src: string }
  icons: { kind: IconKind; id?: string; x: number; y: number; size: number }[]
  equation?: { x: number; y: number; w: number; h: number; html: string }
  labels: { text: string; x: number; y: number; w: number; h: number }[]
  note?: { x: number; y: number; w: number; h: number; lines: string[]; lineHeight: number }
  /** сведения о задаче внутри темы: прогресс, даты, длительность */
  task?: { x: number; y: number; w: number; fs: number; progress: number; pctText: string; pctW: number; dates: string; daysText: string; daysW: number; assignee: string }
}

const DAY = 86400000
const dayOf = (iso: string) => Math.floor(new Date(iso + 'T00:00:00Z').getTime() / DAY)
/** длительность задачи в днях (включительно), при skipWeekends — только рабочие дни */
export function taskDays(start: string, end: string, skipWeekends = false) {
  const a = dayOf(start), b = Math.max(a, dayOf(end))
  if (!skipWeekends) return b - a + 1
  let n = 0
  for (let d = a; d <= b; d++) { const wd = new Date(d * DAY).getUTCDay(); if (wd !== 0 && wd !== 6) n++ }
  return n
}
export const pluralDays = (n: number) => {
  const m10 = n % 10, m100 = n % 100
  return `${n} ${m10 === 1 && m100 !== 11 ? 'день' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'дня' : 'дней'}`
}
const longDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '')

const GAP = 4
/** отступ между значками/маркерами и текстом */
const ICON_GAP = 8

/** Раскладка содержимого темы: изображение / [задача, маркеры, текст, значки] / формула / метки */
export function layoutContent(t: Topic, s: FullStyle, showNotes = false, opts: { taskInTopic?: boolean; skipWeekends?: boolean } = {}): Content {
  const icon = Math.round(Math.max(14, s.fontSize * 1.1))
  const hasText = !!t.title || (!t.image && !t.equation)
  const title = applyCase(t.title, s.textTransform)
  // фиксированная ширина: текст переносится по ней
  const fs = s.width ? { ...s, maxWidth: Math.max(20, s.width - 32) } : s
  const tb = hasText ? measureText(title, fs) : null
  const left: { kind: IconKind; id?: string }[] = []
  if (t.task) left.push({ kind: 'task' })
  for (const m of t.markers ?? []) left.push({ kind: 'marker', id: m })
  const right: { kind: IconKind }[] = []
  if (t.href) right.push({ kind: 'link' })
  if (t.notes?.plain?.trim() || t.notes?.html) right.push({ kind: 'note' })
  if (t.attachment) right.push({ kind: 'attachment' })
  if (t.audio) right.push({ kind: 'audio' })
  // комментарии показываются меткой обсуждения на холсте, а не значком в теме

  const rowItemsW = (left.length + right.length) * (icon + ICON_GAP)
  const rowH = Math.max(tb?.textH ?? 0, left.length + right.length ? icon : 0)
  const rowW = (tb?.textW ?? 0) + rowItemsW - (tb ? 0 : GAP)
  const eq = t.equation ? measureEquation(t.equation, s.fontSize) : null
  const img = t.image
  const labelFont = 11
  const c = canvas()
  c.font = `normal ${labelFont}px ${s.fontFamily}`
  const labels: { text: string; w: number; h: number }[] = (t.labels ?? []).map(l => ({ text: l, w: Math.ceil(c.measureText(l).width) + 12, h: labelFont + 6 }))

  // задача внутри темы (как в веб-версии): полоса прогресса, разделитель, даты и длительность
  const ti = opts.taskInTopic !== false ? t.taskInfo : undefined
  let task: Omit<NonNullable<Content['task']>, 'x' | 'y' | 'w'> | null = null, taskW = 0, taskH = 0
  if (ti) {
    const tfs = Math.max(10, Math.round(s.fontSize * 7) / 10)
    c.font = `normal ${tfs}px ${s.fontFamily}`
    const pctText = `${ti.progress ?? 0}%`
    const dates = ti.start ? `${longDate(ti.start)} – ${longDate(ti.end ?? ti.start)}` : ''
    const daysText = ti.start ? pluralDays(taskDays(ti.start, ti.end ?? ti.start, opts.skipWeekends)) : ''
    const pctW = Math.ceil(c.measureText(pctText).width), daysW = daysText ? Math.ceil(c.measureText(daysText).width) + 12 : 0
    const assignee = ti.assignee?.trim() ?? ''
    const datesW = dates ? Math.ceil(c.measureText(dates).width) + (daysW ? 10 + daysW : 0) + (assignee ? 8 + tfs * 1.7 : 0) : 0
    task = { fs: tfs, progress: Math.max(0, Math.min(100, ti.progress ?? 0)), pctText, pctW, dates, daysText, daysW, assignee }
    taskW = Math.max(datesW, 160)
    taskH = 14 + 15 + (dates ? 21 + 15 : 0)
  }

  // метки рисуются под фигурой темы, а не внутри неё
  const innerW = Math.max(rowW, img?.width ?? 0, eq?.w ?? 0, taskW, 8)
  const parts: number[] = []
  if (img) parts.push(img.height)
  if (rowH) parts.push(rowH)
  if (eq) parts.push(eq.h)
  const innerH = parts.reduce((a, p) => a + p, 0) + GAP * Math.max(0, parts.length - 1) + taskH

  // поля зависят от формы
  // поля как в веб-версии: основные 18×10, подтемы 6×6, центральная 29×15
  let padX = s.fontSize >= 24 ? 29 : s.fontSize >= 16 ? 18 : 6, padY = s.fontSize >= 24 ? 15 : s.fontSize >= 16 ? 10 : 6
  switch (s.shape) {
    case 'capsule': padX = 10 + (innerH + 16) / 2; break
    case 'ellipse': padX = innerW * 0.22 + 16; padY = innerH * 0.3 + 10; break
    case 'diamond': padX = innerW * 0.5 + 16; padY = innerH * 0.5 + 12; break
    case 'hexagon': padX = 26; break
    case 'parallelogram': padX = 26; break
    case 'underline': padX = 4; padY = 6; break
    case 'none': padX = 4; padY = 6; break
  }
  const shapeW = s.width ? Math.max(s.width, innerW + padX * 2) : innerW + padX * 2, shapeH = innerH + padY * 2
  const labelsH = labels.length ? labels[0].h + 4 : 0
  // «показывать все заметки»: текст заметки под темой
  const noteText = showNotes ? (t.notes?.plain ?? '').trim() : ''
  let note: Content['note']
  if (noteText) {
    const nb = measureText(noteText.length > 400 ? noteText.slice(0, 400) + '…' : noteText, { ...s, fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', maxWidth: Math.max(160, shapeW - 16) })
    note = { x: 0, y: shapeH + labelsH + 4, w: nb.textW + 16, h: nb.textH + 12, lines: nb.lines, lineHeight: nb.lineHeight }
  }
  const allLabelsW = labels.reduce((a, l) => a + l.w + GAP, 0) - (labels.length ? GAP : 0)
  const w = Math.max(shapeW, allLabelsW, note?.w ?? 0), h = shapeH + labelsH + (note ? note.h + 4 : 0)

  const out: Content = { w, h, shapeW, shapeH, padX, padY, text: null, icons: [], labels: [], note }
  let y = padY
  if (img) { out.image = { x: (shapeW - img.width) / 2, y, w: img.width, h: img.height, src: img.src }; y += img.height + GAP }
  if (rowH) {
    // ряд центрируется по ширине; выравнивание текста действует внутри текстового блока
    const extra = shapeW - padX * 2 - rowW
    // с задачей заголовок прижат влево, как в веб-версии
    let x = padX + (task || s.textAlign === 'left' ? 0 : s.textAlign === 'right' ? extra : extra / 2)
    for (const it of left) { out.icons.push({ ...it, x, y: y + (rowH - icon) / 2, size: icon }); x += icon + ICON_GAP }
    if (tb) {
      const tw = s.textAlign === 'center' ? tb.textW : tb.textW
      out.text = { ...tb, x, y: y + (rowH - tb.textH) / 2, w: tw }
      x += tb.textW + ICON_GAP
    }
    for (const it of right) { out.icons.push({ ...it, x, y: y + (rowH - icon) / 2, size: icon }); x += icon + ICON_GAP }
    y += rowH + GAP
  }
  if (eq) { out.equation = { x: (shapeW - eq.w) / 2, y, w: eq.w, h: eq.h, html: eq.html }; y += eq.h + GAP }
  if (task) out.task = { ...task, x: padX, y: y - GAP, w: shapeW - padX * 2 }
  if (labels.length) {
    let x = 0
    for (const l of labels) { out.labels.push({ ...l, x, y: shapeH + 4 }); x += l.w + GAP }
  }
  return out
}

export function applyCase(text: string, tt?: string) {
  if (tt === 'uppercase') return text.toUpperCase()
  if (tt === 'lowercase') return text.toLowerCase()
  if (tt === 'capitalize') return text.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())
  return text
}
