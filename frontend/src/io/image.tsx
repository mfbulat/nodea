// Экспорт карты в изображение: статическая SVG-отрисовка (без элементов управления),
// затем SVG-файл, PNG (html-to-image) и PDF (jsPDF, растровая страница).
import { renderToStaticMarkup } from 'react-dom/server'
import type { Sheet } from '../editor/model'
import { indexSheet, levelOf } from '../editor/model'
import { CalloutTail, RelLabel, renderSheet } from '../editor/MapCanvas'
import { TopicNode, dashOf } from '../editor/TopicView'
import { edgePath } from '../editor/paths'
import { relGeometry } from '../editor/relations'
import { sheetBackground } from '../editor/themes'

const PAD = 40
const noop = () => {}

function StaticMap({ sheet, equations }: { sheet: Sheet; equations: Map<string, string> }) {
  const r = renderSheet(sheet)
  const idx = indexSheet(sheet)
  const b = r.layout.bounds
  const w = Math.ceil(b.maxX - b.minX + PAD * 2), h = Math.ceil(b.maxY - b.minY + PAD * 2)
  const bg = sheetBackground(sheet)
  const rootStyle = r.styles.get(sheet.rootTopic.id)!
  const relColor = rootStyle.lineColor
  return (
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ background: bg }}>
      <rect width={w} height={h} fill={bg} />
      <g transform={`translate(${PAD - b.minX},${PAD - b.minY})`}>
        {r.layout.boundaries.map(bd => {
          const color = bd.color ?? relColor
          return <g key={bd.id}>
            <rect x={bd.x} y={bd.y} width={bd.w} height={bd.h} rx={12} fill={bd.fill ?? color} fillOpacity={bd.fill ? 0.25 : 0.06}
              stroke={color} strokeWidth={1.5} strokeDasharray={dashOf(bd.lineStyle ?? 'dashed', 1.5)} />
            {bd.title && <>
              <rect x={bd.x} y={bd.y} width={Math.min(bd.w, bd.title.length * 7.5 + 16)} height={20} rx={8} fill={color} />
              <text x={bd.x + 8} y={bd.y + 14} fontSize={12} fill="#fff" fontFamily={rootStyle.fontFamily}>{bd.title}</text>
            </>}
          </g>
        })}
        {r.layout.decos.map((d, i) => d.kind === 'callout'
          ? <CalloutTail key={i} from={d.pts[0]} to={d.pts[1]} style={r.styles.get(d.owner)!} />
          : <polyline key={i} points={d.pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
            stroke={d.kind === 'grid' ? rootStyle.borderColor : rootStyle.lineColor} strokeWidth={d.kind === 'grid' ? 1 : Math.max(3, rootStyle.lineWidth + 1)} />)}
        {r.layout.edges.map((e, i) => {
          const from = r.styles.get(e.from)!, to = r.styles.get(e.to)
          const color = sheet.rainbow && e.from === sheet.rootTopic.id && to ? to.lineColor : from.lineColor
          const shape = e.kind === 'line' ? 'straight' : from.lineShape
          const { d, filled } = edgePath(e, shape === 'none' && (e.kind === 'brace' || e.kind === 'vbrace') ? 'curve' : shape, from.lineWidth)
          return d ? <path key={i} d={d} fill={filled ? color : 'none'} stroke={filled ? 'none' : color}
            strokeWidth={e.kind === 'brace' || e.kind === 'vbrace' ? Math.min(2, from.lineWidth) : from.lineWidth} strokeLinecap="round" /> : null
        })}
        {[...r.layout.boxes.values()].map(bx => {
          const ref = idx.get(bx.id)
          return ref ? <TopicNode key={bx.id} box={bx} topic={ref.topic} style={r.styles.get(bx.id)!} content={r.contents.get(bx.id)!}
            selected={false} dim={false} hidden={false} central={levelOf(ref) === 'central'} equationImage={equations.get(bx.id)}
            onPointerDown={noop} onDoubleClick={noop} onIcon={noop} onMarker={noop} /> : null
        })}
        {(sheet.relationships ?? []).map(rel => {
          const g = relGeometry(rel, r.layout.boxes)
          if (!g) return null
          const color = rel.color ?? relColor, w2 = rel.width ?? 2
          return <g key={rel.id}>
            <path d={g.d} fill="none" stroke={color} strokeWidth={w2} strokeDasharray={dashOf(rel.lineStyle ?? 'dashed', w2)} />
            {rel.arrowEnd !== false && <path d={g.arrowEnd} fill={color} />}
            {rel.arrowStart && <path d={g.arrowStart} fill={color} />}
            {rel.title && <RelLabel x={g.mid.x} y={g.mid.y} text={rel.title} color={color} bg={bg} />}
          </g>
        })}
        {r.layout.toggles.filter(t => t.collapsed).map(t => (
          <g key={t.id} transform={`translate(${t.x},${t.y})`}>
            <circle r={9} fill={bg} stroke={r.styles.get(t.id)!.lineColor} strokeWidth={1.5} />
            <text textAnchor="middle" dy="3.5" fontSize={9} fill={r.styles.get(t.id)!.lineColor}>{t.count}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

/** Формулы KaTeX → PNG (html-to-image корректно переносит стили только для HTML-элементов) */
async function renderEquations(sheet: Sheet): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const r = renderSheet(sheet)
  const { toPng } = await import('html-to-image')
  for (const [id, c] of r.contents) {
    if (!c.equation) continue
    const st = r.styles.get(id)!
    // снимаем внутренний элемент: смещение за экран есть только у контейнера
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:-100000px;top:0'
    const el = document.createElement('div')
    el.className = 'eq'
    el.style.cssText = `font-size:${st.fontSize}px;color:${st.textColor};white-space:nowrap;padding:2px 2px 0;width:${c.equation.w}px;height:${c.equation.h}px`
    el.innerHTML = c.equation.html
    host.appendChild(el)
    document.body.appendChild(host)
    try { out.set(id, await toPng(el, { pixelRatio: 3 })) } catch { /* без формулы */ } finally { host.remove() }
  }
  return out
}

export function sheetSvgMarkup(sheet: Sheet, equations = new Map<string, string>()) {
  const markup = renderToStaticMarkup(<StaticMap sheet={sheet} equations={equations} />)
  const m = /width="(\d+)" height="(\d+)"/.exec(markup)!
  return { markup, width: +m[1], height: +m[2] }
}

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'include' })
  const blob = await res.blob()
  return new Promise(resolve => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.readAsDataURL(blob) })
}

