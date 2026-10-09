import type { FullStyle } from './themes'

let ctx: CanvasRenderingContext2D | null = null
const cache = new Map<string, TextBox>()

export interface TextBox { lines: string[]; textW: number; textH: number; lineHeight: number }

export function fontString(s: Pick<FullStyle, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>) {
  return `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`
}

export function measureText(text: string, s: FullStyle): TextBox {
  const font = fontString(s)
  const key = `${font}|${s.maxWidth}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = font
  const lines: string[] = []
  for (const para of (text || ' ').split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      const next = line + word
      if (line && ctx.measureText(next.trimEnd()).width > s.maxWidth) {
        lines.push(line.trimEnd())
        line = word.trimStart()
        // очень длинное слово — режем посимвольно
        while (ctx.measureText(line).width > s.maxWidth && line.length > 1) {
          let cut = line.length - 1
          while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > s.maxWidth) cut--
          lines.push(line.slice(0, cut))
          line = line.slice(cut)
        }
      } else line = next
    }
    lines.push(line || ' ')
  }
  const lineHeight = Math.round(s.fontSize * 1.3)
  const textW = Math.max(...lines.map(l => ctx!.measureText(l).width), s.fontSize * 0.5)
  const box = { lines, textW: Math.ceil(textW), textH: lines.length * lineHeight, lineHeight }
  if (cache.size > 5000) cache.clear()
  cache.set(key, box)
  return box
}

/** Размер темы с учётом формы */
export function topicSize(text: TextBox, s: FullStyle): { w: number; h: number; padX: number; padY: number } {
  let padX = 14, padY = 8
  switch (s.shape) {
    case 'capsule': padX = 10 + (text.textH + 16) / 2; break
    case 'ellipse': padX = text.textW * 0.22 + 16; padY = text.textH * 0.3 + 10; break
    case 'diamond': padX = text.textW * 0.5 + 16; padY = text.textH * 0.5 + 12; break
    case 'hexagon': padX = 26; break
    case 'parallelogram': padX = 26; break
    case 'underline': padX = 6; padY = 5; break
    case 'none': padX = 6; padY = 5; break
  }
  if (s.fontSize >= 20) { padX += 6; padY += 4 }
  return { w: text.textW + padX * 2, h: text.textH + padY * 2, padX, padY }
}
