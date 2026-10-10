// Формат .xmind (XMind 2020+): zip с content.json, metadata.json, manifest.json и resources/.
// Поля, которых нет в XMind, сохраняются в topic["x-mindmap"], чтобы не терять их при обмене.
import JSZip from 'jszip'
import type { MapDocument, Relationship, Sheet, StructureId, Topic, TopicStyle } from '../editor/model'
import { uid } from '../editor/model'
import { uploadFile } from '../editor/actions'

const STRUCT: [StructureId, string][] = [
  ['mindmap', 'org.xmind.ui.map.unbalanced'], ['mindmap-cw', 'org.xmind.ui.map.clockwise'],
  ['mindmap-acw', 'org.xmind.ui.map.anticlockwise'], ['logic-right', 'org.xmind.ui.logic.right'],
  ['logic-left', 'org.xmind.ui.logic.left'], ['brace-right', 'org.xmind.ui.brace.right'], ['brace-left', 'org.xmind.ui.brace.left'],
  ['org-down', 'org.xmind.ui.org-chart.down'], ['org-up', 'org.xmind.ui.org-chart.up'],
  ['tree-right', 'org.xmind.ui.tree.right'], ['tree-left', 'org.xmind.ui.tree.left'],
  ['timeline-h', 'org.xmind.ui.timeline.horizontal'], ['timeline-v', 'org.xmind.ui.timeline.vertical'],
  ['fishbone-left', 'org.xmind.ui.fishbone.leftHeaded'], ['fishbone-right', 'org.xmind.ui.fishbone.rightHeaded'],
  ['tree-table', 'org.xmind.ui.treetable'], ['matrix', 'org.xmind.ui.spreadsheet'],
]
const toXStruct = (s?: StructureId) => STRUCT.find(x => x[0] === s)?.[1]
function fromXStruct(c?: string): StructureId | undefined {
  if (!c) return undefined
  const hit = STRUCT.find(x => x[1] === c)?.[0]
  if (hit) return hit
  if (c.includes('map')) return 'mindmap'
  if (c.includes('logic')) return c.includes('left') ? 'logic-left' : 'logic-right'
  if (c.includes('org-chart')) return c.includes('up') ? 'org-up' : 'org-down'
  if (c.includes('tree')) return c.includes('left') ? 'tree-left' : 'tree-right'
  if (c.includes('fishbone')) return c.includes('right') ? 'fishbone-right' : 'fishbone-left'
  if (c.includes('timeline')) return c.includes('vertical') ? 'timeline-v' : 'timeline-h'
  if (c.includes('brace')) return c.includes('left') ? 'brace-left' : 'brace-right'
  if (c.includes('spreadsheet') || c.includes('matrix')) return 'matrix'
  return undefined
}

const TASK = ['task-start', 'task-oct', 'task-quarter', 'task-3oct', 'task-half', 'task-5oct', 'task-3quar', 'task-7oct', 'task-done']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const SMILEY: Record<string, string> = { smile: 'smile', laugh: 'laugh', sad: 'cry', angry: 'angry', surprise: 'surprise', neutral: 'boring' }
const SYMBOL: Record<string, string> = { check: 'right', cross: 'wrong' }

