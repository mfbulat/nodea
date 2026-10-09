// Модель документа карты. Формат близок к content.json, чтобы упростить
// импорт/экспорт .xmind на этапе 4.

export type StructureId =
  | 'mindmap' | 'mindmap-cw' | 'mindmap-acw'
  | 'logic-right' | 'logic-left'
  | 'brace-right' | 'brace-left'
  | 'org-down' | 'org-up'
  | 'tree-right' | 'tree-left'
  | 'timeline-h' | 'timeline-v'
  | 'fishbone-left' | 'fishbone-right'
  | 'tree-table'
  | 'matrix'

export type ShapeId = 'rect' | 'rounded' | 'capsule' | 'ellipse' | 'diamond' | 'hexagon'
  | 'parallelogram' | 'underline' | 'none'
export type LineShape = 'curve' | 'straight' | 'elbow' | 'rounded' | 'taper' | 'none'
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none'

export interface TopicStyle {
  shape?: ShapeId
  fill?: string
  borderColor?: string
  borderWidth?: number
  borderStyle?: BorderStyle
  fontFamily?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'line-through'
  textColor?: string
  textAlign?: 'left' | 'center' | 'right'
  lineShape?: LineShape
  lineWidth?: number
  lineColor?: string
  maxWidth?: number
}

export interface Topic {
  id: string
  title: string
  children?: Topic[]
  collapsed?: boolean
  style?: TopicStyle
  /** Отдельная раскладка для ветки */
  structure?: StructureId
  /** Позиция плавающей темы относительно центра центральной темы */
  position?: { x: number; y: number }
  [k: string]: unknown
}

export interface Sheet {
  id: string
  title: string
  rootTopic: Topic
  floatingTopics?: Topic[]
  theme?: string
  structure?: StructureId
  background?: string
  rainbow?: boolean
  [k: string]: unknown
}

export interface MapDocument { version: number; sheets: Sheet[] }

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export type Level = 'central' | 'main' | 'sub' | 'floating'

export interface TopicRef {
  topic: Topic
  parent: Topic | null
  index: number
  depth: number
  /** корень дерева, к которому принадлежит тема: rootTopic или плавающая */
  isFloatingTree: boolean
  /** индекс основной ветки (для радужных веток) */
  branch: number
}

/** Индекс всех тем листа: id → ссылка */
export function indexSheet(sheet: Sheet): Map<string, TopicRef> {
  const map = new Map<string, TopicRef>()
  const walk = (t: Topic, parent: Topic | null, index: number, depth: number, floating: boolean, branch: number) => {
    map.set(t.id, { topic: t, parent, index, depth, isFloatingTree: floating, branch })
    t.children?.forEach((c, i) => walk(c, t, i, depth + 1, floating, depth === 0 ? i : branch))
  }
  walk(sheet.rootTopic, null, 0, 0, false, -1)
  sheet.floatingTopics?.forEach((f, i) => walk(f, null, i, 0, true, -1))
  return map
}

export function levelOf(ref: TopicRef): Level {
  if (ref.isFloatingTree) return ref.depth === 0 ? 'floating' : 'sub'
  return ref.depth === 0 ? 'central' : ref.depth === 1 ? 'main' : 'sub'
}

export function cloneWithNewIds(t: Topic): Topic {
  return { ...structuredClone(t), id: uid(), children: t.children?.map(cloneWithNewIds) }
}

export function isAncestor(index: Map<string, TopicRef>, ancestorId: string, id: string): boolean {
  let cur = index.get(id)
  while (cur?.parent) {
    if (cur.parent.id === ancestorId) return true
    cur = index.get(cur.parent.id)
  }
  return false
}

/** Тексты тем → дерево по отступам (для вставки из буфера обмена) */
export function topicsFromText(text: string): Topic[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const roots: Topic[] = []
  const stack: { indent: number; topic: Topic }[] = []
  for (const line of lines) {
    const indent = line.match(/^[\t ]*/)![0].replace(/\t/g, '    ').length
    const title = line.trim().replace(/^([-*+]|\d+[.)])\s+/, '')
    const topic: Topic = { id: uid(), title, children: [] }
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    if (stack.length) stack[stack.length - 1].topic.children!.push(topic)
    else roots.push(topic)
    stack.push({ indent, topic })
  }
  return roots
}

export function topicsToText(topics: Topic[]): string {
  const out: string[] = []
  const walk = (t: Topic, d: number) => { out.push('\t'.repeat(d) + t.title); t.children?.forEach(c => walk(c, d + 1)) }
  topics.forEach(t => walk(t, 0))
  return out.join('\n')
}
