// Текстовые форматы: Markdown, OPML, FreeMind (.mm).
import type { MapDocument, Sheet, Topic } from '../editor/model'
import { uid } from '../editor/model'
import { escapeHtml } from './xmind'

const doc1 = (root: Topic, title = 'Лист 1'): MapDocument =>
  ({ version: 1, sheets: [{ id: uid(), title, rootTopic: root, structure: 'mindmap' }] })
const topic = (title: string): Topic => ({ id: uid(), title, children: [] })

// ---------------- Markdown ----------------

/** Заголовки (#) задают уровни, списки (-, *, 1.) вкладываются под последний заголовок */
export function fromMarkdown(md: string, fallbackTitle = 'Центральная тема'): MapDocument {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const roots: { level: number; t: Topic }[] = []
  const stack: { level: number; t: Topic }[] = []
  let lastTopic: Topic | null = null
  let noteBuf: string[] = []
  const flushNote = () => {
    if (lastTopic && noteBuf.join('').trim()) {
      const plain = noteBuf.join('\n').trim()
      lastTopic.notes = { plain, html: escapeHtml(plain).replace(/\n/g, '<br>') }
    }
    noteBuf = []
  }
  const push = (level: number, t: Topic) => {
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    if (stack.length) stack[stack.length - 1].t.children!.push(t)
    else roots.push({ level, t })
    stack.push({ level, t })
    lastTopic = t
  }
  let inCode = false
  for (const raw of lines) {
    if (/^\s*```/.test(raw)) { inCode = !inCode; noteBuf.push(raw); continue }
    if (inCode) { noteBuf.push(raw); continue }
    const h = /^(#{1,6})\s+(.*)$/.exec(raw)
    const li = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(raw)
    if (h) {
      flushNote()
      const task = /^\[([ xX])\]\s+(.*)$/.exec(h[2])
      const t = parseInline(task ? task[2] : h[2])
      if (task) t.task = { done: task[1].toLowerCase() === 'x' }
      push(h[1].length, t)
    }
    else if (li) {
      flushNote()
      const indent = li[1].replace(/\t/g, '    ').length
      const t = parseInline(li[4])
      if (li[3]) t.task = { done: /x/i.test(li[3]) }
      push(10 + Math.floor(indent / 2), t)
    } else if (raw.trim() && !/^(-{3,}|\*{3,})$/.test(raw.trim())) noteBuf.push(raw.replace(/^>\s?/, ''))
  }
  flushNote()
  if (!roots.length) return doc1(topic(fallbackTitle))
  if (roots.length === 1) return doc1(roots[0].t)
  const root = topic(fallbackTitle)
  root.children = roots.map(r => r.t)
  return doc1(root)
}

function parseInline(s: string): Topic {
  const t = topic('')
  const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s.trim())
  if (link) { t.title = link[1]; t.href = link[2]; return t }
  t.title = s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1').trim()
  return t
}

export function toMarkdown(doc: MapDocument): string {
  const out: string[] = []
  for (const sh of doc.sheets) {
    const walk = (t: Topic, depth: number) => {
      const title = t.title.replace(/\n/g, ' ') || ' '
      const text = t.href && !t.href.startsWith('topic:') ? `[${title}](${t.href})` : title
      const task = t.task ? (t.task.done ? '[x] ' : '[ ] ') : ''
      if (depth < 3) out.push('', '#'.repeat(depth + 1) + ' ' + task + text)
      else out.push('  '.repeat(depth - 3) + '- ' + task + text)
      const extra: string[] = []
      if (t.labels?.length) extra.push('Метки: ' + t.labels.join(', '))
      if (t.equation) extra.push('$' + t.equation + '$')
      if (t.notes?.plain) extra.push(...t.notes.plain.split('\n').map(l => '> ' + l))
      if (extra.length) {
        const pad = depth < 3 ? '' : '  '.repeat(depth - 2)
        out.push(...(depth < 3 ? ['', ...extra] : extra.map(e => pad + e)))
      }
      t.children?.forEach(c => walk(c, depth + 1))
    }
    if (doc.sheets.length > 1) out.push('', `<!-- Лист: ${sh.title} -->`)
    walk(sh.rootTopic, 0)
    sh.floatingTopics?.forEach(f => walk(f, 1))
  }
  return out.join('\n').trim() + '\n'
}

// ---------------- OPML ----------------

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')

export function toOpml(doc: MapDocument, title: string): string {
  const sh = doc.sheets[0]
  const walk = (t: Topic, ind: string): string => {
    const attrs = [`text="${xmlEsc(t.title)}"`]
    if (t.notes?.plain) attrs.push(`_note="${xmlEsc(t.notes.plain)}"`)
    if (t.href && !t.href.startsWith('topic:')) attrs.push(`url="${xmlEsc(t.href)}"`, 'type="link"')
    const kids = t.children ?? []
    return kids.length
      ? `${ind}<outline ${attrs.join(' ')}>\n${kids.map(k => walk(k, ind + '  ')).join('\n')}\n${ind}</outline>`
      : `${ind}<outline ${attrs.join(' ')}/>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>${xmlEsc(title)}</title></head>\n  <body>\n${walk(sh.rootTopic, '    ')}\n  </body>\n</opml>\n`
}

export function fromOpml(xml: string): MapDocument {
  const dom = new DOMParser().parseFromString(xml, 'application/xml')
  if (dom.querySelector('parsererror')) throw new Error('Некорректный OPML')
  const body = dom.querySelector('body')
  if (!body) throw new Error('В OPML нет <body>')
  const walk = (el: Element): Topic => {
    const t = topic(el.getAttribute('text') ?? el.getAttribute('title') ?? '')
    const note = el.getAttribute('_note')
    if (note) t.notes = { plain: note, html: escapeHtml(note).replace(/\n/g, '<br>') }
    const url = el.getAttribute('url') ?? el.getAttribute('htmlUrl')
    if (url) t.href = url
    t.children = [...el.children].filter(c => c.localName === 'outline').map(walk)
    return t
  }
  const tops = [...body.children].filter(c => c.localName === 'outline').map(walk)
  if (tops.length === 1) return doc1(tops[0])
  const root = topic(dom.querySelector('head > title')?.textContent || 'Центральная тема')
  root.children = tops
  return doc1(root)
}

// ---------------- FreeMind ----------------

const FM_ICONS: Record<string, string> = {
  'full-1': 'priority-1', 'full-2': 'priority-2', 'full-3': 'priority-3', 'full-4': 'priority-4', 'full-5': 'priority-5',
  'full-6': 'priority-6', 'full-7': 'priority-7', 'full-8': 'priority-8', 'full-9': 'priority-9',
  'button_ok': 'symbol-check', 'button_cancel': 'symbol-cross', 'help': 'symbol-question', 'messagebox_warning': 'symbol-exclam',
  'info': 'symbol-info', 'flag': 'flag-red', 'flag-blue': 'flag-blue', 'flag-green': 'flag-green', 'flag-orange': 'flag-orange',
  'flag-yellow': 'flag-yellow', 'flag-pink': 'flag-purple', 'smily_bad': 'smiley-sad', 'ksmiletris': 'smiley-smile',
  'forward': 'arrow-right', 'back': 'arrow-left', 'up': 'arrow-up', 'down': 'arrow-down', 'yes': 'star-yellow',
}

export function fromFreeMind(xml: string): MapDocument {
  const dom = new DOMParser().parseFromString(xml, 'application/xml')
  if (dom.querySelector('parsererror')) throw new Error('Некорректный файл FreeMind')
  const rootEl = dom.querySelector('map > node')
  if (!rootEl) throw new Error('В файле FreeMind нет узлов')
  const walk = (el: Element): Topic => {
    let title = el.getAttribute('TEXT') ?? ''
    const rich = [...el.children].filter(c => c.localName === 'richcontent')
    const nodeRich = rich.find(r => (r.getAttribute('TYPE') ?? 'NODE') === 'NODE')
    if (!title && nodeRich) title = nodeRich.textContent?.trim() ?? ''
    const t = topic(title)
    const noteRich = rich.find(r => r.getAttribute('TYPE') === 'NOTE')
    if (noteRich) {
      const html = noteRich.querySelector('body')?.innerHTML ?? noteRich.innerHTML
      t.notes = { html, plain: noteRich.textContent?.trim() ?? '' }
    }
    const link = el.getAttribute('LINK')
    if (link) t.href = link
    if (el.getAttribute('FOLDED') === 'true') t.collapsed = true
    const color = el.getAttribute('COLOR'), bg = el.getAttribute('BACKGROUND_COLOR')
    if (color || bg) t.style = { ...(color ? { textColor: color } : {}), ...(bg ? { fill: bg } : {}) }
    const icons = [...el.children].filter(c => c.localName === 'icon').map(i => FM_ICONS[i.getAttribute('BUILTIN') ?? '']).filter(Boolean)
    if (icons.length) t.markers = [...new Map(icons.map(m => [m.split('-')[0], m])).values()]
    t.children = [...el.children].filter(c => c.localName === 'node').map(walk)
    return t
  }
  return doc1(walk(rootEl))
}

export function toFreeMind(doc: MapDocument): string {
  const walk = (t: Topic, ind: string): string => {
    const attrs = [`TEXT="${xmlEsc(t.title)}"`, `ID="ID_${t.id}"`]
    if (t.href && !t.href.startsWith('topic:')) attrs.push(`LINK="${xmlEsc(t.href)}"`)
    if (t.collapsed) attrs.push('FOLDED="true"')
    const inner: string[] = []
    if (t.notes?.html) inner.push(`${ind}  <richcontent TYPE="NOTE"><html><body>${toXhtml(t.notes.html)}</body></html></richcontent>`)
    for (const c of t.children ?? []) inner.push(walk(c, ind + '  '))
    return inner.length ? `${ind}<node ${attrs.join(' ')}>\n${inner.join('\n')}\n${ind}</node>` : `${ind}<node ${attrs.join(' ')}/>`
  }
  return `<map version="1.0.1">\n${walk(doc.sheets[0].rootTopic, '')}\n</map>\n`
}

/** HTML заметки → корректный XHTML для XML-файла */
function toXhtml(html: string) {
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
  const ser = new XMLSerializer()
  return [...body.childNodes].map(n => ser.serializeToString(n)).join('').replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')
}

export type { Sheet }