const C_SYMBOLS = ['heart', 'like', 'dislike', 'hourglass', 'telephone', 'pen', 'music', 'flight']
export function toXMarker(m: string): string {
  const [g, v] = m.split('-')
  if (g === 'tag') return 'tag-' + (v === 'purple' ? 'dark-purple' : v === 'gray' ? 'grey' : v)
  if (g === 'symbol' && C_SYMBOLS.includes(v)) return 'c_symbol_' + v
  if (g === 'task') return TASK[+v]
  if (g === 'month') return 'month-' + MONTHS[+v - 1]
  if (g === 'week') return 'week-' + WEEK[+v - 1]
  if (g === 'smiley') return 'smiley-' + (SMILEY[v] ?? v)
  if (g === 'symbol') return 'symbol-' + (SYMBOL[v] ?? v)
  if (g === 'person') return 'people-' + v
  return m
}
export function fromXMarker(m: string): string | null {
  if (m.startsWith('c_symbol_')) return 'symbol-' + m.slice(9)
  const [g, v] = m.split('-')
  if (g === 'tag') return 'tag-' + (m === 'tag-dark-purple' ? 'purple' : m === 'tag-grey' ? 'gray' : v)
  if (g === 'task') { const i = TASK.indexOf(m); return i >= 0 ? `task-${i}` : null }
  if (g === 'month') { const i = MONTHS.indexOf(v); return i >= 0 ? `month-${i + 1}` : null }
  if (g === 'week') { const i = WEEK.indexOf(v); return i >= 0 ? `week-${i + 1}` : null }
  if (g === 'smiley') { const k = Object.entries(SMILEY).find(e => e[1] === v)?.[0]; return k ? 'smiley-' + k : null }
  if (g === 'symbol') { const k = Object.entries(SYMBOL).find(e => e[1] === v)?.[0]; return 'symbol-' + (k ?? v) }
  if (g === 'people') return 'person-' + v
  if (['priority', 'flag', 'star', 'arrow'].includes(g)) return m
  return null
}

const SHAPES: Record<string, string> = {
  rect: 'org.xmind.topicShape.rect', rounded: 'org.xmind.topicShape.roundedRect', capsule: 'org.xmind.topicShape.stadium',
  ellipse: 'org.xmind.topicShape.ellipserect', diamond: 'org.xmind.topicShape.diamond', hexagon: 'org.xmind.topicShape.hexagon',
  parallelogram: 'org.xmind.topicShape.parallelogram', underline: 'org.xmind.topicShape.underline', none: 'org.xmind.topicShape.noBorder',
}
const LINES: Record<string, string> = {
  curve: 'org.xmind.branchConnection.curve', straight: 'org.xmind.branchConnection.straight', elbow: 'org.xmind.branchConnection.elbow',
  rounded: 'org.xmind.branchConnection.roundedElbow', taper: 'org.xmind.branchConnection.bight', none: 'org.xmind.branchConnection.none',
}

function styleToX(s?: TopicStyle): Record<string, string> | undefined {
  if (!s) return undefined
  const p: Record<string, string> = {}
  if (s.fill) p['svg:fill'] = s.fill === 'transparent' ? 'none' : s.fill
  if (s.shape) p['shape-class'] = SHAPES[s.shape]
  if (s.borderColor) p['border-line-color'] = s.borderColor
  if (s.borderWidth != null) p['border-line-width'] = s.borderWidth + 'pt'
  if (s.fontFamily) p['fo:font-family'] = s.fontFamily
  if (s.fontSize) p['fo:font-size'] = s.fontSize + 'pt'
  if (s.fontWeight) p['fo:font-weight'] = ({ normal: '400', medium: '500', bold: '700', extrabold: '800' } as Record<string, string>)[s.fontWeight] ?? '400'
  if (s.fontStyle) p['fo:font-style'] = s.fontStyle
  if (s.textColor) p['fo:color'] = s.textColor
  if (s.textAlign) p['fo:text-align'] = s.textAlign
  if (s.textDecoration && s.textDecoration !== 'none') p['fo:text-decoration'] = s.textDecoration
  if (s.lineColor) p['line-color'] = s.lineColor
  if (s.lineWidth) p['line-width'] = s.lineWidth + 'pt'
  if (s.lineShape) p['line-class'] = LINES[s.lineShape]
  return Object.keys(p).length ? p : undefined
}