/** Самодостаточный SVG: картинки встраиваются как data: URI */
export async function sheetToSvg(sheet: Sheet): Promise<string> {
  let { markup } = sheetSvgMarkup(sheet, await renderEquations(sheet))
  const urls = [...new Set([...markup.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('data:')))]
  for (const u of urls) {
    try { markup = markup.split(`href="${u}"`).join(`href="${await toDataUrl(u)}"`) } catch { /* оставляем ссылку */ }
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + markup
}

/** PNG через html-to-image: встраивает шрифты (в т.ч. KaTeX) и изображения */
export async function sheetToPng(sheet: Sheet, pixelRatio = 2): Promise<{ dataUrl: string; width: number; height: number }> {
  const { toPng } = await import('html-to-image')
  const { markup, width, height } = sheetSvgMarkup(sheet, await renderEquations(sheet))
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;`
  host.innerHTML = markup
  document.body.appendChild(host)
  try {
    // слишком большие карты ограничиваем по площади холста браузера
    const maxSide = 16000
    const ratio = Math.min(pixelRatio, maxSide / width, maxSide / height)
    const dataUrl = await toPng(host.firstElementChild as HTMLElement, { pixelRatio: ratio, backgroundColor: sheetBackground(sheet), cacheBust: false })
    return { dataUrl, width, height }
  } finally {
    host.remove()
  }
}

/** PDF: по странице на лист, размер страницы — по размеру карты */
export async function sheetsToPdf(sheets: Sheet[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  let pdf: InstanceType<typeof jsPDF> | null = null
  for (const sh of sheets) {
    const { dataUrl, width, height } = await sheetToPng(sh, 2)
    const orientation = width >= height ? 'landscape' : 'portrait'
    if (!pdf) pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], hotfixes: ['px_scaling'] })
    else pdf.addPage([width, height], orientation)
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height, undefined, 'FAST')
  }
  return pdf!.output('blob')
}
