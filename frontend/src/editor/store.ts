import { create } from 'zustand'
import { produce } from 'immer'
import { useDoc } from '../store/doc'
import type { Boundary, MapDocument, Relationship, Sheet, StructureId, Topic, TopicStyle } from './model'
import { cloneWithNewIds, indexSheet, isAncestor, uid } from './model'
import { markerGroup } from './markers'
import { collab } from '../collab/session'
import type { LayoutResult } from './layout'

const HISTORY_LIMIT = 200

export interface View { zoom: number; x: number; y: number }

type LocKind = 'root' | 'child' | 'floating' | 'summary' | 'callout'
interface Located { topic: Topic; siblings: Topic[]; index: number; parent: Topic | null; floating: boolean; kind: LocKind }

export function locate(sheet: Sheet, id: string): Located | null {
  if (sheet.rootTopic.id === id) return { topic: sheet.rootTopic, siblings: [], index: 0, parent: null, floating: false, kind: 'root' }
  const fl = sheet.floatingTopics ?? []
  const fi = fl.findIndex(f => f.id === id)
  if (fi >= 0) return { topic: fl[fi], siblings: fl, index: fi, parent: null, floating: true, kind: 'floating' }
  const walk = (t: Topic): Located | null => {
    const ch = t.children ?? []
    for (let i = 0; i < ch.length; i++) {
      if (ch[i].id === id) return { topic: ch[i], siblings: ch, index: i, parent: t, floating: false, kind: 'child' }
      const r = walk(ch[i])
      if (r) return r
    }
    const sm = t.summaries ?? []
    for (let i = 0; i < sm.length; i++) {
      if (sm[i].topic.id === id) return { topic: sm[i].topic, siblings: [], index: i, parent: t, floating: false, kind: 'summary' }
      const r = walk(sm[i].topic)
      if (r) return r
    }
    const co = t.callouts ?? []
    for (let i = 0; i < co.length; i++) {
      if (co[i].id === id) return { topic: co[i], siblings: co, index: i, parent: t, floating: false, kind: 'callout' }
      const r = walk(co[i])
      if (r) return r
    }
    return null
  }
  return walk(sheet.rootTopic) ?? fl.reduce<Located | null>((acc, f) => acc ?? walk(f), null)
}

/** Оставляет только «верхние» темы выделения (без потомков других выделенных) */
export function topLevel(sheet: Sheet, ids: string[]): string[] {
  const idx = indexSheet(sheet)
  return ids.filter(id => idx.has(id) && !ids.some(o => o !== id && isAncestor(idx, o, id)))
}

/** Убирает ссылки границ/сводок/связей на удалённые темы */
function prune(sheet: Sheet) {
  const visit = (t: Topic) => {
    const ids = new Set((t.children ?? []).map(c => c.id))
    if (t.boundaries) {
      for (const b of t.boundaries) b.ids = b.ids.filter(i => ids.has(i) || i === t.id)
      t.boundaries = t.boundaries.filter(b => b.ids.length)
      if (!t.boundaries.length) delete t.boundaries
    }
    if (t.summaries) {
      for (const sm of t.summaries) sm.ids = sm.ids.filter(i => ids.has(i))
      t.summaries = t.summaries.filter(sm => sm.ids.length)
      if (!t.summaries.length) delete t.summaries
    }
    t.children?.forEach(visit)
    t.summaries?.forEach(sm => visit(sm.topic))
    t.callouts?.forEach(visit)
  }
  visit(sheet.rootTopic)
  sheet.floatingTopics?.forEach(visit)
  if (sheet.relationships) {
    const idx = indexSheet(sheet)
    sheet.relationships = sheet.relationships.filter(r => idx.has(r.end1) && idx.has(r.end2))
  }
}

export type ElementSel = { kind: 'relationship' | 'boundary'; id: string } | null
export type PanelId = 'format' | 'versions' | 'notes' | 'comments' | 'markers' | 'filter' | null

let layoutRef: LayoutResult | null = null
export const setCurrentLayout = (l: LayoutResult) => { layoutRef = l }
export const currentLayout = () => layoutRef