function styleFromX(p?: Record<string, string>): TopicStyle | undefined {
  if (!p) return undefined
  const s: TopicStyle = {}
  const num = (v?: string) => (v ? parseFloat(v) : undefined)
  const fill = p['svg:fill']
  if (fill) s.fill = fill === 'none' ? 'transparent' : fill
  const shape = Object.entries(SHAPES).find(e => e[1] === p['shape-class'])?.[0]
  if (shape) s.shape = shape as TopicStyle['shape']
  if (p['border-line-color']) s.borderColor = p['border-line-color']
  if (p['border-line-width']) s.borderWidth = num(p['border-line-width'])
  if (p['fo:font-family'] && p['fo:font-family'] !== 'NeverMind') s.fontFamily = p['fo:font-family']
  if (p['fo:font-size']) s.fontSize = num(p['fo:font-size'])
  if (p['fo:font-weight']) {
    const w = p['fo:font-weight'], n = /^\d+$/.test(w) ? +w : /bold/.test(w) ? 700 : 400
    s.fontWeight = n >= 800 ? 'extrabold' : n >= 600 ? 'bold' : n >= 500 ? 'medium' : 'normal'
  }
  if (p['fo:font-style']) s.fontStyle = p['fo:font-style'] === 'italic' ? 'italic' : 'normal'
  if (p['fo:color']) s.textColor = p['fo:color']
  if (p['fo:text-align']) s.textAlign = p['fo:text-align'] as TopicStyle['textAlign']
  if (p['fo:text-decoration']) s.textDecoration = p['fo:text-decoration'].includes('line-through') ? 'line-through' : 'underline'
  if (p['line-color']) s.lineColor = p['line-color']
  if (p['line-width']) s.lineWidth = num(p['line-width'])
  const ls = Object.entries(LINES).find(e => e[1] === p['line-class'])?.[0]
  if (ls) s.lineShape = ls as TopicStyle['lineShape']
  return Object.keys(s).length ? s : undefined
}

// ---------------- экспорт ----------------

type XTopic = Record<string, unknown>

