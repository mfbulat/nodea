// Экспорт задач: Excel (таблица задач) и календарь iCalendar (.ics), как «Excel (Task)» и «Calendar (Task)» в веб-версии.
import type { MapDocument, Topic } from '../editor/model'
import { indexSheet } from '../editor/model'
import { pluralDays, taskDays } from '../editor/measure'

interface Row { sheet: string; topic: Topic; parent: string; skip: boolean }
function tasks(doc: MapDocument): Row[] {
  const out: Row[] = []
  for (const sh of doc.sheets) for (const r of indexSheet(sh).values()) if (r.topic.taskInfo) out.push({ sheet: sh.title, topic: r.topic, parent: r.parent?.title ?? '', skip: !!sh.taskSkipWeekends })
  return out
}

export async function tasksToXlsx(doc: MapDocument): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Задачи')
  ws.columns = [
    { header: 'Задача', width: 32 }, { header: 'Родительская тема', width: 24 }, { header: 'Лист', width: 16 },
    { header: 'Начало', width: 14 }, { header: 'Окончание', width: 14 }, { header: 'Длительность', width: 14 },
    { header: 'Прогресс', width: 10 }, { header: 'Приоритет', width: 10 }, { header: 'Исполнитель', width: 20 }, { header: 'Предшественники', width: 28 },
  ]
  ws.getRow(1).font = { bold: true }
  const byId = new Map(doc.sheets.flatMap(sh => [...indexSheet(sh).values()].map(r => [r.topic.id, r.topic.title] as const)))
  for (const t of tasks(doc)) {
    const i = t.topic.taskInfo!
    ws.addRow([t.topic.title, t.parent, t.sheet, i.start ?? '', i.end ?? i.start ?? '',
      i.start ? pluralDays(taskDays(i.start, i.end ?? i.start, t.skip)) : '', `${i.progress ?? 0}%`,
      i.priority !== undefined ? `P${i.priority}` : '', i.assignee ?? '', (i.dependsOn ?? []).map(d => byId.get(d) ?? '').join(', ')])
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsDate = (iso: string, plus = 0) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + plus); return d.toISOString().slice(0, 10).replace(/-/g, '') }

export function tasksToIcs(doc: MapDocument, title: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MindMap//Tasks//RU', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsText(title)}`]
  for (const t of tasks(doc)) {
    const i = t.topic.taskInfo!
    if (!i.start) continue
    const desc = [`Прогресс: ${i.progress ?? 0}%`, i.assignee ? `Исполнитель: ${i.assignee}` : '', i.priority !== undefined ? `Приоритет: P${i.priority}` : '', t.parent ? `Тема: ${t.parent}` : ''].filter(Boolean).join('\n')
    lines.push('BEGIN:VEVENT', `UID:${t.topic.id}@mindmap`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(i.start)}`,
      `DTEND;VALUE=DATE:${icsDate(i.end ?? i.start, 1)}`, `SUMMARY:${icsText(t.topic.title)}`, `DESCRIPTION:${icsText(desc)}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