interface EditorState {
  sheetId: string | null
  selection: string[]
  editingId: string | null
  editSeed: string | null
  past: MapDocument[]
  future: MapDocument[]
  view: View
  clipboard: Topic[] | null
  styleClipboard: TopicStyle | null
  /** кисть формата: следующий щелчок по теме применит скопированный стиль */
  painting: boolean
  /** окно диаграммы Ганта и режим снимка области карты (интерфейс — в работе) */
  gantt: boolean
  markerTab: 'markers' | 'stickers' | 'illustrations'
  taskDialog: string | null
  setMarkerTab: (t: EditorState['markerTab']) => void
  /** левая навигационная панель (как в веб-версии) */
  nav: null | 'outline' | 'notes' | 'tags' | 'resources'
  setNav: (n: EditorState['nav']) => void
  /** панель инструментов: только значки или значки с подписями */
  toolbarText: boolean
  setToolbarText: (v: boolean) => void
  /** правка всего документа (все листы) одним шагом отмены */
  mutateDocument: (fn: (d: MapDocument) => void) => void
  /** режим «щёлкните по карте, чтобы прокомментировать» */
  commenting: boolean
  /** открытое обсуждение: тема и (для нового) место метки */
  thread: { id: string; pos?: { x: number; y: number } } | null
  setCommenting: (v: boolean) => void
  setThread: (t: EditorState['thread']) => void
  resolveThread: (id: string, resolved: boolean) => void
  removeThread: (id: string) => void
  setTaskDialog: (id: string | null) => void
  mapShot: boolean
  setGantt: (v: boolean) => void
  setMapShot: (v: boolean) => void
  element: ElementSel
  panel: PanelId
  relating: string | null
  dialog: { kind: 'link' | 'labels' | 'equation' | 'sticker'; id: string } | null
  userName: string
  viewMode: 'map' | 'outline'
  zen: boolean
  presenting: boolean
  /** «показать только ветку»: id темы, показываемой как центральная */
  drillId: string | null
  filter: { markers: string[]; labels: string[] } | null
  search: { open: boolean; query: string; hits: string[]; index: number }

  reset: () => void
  sheet: () => Sheet | null
  mutate: (fn: (sheet: Sheet, doc: MapDocument) => void) => void
  setView: (v: Partial<View>) => void
  select: (ids: string[]) => void
  toggleSelect: (id: string) => void
  startEdit: (id: string, seed?: string | null) => void
  stopEdit: () => void
  setTitle: (id: string, title: string) => void
  addChild: () => void
  addSibling: (before: boolean) => void
  addFloating: (x: number, y: number) => void
  removeSelected: () => void
  toggleCollapse: () => void
  move: (ids: string[], targetId: string, mode: 'child' | 'before' | 'after') => void
  detach: (ids: string[], pos: { x: number; y: number }) => void
  setPosition: (id: string, pos: { x: number; y: number }) => void
  copy: () => Topic[]
  cut: () => Topic[]
  paste: (topics?: Topic[], targetId?: string) => void
  setStyle: (patch: TopicStyle) => void
  clearStyle: () => void
  copyStyle: (style: TopicStyle) => void
  pasteStyle: () => void
  setStructure: (s: StructureId | undefined) => void
  setSheet: (patch: Partial<Sheet>) => void
  undo: () => void
  redo: () => void
  selectAll: () => void
  selectElement: (e: ElementSel) => void
  setPanel: (p: PanelId) => void
  setDialog: (d: EditorState['dialog']) => void
  setTopic: (ids: string[], patch: Partial<Topic>) => void
  toggleMarker: (marker: string) => void
  toggleTask: (id: string) => void
  startRelating: () => void
  finishRelating: (targetId: string | null) => void
  updateRelationship: (id: string, patch: Partial<Relationship>) => void
  addBoundary: () => void
  updateBoundary: (id: string, patch: Partial<Boundary>) => void
  addSummary: () => void
  addCallout: () => void
  addComment: (id: string, text: string, pos?: { x: number; y: number }) => void
  removeComment: (id: string, commentId: string) => void
  removeElement: () => void
  setSheetId: (id: string) => void
  addSheet: () => void
  duplicateSheet: (id: string) => void
  removeSheet: (id: string) => void
  renameSheet: (id: string, title: string) => void
  moveSheet: (id: string, delta: number) => void
  revealTopic: (id: string) => boolean
  indent: () => void
  outdent: () => void
  addParent: () => void
  duplicate: () => void
  deleteSingle: () => void
  foldAll: (collapse?: boolean) => void
  selectBy: (kind: 'subtopics' | 'siblings' | 'level' | 'floating') => void
  goCentral: () => void
  setViewMode: (m: 'map' | 'outline') => void
  setZen: (z: boolean) => void
  setPresenting: (p: boolean) => void
  drillDown: (id?: string) => void
  drillUp: () => void
  setFilter: (f: EditorState['filter']) => void
  setSearch: (patch: Partial<EditorState['search']>) => void
  replaceAll: (query: string, replacement: string) => number
}

