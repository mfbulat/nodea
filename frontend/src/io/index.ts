import type { MapDocument, Sheet } from '../editor/model'
import { indexSheet, uid } from '../editor/model'

export type ExportFormat = 'xmind' | 'png' | 'jpeg' | 'svg' | 'pdf' | 'md' | 'opml' | 'mm' | 'docx' | 'xlsx' | 'pptx' | 'webm' | 'textbundle' | 'tasks-xlsx' | 'ics'

export const EXPORTS: { id: ExportFormat; label: string }[] = [
  { id: 'xmind', label: 'XMind (.xmind)' }, { id: 'png', label: 'PNG' }, { id: 'svg', label: 'SVG' },
  { id: 'pdf', label: 'PDF' }, { id: 'md', label: 'Markdown' }, { id: 'opml', label: 'OPML' },
  { id: 'mm', label: 'FreeMind (.mm)' }, { id: 'docx', label: 'Word (.docx)' }, { id: 'xlsx', label: 'Excel (.xlsx)' },
  { id: 'pptx', label: 'PowerPoint (.pptx)' },
]

export const IMPORT_ACCEPT = '.xmind,.md,.markdown,.txt,.opml,.mm'

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'map'

/** Экспорт: изображения и PDF — текущий лист (PDF — все листы), остальные — вся карта */
export async function exportMap(fmt: ExportFormat, doc: MapDocument, sheet: Sheet, title: string) {
  const name = safeName(title)
  const text = (s: string, type: string) => new Blob([s], { type: type + ';charset=utf-8' })
  switch (fmt) {
    case 'xmind': { const { toXmind } = await import('./xmind'); return download(await toXmind(doc), name + '.xmind') }
    case 'png': {
      const { sheetToPng } = await import('./image')
      const { dataUrl } = await sheetToPng(sheet, 2)
      return download(await (await fetch(dataUrl)).blob(), name + '.png')
    }
    case 'jpeg': {
      const { sheetToPng } = await import('./image')
      const { dataUrl } = await sheetToPng(sheet, 2, true)
      return download(await (await fetch(dataUrl)).blob(), name + '.jpg')
    }
    case 'webm': { const { pitchToWebm } = await import('./video'); return download(await pitchToWebm(sheet), name + '.webm') }
    case 'textbundle': { const { toTextBundle } = await import('./bundle'); return download(await toTextBundle(doc), name + '.textpack') }
    case 'tasks-xlsx': { const { tasksToXlsx } = await import('./tasks'); return download(await tasksToXlsx(doc), name + ' - tasks.xlsx') }
    case 'ics': { const { tasksToIcs } = await import('./tasks'); return download(text(tasksToIcs(doc, title), 'text/calendar'), name + '.ics') }
    case 'svg': { const { sheetToSvg } = await import('./image'); return download(text(await sheetToSvg(sheet), 'image/svg+xml'), name + '.svg') }
    case 'pdf': { const { sheetsToPdf } = await import('./image'); return download(await sheetsToPdf(doc.sheets), name + '.pdf') }
    case 'md': { const { toMarkdown } = await import('./text'); return download(text(toMarkdown(doc), 'text/markdown'), name + '.md') }
    case 'opml': { const { toOpml } = await import('./text'); return download(text(toOpml({ ...doc, sheets: [sheet] }, title), 'text/x-opml'), name + '.opml') }
    case 'mm': { const { toFreeMind } = await import('./text'); return download(text(toFreeMind({ ...doc, sheets: [sheet] }), 'application/x-freemind'), name + '.mm') }
    case 'docx': { const { toDocx } = await import('./office'); return download(await toDocx(doc, title), name + '.docx') }
    case 'xlsx': { const { toXlsx } = await import('./office'); return download(await toXlsx(doc), name + '.xlsx') }
    case 'pptx': { const { toPptx } = await import('./office'); return download(await toPptx(doc, title), name + '.pptx') }
  }
}

/** Импорт файла → документ карты и название */
export async function importFile(file: File): Promise<{ title: string; document: MapDocument }> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const base = file.name.replace(/\.[^.]+$/, '')
  let document: MapDocument
  if (ext === 'xmind') { const { fromXmind } = await import('./xmind'); document = await fromXmind(file) }
  else {
    const txt = await file.text()
    const t = await import('./text')
    if (ext === 'opml') document = t.fromOpml(txt)
    else if (ext === 'mm') document = t.fromFreeMind(txt)
    else if (ext === 'md' || ext === 'markdown' || ext === 'txt') document = t.fromMarkdown(txt, base)
    else throw new Error('Unsupported format: .' + ext)
  }
  // гарантируем уникальные id тем (некоторые файлы содержат повторы)
  for (const sh of document.sheets) {
    const seen = new Set<string>()
    for (const ref of indexSheet(sh).values()) {
      if (seen.has(ref.topic.id)) ref.topic.id = uid()
      seen.add(ref.topic.id)
    }
  }
  return { title: base.slice(0, 200) || 'Import', document }
}
