// Экспорт в Word, Excel и PowerPoint. Библиотеки грузятся лениво.
import type { MapDocument, Sheet, Topic } from '../editor/model'
import { markerName } from '../editor/markers'
import { sheetToPng } from './image'

const plain = (t: Topic) => t.title.replace(/\n/g, ' ')
const dataUrlToBytes = (u: string) => Uint8Array.from(atob(u.split(',')[1]), c => c.charCodeAt(0))

// ---------------- Word ----------------

export async function toDocx(doc: MapDocument, title: string): Promise<Blob> {
  const d = await import('docx')
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, ExternalHyperlink } = d
  const H = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
  const sections = []
  for (const sh of doc.sheets) {
    const children: InstanceType<typeof Paragraph>[] = []
    children.push(new Paragraph({ text: doc.sheets.length > 1 ? `${title} — ${sh.title}` : title, heading: HeadingLevel.TITLE }))
    // обзорная картинка карты
    try {
      const png = await sheetToPng(sh, 1.5)
      const maxW = 600
      const k = Math.min(1, maxW / png.width)
      children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: dataUrlToBytes(png.dataUrl), transformation: { width: Math.round(png.width * k), height: Math.round(png.height * k) } })] }))
    } catch { /* без картинки */ }
    const walk = (t: Topic, depth: number) => {
      const runs: (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] = []
      if (t.task) runs.push(new TextRun(t.task.done ? '☑ ' : '☐ '))
      if (t.href && !t.href.startsWith('topic:')) runs.push(new ExternalHyperlink({ link: t.href, children: [new TextRun({ text: plain(t), style: 'Hyperlink' })] }))
      else runs.push(new TextRun(plain(t)))
      if (t.markers?.length) runs.push(new TextRun({ text: '  [' + t.markers.map(markerName).join(', ') + ']', italics: true, color: '888888' }))
      children.push(depth < H.length
        ? new Paragraph({ heading: H[depth], children: runs })
        : new Paragraph({ bullet: { level: Math.min(depth - H.length, 8) }, children: runs }))
      if (t.labels?.length) children.push(new Paragraph({ children: [new TextRun({ text: 'Метки: ' + t.labels.join(', '), italics: true, color: '666666' })] }))
      if (t.equation) children.push(new Paragraph({ children: [new TextRun({ text: t.equation, font: 'Cambria Math' })] }))
      if (t.notes?.plain) for (const line of t.notes.plain.split('\n')) children.push(new Paragraph({ text: line, style: 'Quote' }))
      t.children?.forEach(c => walk(c, depth + 1))
    }
    walk(sh.rootTopic, 0)
    sh.floatingTopics?.forEach(f => walk(f, 1))
    sections.push({ children })
  }
  const document = new Document({ creator: 'MindMap', title, sections })
  return Packer.toBlob(document)
}

// ---------------- Excel ----------------

export async function toXlsx(doc: MapDocument): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MindMap'
  for (const sh of doc.sheets) {
    const ws = wb.addWorksheet(sh.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Лист')
    const depth = maxDepth(sh)
    ws.columns = [
      ...[...Array(depth).keys()].map(i => ({ header: i === 0 ? 'Центральная тема' : `Уровень ${i}`, width: 24 })),
      { header: 'Заметка', width: 40 }, { header: 'Метки', width: 18 }, { header: 'Маркеры', width: 18 },
      { header: 'Ссылка', width: 28 }, { header: 'Задача', width: 10 },
    ]
    ws.getRow(1).font = { bold: true }
    // каждая тема — строка; уровень вложенности задаёт столбец (как структура дерева)
    const walk = (t: Topic, d: number) => {
      const row: (string | null)[] = Array(depth).fill(null)
      row[d] = plain(t)
      row.push(t.notes?.plain ?? null, t.labels?.join(', ') ?? null, t.markers?.map(markerName).join(', ') ?? null,
        t.href && !t.href.startsWith('topic:') ? t.href : null, t.task ? (t.task.done ? 'выполнено' : 'не выполнено') : null)
      const r = ws.addRow(row)
      if (d === 0) r.font = { bold: true, size: 13 }
      else if (d === 1) r.font = { bold: true }
      t.children?.forEach(c => walk(c, d + 1))
    }
    walk(sh.rootTopic, 0)
    sh.floatingTopics?.forEach(f => walk(f, 1))
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function maxDepth(sh: Sheet) {
  const d = (t: Topic): number => 1 + Math.max(0, ...(t.children ?? []).map(d))
  return Math.max(d(sh.rootTopic), ...(sh.floatingTopics ?? []).map(f => 1 + d(f)))
}

// ---------------- PowerPoint ----------------

export async function toPptx(doc: MapDocument, title: string): Promise<Blob> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 × 7.5 дюйма
  pptx.title = title
  const W = 13.33, Hh = 7.5
  for (const sh of doc.sheets) {
    const root = sh.rootTopic
    // титульный слайд с картой целиком
    const s0 = pptx.addSlide()
    s0.addText(plain(root), { x: 0.5, y: 0.3, w: W - 1, h: 0.8, fontSize: 30, bold: true, color: '1F2328' })
    try {
      const png = await sheetToPng(sh, 1.5)
      const maxW = W - 1, maxH = Hh - 1.6
      const k = Math.min(maxW / png.width, maxH / png.height) * 96 / 96
      const w = png.width * k, h = png.height * k
      s0.addImage({ data: png.dataUrl, x: (W - w) / 2, y: 1.2 + (maxH - h) / 2, w, h })
    } catch { /* без картинки */ }
    // слайд на каждую основную тему: подтемы — маркированным списком
    for (const main of root.children ?? []) {
      const s = pptx.addSlide()
      s.addText(plain(main), { x: 0.5, y: 0.3, w: W - 1, h: 0.8, fontSize: 26, bold: true, color: '1F2328' })
      const items: { text: string; options: Record<string, unknown> }[] = []
      const walk = (t: Topic, lvl: number) => {
        items.push({ text: (t.task ? (t.task.done ? '☑ ' : '☐ ') : '') + plain(t), options: { bullet: true, indentLevel: lvl, fontSize: Math.max(14, 22 - lvl * 2), breakLine: true } })
        t.children?.forEach(c => walk(c, lvl + 1))
      }
      main.children?.forEach(c => walk(c, 0))
      if (items.length) s.addText(items, { x: 0.7, y: 1.3, w: W - 1.4, h: Hh - 1.8, valign: 'top', color: '333333' })
      if (main.notes?.plain) s.addNotes(main.notes.plain)
    }
  }
  return (await pptx.write({ outputType: 'blob' })) as Blob
}