export const useEditor = create<EditorState>((set, get) => {
  const doc = () => useDoc.getState().doc!
  const current = (d: MapDocument) => d.sheets.find(s => s.id === get().sheetId) ?? d.sheets[0]
  const primary = () => { const s = get().selection; return s[s.length - 1] }
  const commit = (next: MapDocument) => {
    const prev = doc()
    if (next === prev) return
    if (useDoc.getState().role === 'view') return
    // в совместном режиме историю ведёт Y.UndoManager (только свои правки)
    if (!collab()) set(st => ({ past: [...st.past.slice(-HISTORY_LIMIT + 1), prev], future: [] }))
    useDoc.getState().setDoc(next)
  }
  const mutate = (fn: (sheet: Sheet, d: MapDocument) => void) => commit(produce(doc(), d => { const sh = current(d); fn(sh, d); prune(sh) }))
  const mutateDoc = (fn: (d: MapDocument) => void) => commit(produce(doc(), fn))
  const newTopic = (title: string): Topic => ({ id: uid(), title, children: [] })
  // как в XMind: новые темы нумеруются («Подтема 3», «Основная тема 5»)
  const childTitle = (sheet: Sheet, parentId: string) => {
    const n = (locate(sheet, parentId)?.topic.children?.length ?? 0) + 1
    return (sheet.rootTopic.id === parentId ? 'Основная тема ' : 'Подтема ') + n
  }

  return {
    sheetId: null, selection: [], editingId: null, editSeed: null, past: [], future: [],
    view: { zoom: 1, x: 0, y: 0 }, clipboard: null, styleClipboard: null, painting: false, gantt: false, mapShot: false, markerTab: 'markers', taskDialog: null,
    setMarkerTab: t => set({ markerTab: t }),
    commenting: false, thread: null,
    nav: null, setNav: n => set(n ? { nav: n, taskDialog: null } : { nav: null }),
    toolbarText: (() => { try { return localStorage.getItem('mm.toolbarText') === '1' } catch { return false } })(),
    setToolbarText: v => { try { localStorage.setItem('mm.toolbarText', v ? '1' : '0') } catch { /* нет хранилища */ } set({ toolbarText: v }) },
    mutateDocument: fn => mutateDoc(fn),
    setCommenting: v => set({ commenting: v }), setThread: t => set({ thread: t, commenting: false }),
    resolveThread: (id, resolved) => mutate(sh => { const t = locate(sh, id)?.topic; if (t) { if (resolved) t.commentsResolved = true; else delete t.commentsResolved } }),
    removeThread: id => { mutate(sh => { const t = locate(sh, id)?.topic; if (t) { delete t.comments; delete t.commentPos; delete t.commentsResolved } }); if (get().thread?.id === id) set({ thread: null }) }, setTaskDialog: id => set(id ? { taskDialog: id, nav: null } : { taskDialog: null }),
    setGantt: v => set({ gantt: v }), setMapShot: v => set({ mapShot: v }),
    element: null, panel: null, relating: null, dialog: null, userName: '',
    viewMode: 'map', zen: false, presenting: false, drillId: null, filter: null,
    search: { open: false, query: '', hits: [], index: 0 },

    reset: () => {
      const d = useDoc.getState().doc
      set({ sheetId: d?.sheets[0]?.id ?? null, selection: d ? [d.sheets[0].rootTopic.id] : [], editingId: null, past: [], future: [],
        element: null, relating: null, dialog: null, drillId: null, filter: null, presenting: false, commenting: false, thread: null,
        search: { open: false, query: '', hits: [], index: 0 } })
    },
    sheet: () => { const d = useDoc.getState().doc; return d ? current(d) : null },
    mutate,
    setView: v => set(st => ({ view: { ...st.view, ...v } })),
    select: ids => set({ selection: ids, element: null }),
    toggleSelect: id => set(st => ({ element: null, selection: st.selection.includes(id) ? st.selection.filter(s => s !== id) : [...st.selection, id] })),
    startEdit: (id, seed = null) => set({ editingId: id, editSeed: seed, selection: [id] }),
    stopEdit: () => set({ editingId: null, editSeed: null }),
    setTitle: (id, title) => {
      const loc = get().sheet() && locate(get().sheet()!, id)
      if (!loc || loc.topic.title === title) return
      mutate(sh => { locate(sh, id)!.topic.title = title })
    },

    addChild: () => {
      const id = primary()
      if (!id) return
      const sheet = get().sheet()!
      const t = newTopic(childTitle(sheet, id))
      mutate(sh => {
        const loc = locate(sh, id)!
        loc.topic.collapsed = false
        ;(loc.topic.children ??= []).push(t)
      })
      get().startEdit(t.id)
    },
    addSibling: before => {
      const id = primary()
      if (!id) return
      const sheet = get().sheet()!
      const loc = locate(sheet, id)
      if (!loc) return
      if ((!loc.parent && !loc.floating) || loc.kind === 'summary') return get().addChild()
      if (loc.kind === 'callout') return
      const t = newTopic(loc.floating ? 'Плавающая тема' : childTitle(sheet, loc.parent!.id))
      mutate(sh => {
        const l = locate(sh, id)!
        if (l.floating) {
          const p = l.topic.position ?? { x: 0, y: 0 }
          const box = layoutRef?.boxes.get(id)
          t.position = { x: p.x, y: p.y + (before ? -1 : 1) * ((box?.h ?? 40) + 30) }
        }
        l.siblings.splice(before ? l.index : l.index + 1, 0, t)
      })
      get().startEdit(t.id)
    },
    addFloating: (x, y) => {
      const t: Topic = { ...newTopic('Плавающая тема'), position: { x, y } }
      mutate(sh => { (sh.floatingTopics ??= []).push(t) })
      get().startEdit(t.id)
    },
    removeSelected: () => {
      const sheet = get().sheet()
      if (!sheet) return
      const ids = topLevel(sheet, get().selection).filter(id => id !== sheet.rootTopic.id)
      if (!ids.length) return
      // следующее выделение: соседняя тема или родитель
      const first = locate(sheet, ids[0])!
      const next = first.siblings.find((s, i) => i > first.index && !ids.includes(s.id))
        ?? [...first.siblings].reverse().find((s, i) => first.siblings.length - 1 - i < first.index && !ids.includes(s.id))
        ?? first.parent ?? sheet.rootTopic
      mutate(sh => {
        for (const id of ids) {
          const l = locate(sh, id)
          if (!l) continue
          if (l.kind === 'summary') l.parent!.summaries = l.parent!.summaries!.filter(s => s.topic.id !== id)
          else l.siblings.splice(l.index, 1)
        }
      })
      set({ selection: [first.kind === 'summary' || first.kind === 'callout' ? first.parent!.id : next.id] })
    },
    toggleCollapse: () => {
      const sheet = get().sheet()
      if (!sheet) return
      const ids = get().selection.filter(id => id !== sheet.rootTopic.id && locate(sheet, id)?.topic.children?.length)
      if (!ids.length) return
      const collapse = !locate(sheet, ids[0])!.topic.collapsed
      mutate(sh => { for (const id of ids) locate(sh, id)!.topic.collapsed = collapse })
    },
    move: (ids, targetId, mode) => {
      const sheet = get().sheet()!
      const idx = indexSheet(sheet)
      const moving = topLevel(sheet, ids).filter(id => id !== sheet.rootTopic.id && id !== targetId && !isAncestor(idx, id, targetId)
        && ['child', 'floating'].includes(idx.get(id)!.kind))
      if (!moving.length) return
      const tk = idx.get(targetId)?.kind
      if (mode !== 'child' && (tk === 'root' || tk === 'summary' || tk === 'callout')) mode = 'child'
      mutate(sh => {
        const taken: Topic[] = []
        for (const id of moving) {
          const l = locate(sh, id)!
          l.siblings.splice(l.index, 1)
          const t = l.topic
          delete t.position
          taken.push(t)
        }
        const tl = locate(sh, targetId)!
        if (mode === 'child') {
          tl.topic.collapsed = false
          ;(tl.topic.children ??= []).push(...taken)
        } else {
          const at = tl.index + (mode === 'after' ? 1 : 0)
          if (tl.floating) taken.forEach((t, i) => { t.position = { ...(tl.topic.position ?? { x: 0, y: 0 }) }; t.position.y += (i + 1) * 50 })
          tl.siblings.splice(at, 0, ...taken)
        }
      })
    },
    detach: (ids, pos) => {
      const sheet = get().sheet()!
      const idx = indexSheet(sheet)
      const moving = topLevel(sheet, ids).filter(id => idx.get(id)?.kind === 'child')
      if (!moving.length) return
      mutate(sh => {
        moving.forEach((id, i) => {
          const l = locate(sh, id)!
          l.siblings.splice(l.index, 1)
          l.topic.position = { x: pos.x, y: pos.y + i * 50 }
          ;(sh.floatingTopics ??= []).push(l.topic)
        })
      })
    },
    setPosition: (id, pos) => mutate(sh => { const l = locate(sh, id); if (l?.floating || l?.kind === 'callout') l.topic.position = pos }),

    copy: () => {
      const sheet = get().sheet()
      if (!sheet) return []
      const topics = topLevel(sheet, get().selection).map(id => structuredClone(locate(sheet, id)!.topic))
      set({ clipboard: topics })
      return topics
    },
    cut: () => {
      const topics = get().copy()
      get().removeSelected()
      return topics
    },
    paste: (topics, targetId) => {
      const src = topics ?? get().clipboard
      const id = targetId ?? primary()
      if (!src?.length) return
      const sheet = get().sheet()!
      const clones = src.map(cloneWithNewIds).map(t => { delete t.position; return t })
      if (!id || !locate(sheet, id)) {
        mutate(sh => { clones.forEach((t, i) => { t.position = { x: 200, y: 120 + i * 50 }; (sh.floatingTopics ??= []).push(t) }) })
      } else {
        mutate(sh => {
          const l = locate(sh, id)!
          l.topic.collapsed = false
          ;(l.topic.children ??= []).push(...clones)
        })
      }
      set({ selection: clones.map(c => c.id) })
    },

    setStyle: patch => {
      const ids = get().selection
      mutate(sh => {
        for (const id of ids) {
          const l = locate(sh, id)
          if (!l) continue
          const st = { ...(l.topic.style ?? {}), ...patch }
          for (const k of Object.keys(st) as (keyof TopicStyle)[]) if (st[k] === undefined) delete st[k]
          l.topic.style = st
        }
      })
    },
    clearStyle: () => {
      const ids = get().selection
      mutate(sh => { for (const id of ids) { const l = locate(sh, id); if (l) delete l.topic.style } })
    },
    copyStyle: style => set({ styleClipboard: style }),
    pasteStyle: () => {
      const s = get().styleClipboard
      if (!s) return
      const ids = get().selection
      mutate(sh => { for (const id of ids) { const l = locate(sh, id); if (l) l.topic.style = { ...s } } })
    },
    setStructure: s => {
      const ids = get().selection
      mutate(sh => {
        for (const id of ids) {
          if (id === sh.rootTopic.id) { sh.structure = s ?? 'mindmap'; continue }
          const l = locate(sh, id)
          if (!l) continue
          if (s) l.topic.structure = s
          else delete l.topic.structure
        }
      })
    },
    setSheet: patch => mutate(sh => { Object.assign(sh, patch) }),

    undo: () => {
      const c = collab()
      if (c) { c.undo.undo(); set({ editingId: null }); keepValidSelection(); return }
      const { past } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      set(st => ({ past: st.past.slice(0, -1), future: [doc(), ...st.future], editingId: null }))
      useDoc.getState().setDoc(prev)
      keepValidSelection()
    },
    redo: () => {
      const c = collab()
      if (c) { c.undo.redo(); set({ editingId: null }); keepValidSelection(); return }
      const { future } = get()
      if (!future.length) return
      const next = future[0]
      set(st => ({ future: st.future.slice(1), past: [...st.past, doc()], editingId: null }))
      useDoc.getState().setDoc(next)
      keepValidSelection()
    },
    selectAll: () => {
      const sheet = get().sheet()
      if (sheet) set({ selection: [...indexSheet(sheet).keys()] })
    },

    selectElement: e => set({ element: e, selection: [], editingId: null }),
    setPanel: p => set({ panel: p }),
    setDialog: d => set({ dialog: d }),
    setTopic: (ids, patch) => mutate(sh => {
      for (const id of ids) {
        const l = locate(sh, id)
        if (!l) continue
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || (Array.isArray(v) && !v.length)) delete l.topic[k]
          else l.topic[k] = v
        }
      }
    }),
    toggleMarker: marker => {
      const sheet = get().sheet()
      const ids = get().selection
      if (!sheet || !ids.length) return
      const has = !!locate(sheet, ids[ids.length - 1])?.topic.markers?.includes(marker)
      mutate(sh => {
        for (const id of ids) {
          const t = locate(sh, id)?.topic
          if (!t) continue
          const rest = (t.markers ?? []).filter(m => markerGroup(m) !== markerGroup(marker))
          t.markers = has ? rest : [...rest, marker]
          if (!t.markers.length) delete t.markers
        }
      })
    },
    toggleTask: id => mutate(sh => { const t = locate(sh, id)?.topic; if (t?.task) t.task.done = !t.task.done }),

    startRelating: () => { const id = primary(); if (id) set({ relating: id }) },
    finishRelating: targetId => {
      const src = get().relating
      set({ relating: null })
      if (!src || !targetId || targetId === src) return
      const r: Relationship = { id: uid(), end1: src, end2: targetId, title: '' }
      mutate(sh => { (sh.relationships ??= []).push(r) })
      set({ element: { kind: 'relationship', id: r.id }, selection: [] })
    },
    updateRelationship: (id, patch) => mutate(sh => {
      const r = sh.relationships?.find(x => x.id === id)
      if (r) Object.assign(r, patch)
    }),
    addBoundary: () => {
      const sheet = get().sheet()
      if (!sheet) return
      const ids = topLevel(sheet, get().selection)
      if (!ids.length) return
      const idx = indexSheet(sheet)
      const first = idx.get(ids[0])!
      const b: Boundary = { id: uid(), ids: [], title: '' }
      if (first.kind === 'root' || first.kind === 'floating') {
        // граница вокруг всей (плавающей) карты
        b.ids = [first.topic.id]
        mutate(sh => { const t = locate(sh, first.topic.id)!.topic; (t.boundaries ??= []).push(b) })
      } else {
        const parent = first.parent!
        b.ids = ids.filter(i => idx.get(i)?.parent?.id === parent.id && idx.get(i)?.kind === 'child')
        if (!b.ids.length) return
        mutate(sh => { const t = locate(sh, parent.id)!.topic; (t.boundaries ??= []).push(b) })
      }
      set({ element: { kind: 'boundary', id: b.id }, selection: [] })
    },
    updateBoundary: (id, patch) => mutate(sh => {
      const walk = (t: Topic): boolean => {
        const b = t.boundaries?.find(x => x.id === id)
        if (b) { Object.assign(b, patch); return true }
        return (t.children ?? []).some(walk) || (t.summaries ?? []).some(s => walk(s.topic))
      }
      walk(sh.rootTopic) || (sh.floatingTopics ?? []).some(walk)
    }),
    addSummary: () => {
      const sheet = get().sheet()
      if (!sheet) return
      const idx = indexSheet(sheet)
      const ids = topLevel(sheet, get().selection).filter(i => idx.get(i)?.kind === 'child')
      if (!ids.length) return
      const parent = idx.get(ids[0])!.parent!
      const same = ids.filter(i => idx.get(i)!.parent!.id === parent.id)
      // сводка охватывает непрерывный диапазон от первой до последней выбранной темы
      const pos = same.map(i => idx.get(i)!.index)
      const range = (parent.children ?? []).slice(Math.min(...pos), Math.max(...pos) + 1).map(c => c.id)
      const topic: Topic = { id: uid(), title: 'Сводка', children: [] }
      mutate(sh => {
        const t = locate(sh, parent.id)!.topic
        ;(t.summaries ??= []).push({ id: uid(), ids: range, topic })
      })
      get().startEdit(topic.id)
    },
    addCallout: () => {
      const id = primary()
      if (!id) return
      const topic: Topic = { id: uid(), title: 'Выноска', children: [] }
      mutate(sh => { const t = locate(sh, id)?.topic; if (t) (t.callouts ??= []).push(topic) })
      get().startEdit(topic.id)
    },
    addComment: (id, text, pos) => mutate(sh => {
      const t = locate(sh, id)?.topic
      if (!t) return
      ;(t.comments ??= []).push({ id: uid(), author: get().userName, text, createdAt: new Date().toISOString() })
      if (pos && !t.commentPos) t.commentPos = pos
      delete t.commentsResolved
    }),
    removeComment: (id, commentId) => mutate(sh => {
      const t = locate(sh, id)?.topic
      if (!t?.comments) return
      t.comments = t.comments.filter(c => c.id !== commentId)
      if (!t.comments.length) { delete t.comments; delete t.commentPos; delete t.commentsResolved }
    }),
    removeElement: () => {
      const e = get().element
      if (!e) return
      if (e.kind === 'relationship') mutate(sh => { sh.relationships = sh.relationships?.filter(r => r.id !== e.id) })
      else mutate(sh => {
        const walk = (t: Topic) => {
          if (t.boundaries) t.boundaries = t.boundaries.filter(b => b.id !== e.id)
          t.children?.forEach(walk); t.summaries?.forEach(s => walk(s.topic))
        }
        walk(sh.rootTopic); sh.floatingTopics?.forEach(walk)
      })
      set({ element: null })
    },

    setSheetId: id => {
      const d = doc()
      const sh = d.sheets.find(s => s.id === id)
      if (sh) set({ sheetId: id, selection: [sh.rootTopic.id], element: null, editingId: null, relating: null, drillId: null })
    },
    addSheet: () => {
      const sh: Sheet = { id: uid(), title: `Карта ${doc().sheets.length + 1}`, structure: 'mindmap-cw',
        rootTopic: { id: uid(), title: 'Центральная тема', children: [1, 2, 3, 4].map(i => ({ id: uid(), title: `Основная тема ${i}`, children: [] })) } }
      mutateDoc(d => { d.sheets.push(sh) })
      get().setSheetId(sh.id)
    },
    duplicateSheet: id => {
      const src = doc().sheets.find(s => s.id === id)
      if (!src) return
      const copy: Sheet = { ...structuredClone(src), id: uid(), title: src.title + ' (копия)' }
      // новые id тем и пересчёт связей
      const oldIdx = indexSheet(src)
      copy.rootTopic = cloneWithNewIds(src.rootTopic)
      copy.floatingTopics = src.floatingTopics?.map(cloneWithNewIds)
      const newIdx = [...indexSheet(copy).keys()]
      const map = new Map([...oldIdx.keys()].map((k, i) => [k, newIdx[i]]))
      copy.relationships = src.relationships?.map(r => ({ ...r, id: uid(), end1: map.get(r.end1) ?? r.end1, end2: map.get(r.end2) ?? r.end2 }))
      mutateDoc(d => { d.sheets.splice(d.sheets.findIndex(s => s.id === id) + 1, 0, copy) })
      get().setSheetId(copy.id)
    },
    removeSheet: id => {
      const d = doc()
      if (d.sheets.length <= 1) return
      const i = d.sheets.findIndex(s => s.id === id)
      mutateDoc(dd => { dd.sheets.splice(i, 1) })
      if (get().sheetId === id) get().setSheetId(doc().sheets[Math.max(0, i - 1)].id)
    },
    renameSheet: (id, title) => mutateDoc(d => { const s = d.sheets.find(x => x.id === id); if (s) s.title = title }),
    moveSheet: (id, delta) => mutateDoc(d => {
      const i = d.sheets.findIndex(s => s.id === id), j = i + delta
      if (i < 0 || j < 0 || j >= d.sheets.length) return
      const [s] = d.sheets.splice(i, 1)
      d.sheets.splice(j, 0, s)
    }),
    indent: () => {
      const sheet = get().sheet()
      const id = primary()
      const l = sheet && id ? locate(sheet, id) : null
      if (!l || l.kind !== 'child' || l.index === 0) return
      get().move([id], l.siblings[l.index - 1].id, 'child')
      set({ selection: [id] })
    },
    outdent: () => {
      const sheet = get().sheet()
      const id = primary()
      const l = sheet && id ? locate(sheet, id) : null
      if (!l || l.kind !== 'child' || !l.parent || l.parent.id === sheet!.rootTopic.id) return
      get().move([id], l.parent.id, 'after')
      set({ selection: [id] })
    },
    addParent: () => {
      // как «Parent Topic»: новая тема встаёт на место выбранной, выбранная становится её подтемой
      const sheet = get().sheet()
      const id = primary()
      const l = sheet && id ? locate(sheet, id) : null
      if (!l || (l.kind !== 'child' && l.kind !== 'floating')) return
      const t = newTopic(l.kind === 'floating' ? 'Плавающая тема' : childTitle(sheet!, l.parent!.id))
      mutate(sh => {
        const loc = locate(sh, id)!
        const [moved] = loc.siblings.splice(loc.index, 1, t)
        if (loc.kind === 'floating') { t.position = moved.position; delete moved.position }
        t.children = [moved]
      })
      get().startEdit(t.id)
    },
    duplicate: () => {
      const sheet = get().sheet()
      if (!sheet) return
      const ids = topLevel(sheet, get().selection).filter(i => { const k = locate(sheet, i)?.kind; return k === 'child' || k === 'floating' })
      if (!ids.length) return
      const created: string[] = []
      mutate(sh => {
        for (const id of ids) {
          const l = locate(sh, id)!
          const c = cloneWithNewIds(structuredClone(l.topic) as Topic)
          if (l.kind === 'floating') c.position = { x: (l.topic.position?.x ?? 0) + 30, y: (l.topic.position?.y ?? 0) + 30 }
          l.siblings.splice(l.index + 1, 0, c)
          created.push(c.id)
        }
      })
      set({ selection: created })
    },
    deleteSingle: () => {
      // удалить только тему: её подтемы поднимаются на её место
      const sheet = get().sheet()
      const id = primary()
      const l = sheet && id ? locate(sheet, id) : null
      if (!l || (l.kind !== 'child' && l.kind !== 'floating')) return
      mutate(sh => {
        const loc = locate(sh, id)!
        const kids = (loc.topic.children ?? []).map(k => { const c = { ...k }; if (loc.kind === 'floating') c.position = { ...(loc.topic.position ?? { x: 0, y: 0 }) }; return c })
        loc.siblings.splice(loc.index, 1, ...kids)
      })
      set({ selection: [l.parent?.id ?? sheet!.rootTopic.id] })
    },
    foldAll: collapse => {
      // свернуть/развернуть все подветки выбранных тем (или всей карты)
      const sheet = get().sheet()
      if (!sheet) return
      const ids = get().selection.length ? get().selection : [sheet.rootTopic.id]
      const first = locate(sheet, ids[0])?.topic
      const target = collapse ?? !(first?.children ?? []).some(c => c.collapsed)
      mutate(sh => {
        const walk = (t: Topic, top: boolean) => {
          if (!top && t.children?.length) t.collapsed = target
          t.children?.forEach(c => walk(c, false))
        }
        for (const id of ids) { const t = locate(sh, id)?.topic; if (t) walk(t, true) }
      })
    },
    selectBy: kind => {
      const sheet = get().sheet()
      if (!sheet) return
      const idx = indexSheet(sheet)
      const sel = get().selection
      const out = new Set<string>()
      if (kind === 'floating') (sheet.floatingTopics ?? []).forEach(f => out.add(f.id))
      for (const id of sel) {
        const ref = idx.get(id)
        if (!ref) continue
        if (kind === 'subtopics') (ref.topic.children ?? []).forEach(c => out.add(c.id))
        if (kind === 'siblings') (ref.parent?.children ?? []).forEach(c => out.add(c.id))
        if (kind === 'level') for (const r of idx.values()) if (r.depth === ref.depth && r.isFloatingTree === ref.isFloatingTree && r.kind === ref.kind) out.add(r.topic.id)
      }
      if (out.size) set({ selection: [...out], element: null })
    },
    goCentral: () => { const sh = get().sheet(); if (sh) set({ selection: [sh.rootTopic.id], element: null }) },
    setViewMode: m => set({ viewMode: m, editingId: null }),
    setZen: z => set({ zen: z }),
    setPresenting: p => set({ presenting: p, editingId: null, relating: null }),
    drillDown: id => {
      const target = id ?? primary()
      const sheet = get().sheet()
      if (!target || !sheet) return
      const kind = indexSheet(sheet).get(target)?.kind
      if (kind === 'root') { set({ drillId: null }); return }
      set({ drillId: target, selection: [target], element: null })
    },
    drillUp: () => {
      const { drillId } = get()
      const sheet = get().sheet()
      if (!drillId || !sheet) return
      const parent = indexSheet(sheet).get(drillId)?.parent
      set({ drillId: parent && parent.id !== sheet.rootTopic.id ? parent.id : null, selection: [drillId] })
    },
    setFilter: f => set({ filter: f && (f.markers.length || f.labels.length) ? f : null }),
    setSearch: patch => {
      const cur = { ...get().search, ...patch }
      if (patch.query !== undefined) {
        const sheet = get().sheet()
        const q = cur.query.trim().toLowerCase()
        cur.hits = !q || !sheet ? [] : [...indexSheet(sheet).values()].filter(r => {
          const t = r.topic
          return t.title.toLowerCase().includes(q) || t.notes?.plain?.toLowerCase().includes(q)
            || t.labels?.some(l => l.toLowerCase().includes(q))
        }).map(r => r.topic.id)
        cur.index = 0
      }
      set({ search: cur })
      const hit = cur.hits[cur.index]
      if (cur.open && hit && (patch.query !== undefined || patch.index !== undefined)) {
        get().revealTopic(hit)
        set({ search: cur })
      }
    },
    replaceAll: (query, replacement) => {
      if (!query) return 0
      let n = 0
      const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      mutate(sh => {
        for (const ref of indexSheet(sh).values()) {
          const next = ref.topic.title.replace(re, () => { n++; return replacement })
          if (next !== ref.topic.title) ref.topic.title = next
        }
      })
      get().setSearch({ query })
      return n
    },
    revealTopic: id => {
      const d = doc()
      const sh = d.sheets.find(s => indexSheet(s).has(id))
      if (!sh) return false
      // разворачиваем свёрнутых предков
      const idx = indexSheet(sh)
      const collapsedAncestors: string[] = []
      let cur = idx.get(id)
      while (cur?.parent) { if (cur.parent.collapsed) collapsedAncestors.push(cur.parent.id); cur = idx.get(cur.parent.id) }
      if (sh.id !== get().sheetId) get().setSheetId(sh.id)
      if (collapsedAncestors.length) mutate(s2 => { for (const a of collapsedAncestors) locate(s2, a)!.topic.collapsed = false })
      set({ selection: [id], element: null })
      return true
    },
  }

  function keepValidSelection() {
    const sheet = get().sheet()
    if (!sheet) return
    const idx = indexSheet(sheet)
    const sel = get().selection.filter(id => idx.has(id))
    set({ selection: sel.length ? sel : [sheet.rootTopic.id] })
  }
})

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__mm = { useEditor, useDoc }
