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
  fontWeight?: 'normal' | 'medium' | 'bold' | 'extrabold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'line-through'
  textColor?: string
  textAlign?: 'left' | 'center' | 'right'
  lineShape?: LineShape
  lineWidth?: number
  lineColor?: string
  /** штрих линии ветки и её окончание */
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  lineEnd?: 'none' | 'arrow'
  /** регистр текста */
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  maxWidth?: number
  /** фиксированная ширина темы (вместо «по тексту») */
  width?: number
}

export interface Topic {
  id: string
  title: string
  children?: Topic[]
  collapsed?: boolean
  style?: TopicStyle
  /** Отдельная раскладка для ветки */
  structure?: StructureId
  /** Позиция плавающей темы относительно центра центральной темы;
   *  у выноски — смещение от правого верхнего угла темы-владельца */
  position?: { x: number; y: number }
  markers?: string[]
  labels?: string[]
  notes?: { html: string; plain: string }
  /** веб-ссылка (https://…) или ссылка на тему (topic:<id>) */
  href?: string
  image?: { src: string; width: number; height: number }
  attachment?: { url: string; name: string; size: number }
  /** формула LaTeX */
  equation?: string
  task?: { done: boolean }
  /** сведения о задаче для диаграммы Ганта */
  taskInfo?: { start?: string; end?: string; progress?: number; assignee?: string; priority?: number; dependsOn?: string[] }
  /** аудиозаметка */
  audio?: { url: string; duration: number }
  /** свободное положение ветки: смещение блока относительно места по раскладке */
  offset?: { x: number; y: number }
  /** настройки слайда в режиме презентации */
  pitch?: { slide?: 'auto' | 'yes' | 'no'; subSlides?: 'auto' | 'yes' | 'no'; delivery?: 'all' | 'one' | 'drill'; layout?: 'list' | 'bullets' | 'indent' | 'branch' | 'columns' }
  comments?: Comment[]
  /** положение метки обсуждения относительно левого верхнего угла темы */
  commentPos?: { x: number; y: number }
  commentsResolved?: boolean
  boundaries?: Boundary[]
  summaries?: Summary[]
  callouts?: Topic[]
  [k: string]: unknown
}

export interface Comment { id: string; author: string; text: string; createdAt: string }

export interface Boundary { id: string; ids: string[]; title?: string; color?: string; lineStyle?: BorderStyle; fill?: string }

export interface Summary { id: string; ids: string[]; topic: Topic }

export interface Relationship {
  id: string
  end1: string
  end2: string
  title?: string
  /** контрольные точки кривой относительно центров тем end1 / end2 */
  cp1?: { x: number; y: number }
  cp2?: { x: number; y: number }
  color?: string
  width?: number
  lineStyle?: BorderStyle
  arrowStart?: boolean
  arrowEnd?: boolean
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
  /** id цветовой палитры веток */
  palette?: string
  globalFont?: string
  branchLineWidth?: number
  /** параметры карты (вкладка «Карта») */
  balance?: boolean
  compact?: boolean
  uniformWidth?: boolean
  showNotes?: boolean
  autoColorFloating?: boolean
  relColorFollowTopic?: boolean
  freeBranch?: boolean
  cjkFont?: string
  pitchTheme?: 'light' | 'dark'
  pitchRatio?: 'auto' | '16:9' | '4:3' | '9:16' | '3:4'
  pitchAnimation?: boolean
  legend?: boolean
  /** подписи маркеров в легенде */
  markerNames?: Record<string, string>
  relationships?: Relationship[]
  [k: string]: unknown
}

export interface MapDocument { version: number; sheets: Sheet[] }

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export type Level = 'central' | 'main' | 'sub' | 'floating' | 'summary' | 'callout'
export type RefKind = 'root' | 'child' | 'floating' | 'summary' | 'callout'

export interface TopicRef {
  topic: Topic
  parent: Topic | null
  index: number
  depth: number
  /** корень дерева, к которому принадлежит тема: rootTopic или плавающая */
  isFloatingTree: boolean
  /** индекс основной ветки (для радужных веток) */
  branch: number
  kind: RefKind
}

/** Индекс всех тем листа (включая сводки и выноски): id → ссылка */
export function indexSheet(sheet: Sheet): Map<string, TopicRef> {
  const map = new Map<string, TopicRef>()
  const walk = (t: Topic, parent: Topic | null, index: number, depth: number, floating: boolean, branch: number, kind: RefKind) => {
    map.set(t.id, { topic: t, parent, index, depth, isFloatingTree: floating, branch, kind })
    t.children?.forEach((c, i) => walk(c, t, i, depth + 1, floating, depth === 0 && kind === 'root' ? i : branch, 'child'))
    t.summaries?.forEach((s, i) => walk(s.topic, t, i, depth + 1, floating, branch, 'summary'))
    t.callouts?.forEach((c, i) => walk(c, t, i, depth + 1, floating, branch, 'callout'))
  }
  walk(sheet.rootTopic, null, 0, 0, false, -1, 'root')
  sheet.floatingTopics?.forEach((f, i) => walk(f, null, i, 0, true, -1, 'floating'))
  return map
}

export function levelOf(ref: TopicRef): Level {
  if (ref.kind === 'summary') return 'summary'
  if (ref.kind === 'callout') return 'callout'
  if (ref.isFloatingTree) return ref.depth === 0 ? 'floating' : 'sub'
  return ref.depth === 0 ? 'central' : ref.depth === 1 ? 'main' : 'sub'
}

/** Глубокая копия с новыми id; ссылки границ/сводок на детей переназначаются */
export function cloneWithNewIds(t: Topic): Topic {
  const c = structuredClone(t)
  const remap = (n: Topic): Topic => {
    const ids = new Map<string, string>()
    n.children = n.children?.map(ch => { const nc = remap(ch); ids.set(ch.id, nc.id); return nc })
    const fix = (list: string[]) => list.map(i => ids.get(i) ?? i)
    n.boundaries = n.boundaries?.map(b => ({ ...b, id: uid(), ids: fix(b.ids) }))
    n.summaries = n.summaries?.map(s => ({ ...s, id: uid(), ids: fix(s.ids), topic: remap(s.topic) }))
    n.callouts = n.callouts?.map(remap)
    return { ...n, id: uid() }
  }
  return remap(c)
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