export async function toXmind(doc: MapDocument): Promise<Blob> {
  const zip = new JSZip()
  const files = new Map<string, string>() // url → путь в архиве
  const addFile = async (url: string, folder: 'resources' | 'attachments', name?: string) => {
    if (files.has(url)) return files.get(url)!
    try {
      const res = await fetch(url, { credentials: 'include' })
      const blob = await res.blob()
      const ext = name?.split('.').pop() ?? blob.type.split('/')[1] ?? 'bin'
      const path = `${folder}/${uid()}.${ext.replace(/[^a-z0-9]/gi, '')}`
      zip.file(path, blob)
      files.set(url, path)
      return path
    } catch { return null }
  }

  const topic = async (t: Topic): Promise<XTopic> => {
    const x: XTopic = { id: t.id, class: 'topic', title: t.title }
    if (t.structure) x.structureClass = toXStruct(t.structure)
    if (t.collapsed) x.branch = 'folded'
    if (t.markers?.length) x.markers = t.markers.map(m => ({ markerId: toXMarker(m) }))
    if (t.labels?.length) x.labels = t.labels
    if (t.notes) x.notes = { plain: { content: t.notes.plain }, realHTML: { content: t.notes.html } }
    if (t.href) x.href = t.href.startsWith('topic:') ? 'xmind:#' + t.href.slice(6) : t.href
    if (t.attachment && !t.href) {
      const p = await addFile(t.attachment.url, 'attachments', t.attachment.name)
      if (p) x.href = 'xap:' + p
    }
    if (t.image) {
      if (t.image.src.startsWith('emoji:')) x.image = undefined
      else {
        const p = await addFile(t.image.src, 'resources')
        if (p) x.image = { src: 'xap:' + p, width: t.image.width, height: t.image.height }
      }
    }
    if (t.position) x.position = t.position
    // сторона основной ветки без баланса и свободное положение — в своём расширении
    if (t.side || t.freePos) x['x-mindmap'] = { side: t.side, freePos: t.freePos }
    const style = styleToX(t.style)
    if (style) x.style = { id: uid(), properties: style }
    const children: Record<string, XTopic[]> = {}
    if (t.children?.length) children.attached = await Promise.all(t.children.map(topic))
    if (t.callouts?.length) children.callout = await Promise.all(t.callouts.map(topic))
    if (t.summaries?.length) {
      children.summary = await Promise.all(t.summaries.map(s => topic(s.topic)))
      x.summaries = t.summaries.map(s => ({ id: s.id, range: rangeOf(t, s.ids), topicId: s.topic.id }))
    }
    if (Object.keys(children).length) x.children = children
    if (t.boundaries?.length) x.boundaries = t.boundaries.map(b => ({ id: b.id, range: b.ids.includes(t.id) ? 'master' : rangeOf(t, b.ids), title: b.title }))
    // всё, чего нет в XMind, — в собственном поле
    const extra: Record<string, unknown> = {}
    for (const k of ['equation', 'task', 'comments', 'commentPos', 'commentsResolved', 'attachment'] as const) if (t[k]) extra[k] = t[k]
    if (t.image?.src.startsWith('emoji:')) extra.image = t.image
    if (t.style) extra.style = t.style
    if (t.boundaries?.length) extra.boundaries = t.boundaries
    if (Object.keys(extra).length) x['x-mindmap'] = extra
    if (t.task) x.markers = [...((x.markers as object[]) ?? []), { markerId: t.task.done ? 'task-done' : 'task-start' }]
    return x
  }

  const sheets = []
  for (const sh of doc.sheets) {
    const root = await topic(sh.rootTopic)
    root.structureClass = toXStruct(sh.structure ?? 'mindmap')
    if (sh.floatingTopics?.length) {
      const ch = (root.children as Record<string, XTopic[]>) ?? {}
      ch.detached = await Promise.all(sh.floatingTopics.map(topic))
      root.children = ch
    }
    sheets.push({
      id: sh.id, class: 'sheet', title: sh.title, rootTopic: root,
      relationships: (sh.relationships ?? []).map(r => ({
        id: r.id, end1Id: r.end1, end2Id: r.end2, title: r.title,
        controlPoints: r.cp1 && r.cp2 ? { 0: r.cp1, 1: r.cp2 } : undefined,
        'x-mindmap': r,
      })),
      // все собственные настройки листа (тема, цветовая тема, зоны, презентация, задачи…) — в своём поле
      'x-mindmap': Object.fromEntries(Object.entries(sh).filter(([k]) => !['id', 'title', 'rootTopic', 'floatingTopics', 'relationships'].includes(k))),
    })
  }
  zip.file('content.json', JSON.stringify(sheets))
  zip.file('metadata.json', JSON.stringify({ creator: { name: 'MindMap', version: '1.0' } }))
  const entries: Record<string, object> = { 'content.json': {}, 'metadata.json': {} }
  for (const p of files.values()) entries[p] = {}
  zip.file('manifest.json', JSON.stringify({ 'file-entries': entries }))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.xmind.workbook' })
}

function rangeOf(t: Topic, ids: string[]) {
  const pos = ids.map(i => (t.children ?? []).findIndex(c => c.id === i)).filter(i => i >= 0)
  return `(${Math.min(...pos)},${Math.max(...pos)})`
}

// ---------------- импорт ----------------

export async function fromXmind(file: Blob): Promise<MapDocument> {
  const zip = await JSZip.loadAsync(file)
  const content = zip.file('content.json')
  if (!content) {
    const xml = zip.file('content.xml')
    if (xml) return fromXmindXml(await xml.async('string'))
    throw new Error('The archive has no content.json, so it is not an .xmind file')
  }
  const raw = JSON.parse(await content.async('string')) as XTopic[]
  const uploaded = new Map<string, { url: string; name: string; size: number }>()
  const upload = async (path: string) => {
    const p = path.replace(/^xap:/, '')
    if (uploaded.has(p)) return uploaded.get(p)!
    const f = zip.file(p)
    if (!f) return null
    const blob = await f.async('blob')
    const name = p.split('/').pop()!
    const up = await uploadFile(new File([blob], name, { type: guessType(name) }))
    const res = { url: up.url, name: up.name, size: up.size }
    uploaded.set(p, res)
    return res
  }

  const topic = async (x: XTopic): Promise<Topic> => {
    const extra = (x['x-mindmap'] ?? {}) as Partial<Topic>
    const t: Topic = { id: String(x.id ?? uid()), title: String(x.title ?? '') }
    const sc = fromXStruct(x.structureClass as string)
    if (sc) t.structure = sc
    if (x.branch === 'folded') t.collapsed = true
    const markers = ((x.markers as { markerId: string }[]) ?? []).map(m => m.markerId)
    const taskMarker = markers.find(m => m === 'task-done' || m === 'task-start')
    t.markers = markers.filter(m => !(extra.task && m === taskMarker)).map(fromXMarker).filter((m): m is string => !!m)
    if (!t.markers.length) delete t.markers
    if (Array.isArray(x.labels) && x.labels.length) t.labels = x.labels as string[]
    const notes = x.notes as { plain?: { content: string }; realHTML?: { content: string }; html?: unknown } | undefined
    if (notes?.plain?.content || notes?.realHTML?.content) {
      const plain = notes.plain?.content ?? ''
      t.notes = { plain, html: notes.realHTML?.content ?? escapeHtml(plain).replace(/\n/g, '<br>') }
    }
    const href = x.href as string | undefined
    if (href?.startsWith('xmind:#')) t.href = 'topic:' + href.slice(7)
    else if (href?.startsWith('xap:')) { const a = await upload(href); if (a) t.attachment = a }
    else if (href) t.href = href
    const img = x.image as { src: string; width?: number; height?: number } | undefined
    if (img?.src) {
      const a = img.src.startsWith('xap:') ? await upload(img.src) : null
      const src = a?.url ?? img.src
      t.image = { src, width: img.width ?? 200, height: img.height ?? 150 }
    }
    if (x.position) t.position = x.position as Topic['position']
    const ext = x['x-mindmap'] as Pick<Topic, 'side' | 'freePos'> | undefined
    if (ext?.side) t.side = ext.side
    if (ext?.freePos) t.freePos = ext.freePos
    const style = styleFromX((x.style as { properties?: Record<string, string> } | undefined)?.properties)
    if (style) t.style = style
    const ch = (x.children ?? {}) as Record<string, XTopic[]>
    if (ch.attached?.length) t.children = await Promise.all(ch.attached.map(topic))
    else t.children = []
    if (ch.callout?.length) t.callouts = await Promise.all(ch.callout.map(topic))
    const sums = (x.summaries ?? []) as { id: string; range: string; topicId: string }[]
    if (sums.length && ch.summary?.length) {
      const sTopics = await Promise.all(ch.summary.map(topic))
      t.summaries = sums.map(s => {
        const st = sTopics.find(q => q.id === s.topicId)
        return st ? { id: s.id ?? uid(), ids: idsOfRange(t, s.range), topic: st } : null
      }).filter((s): s is NonNullable<typeof s> => !!s && s.ids.length > 0)
      if (!t.summaries.length) delete t.summaries
    }
    const bds = (x.boundaries ?? []) as { id: string; range: string; title?: string }[]
    if (bds.length) t.boundaries = bds.map(b => ({ id: b.id ?? uid(), title: b.title, ids: b.range === 'master' ? [t.id] : idsOfRange(t, b.range) }))
      .filter(b => b.ids.length)
    // восстанавливаем собственные поля
    if (extra.equation) t.equation = extra.equation
    if (extra.task) t.task = extra.task
    if (extra.comments) t.comments = extra.comments
    if (extra.commentPos) t.commentPos = extra.commentPos
    if (extra.commentsResolved) t.commentsResolved = extra.commentsResolved
    if (extra.image) t.image = extra.image
    if (extra.style) t.style = extra.style
    if (extra.boundaries) {
      const byId = new Map((t.boundaries ?? []).map(b => [b.id, b]))
      t.boundaries = (extra.boundaries as Topic['boundaries'])!.map(b => ({ ...byId.get(b.id), ...b }))
    }
    if (extra.attachment && !t.attachment) t.attachment = extra.attachment
    return t
  }

  const sheets: Sheet[] = []
  for (const xs of raw) {
    const root = xs.rootTopic as XTopic
    const rootTopic = await topic(root)
    const ch = (root.children ?? {}) as Record<string, XTopic[]>
    const own = (xs['x-mindmap'] ?? {}) as Partial<Sheet>
    const sheet: Sheet = {
      id: String(xs.id ?? uid()), title: String(xs.title ?? 'Sheet'), rootTopic,
      ...own,
      structure: own.structure ?? fromXStruct(root.structureClass as string) ?? 'mindmap',
    }
    delete rootTopic.structure
    if (ch.detached?.length) sheet.floatingTopics = await Promise.all(ch.detached.map(topic))
    const rels = (xs.relationships ?? []) as XTopic[]
    if (rels.length) sheet.relationships = rels.map(r => {
      const own2 = r['x-mindmap'] as Relationship | undefined
      if (own2) return own2
      return { id: String(r.id ?? uid()), end1: String(r.end1Id), end2: String(r.end2Id), title: r.title as string | undefined }
    })
    sheets.push(sheet)
  }
  if (!sheets.length) throw new Error('The file has no sheets')
  return { version: 1, sheets }
}

function idsOfRange(t: Topic, range: string): string[] {
  const m = /\((\d+),(\d+)\)/.exec(range)
  if (!m) return []
  return (t.children ?? []).slice(+m[1], +m[2] + 1).map(c => c.id)
}

function guessType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', pdf: 'application/pdf' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream'
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Старый формат XMind 8 (content.xml): темы, заметки, маркеры, метки, ссылки */
function fromXmindXml(xml: string): MapDocument {
  const dom = new DOMParser().parseFromString(xml, 'application/xml')
  const child = (el: Element, name: string) => [...el.children].find(c => c.localName === name)
  const topic = (el: Element): Topic => {
    const t: Topic = { id: el.getAttribute('id') ?? uid(), title: child(el, 'title')?.textContent ?? '', children: [] }
    const href = el.getAttribute('xlink:href')
    if (href?.startsWith('xmind:#')) t.href = 'topic:' + href.slice(7)
    else if (href && !href.startsWith('xap:')) t.href = href
    if (el.getAttribute('branch') === 'folded') t.collapsed = true
    const sc = fromXStruct(el.getAttribute('structure-class') ?? undefined)
    if (sc) t.structure = sc
    const notes = child(el, 'notes')
    const plain = notes && child(notes, 'plain')?.textContent
    if (plain) t.notes = { plain, html: escapeHtml(plain).replace(/\n/g, '<br>') }
    const markers = child(el, 'marker-refs')
    if (markers) {
      t.markers = [...markers.children].map(m => fromXMarker(m.getAttribute('marker-id') ?? '')).filter((m): m is string => !!m)
      if (!t.markers.length) delete t.markers
    }
    const labels = child(el, 'labels')
    if (labels) t.labels = [...labels.children].map(l => l.textContent ?? '').filter(Boolean)
    const ch = child(el, 'children')
    if (ch) for (const ts of [...ch.children].filter(c => c.localName === 'topics')) {
      const list = [...ts.children].filter(c => c.localName === 'topic').map(topic)
      if (ts.getAttribute('type') === 'attached') t.children = list
    }
    return t
  }
  const sheets = [...dom.getElementsByTagName('sheet')].map(sh => {
    const root = [...sh.children].find(c => c.localName === 'topic')!
    const rootTopic = topic(root)
    const structure = rootTopic.structure ?? 'mindmap'
    delete rootTopic.structure
    return { id: sh.getAttribute('id') ?? uid(), title: child(sh, 'title')?.textContent ?? 'Sheet', rootTopic, structure } as Sheet
  })
  if (!sheets.length) throw new Error('Could not read content.xml')
  return { version: 1, sheets }
}
