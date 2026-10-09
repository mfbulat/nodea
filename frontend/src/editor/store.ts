import { create } from 'zustand'
import { produce } from 'immer'
import { useDoc } from '../store/doc'
import type { MapDocument, Sheet, StructureId, Topic, TopicStyle } from './model'
import { cloneWithNewIds, indexSheet, isAncestor, uid } from './model'
import type { LayoutResult } from './layout'

const HISTORY_LIMIT = 200

export interface View { zoom: number; x: number; y: number }

interface Located { topic: Topic; siblings: Topic[]; index: number; parent: Topic | null; floating: boolean }

export function locate(sheet: Sheet, id: string): Located | null {
  if (sheet.rootTopic.id === id) return { topic: sheet.rootTopic, siblings: [], index: 0, parent: null, floating: false }
  const fl = sheet.floatingTopics ?? []
  const fi = fl.findIndex(f => f.id === id)
  if (fi >= 0) return { topic: fl[fi], siblings: fl, index: fi, parent: null, floating: true }
  const walk = (t: Topic): Located | null => {
    const ch = t.children ?? []
    for (let i = 0; i < ch.length; i++) {
      if (ch[i].id === id) return { topic: ch[i], siblings: ch, index: i, parent: t, floating: false }
      const r = walk(ch[i])
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
}

export const useEditor = create<EditorState>((set, get) => {
  const doc = () => useDoc.getState().doc!
  const current = (d: MapDocument) => d.sheets.find(s => s.id === get().sheetId) ?? d.sheets[0]
  const primary = () => { const s = get().selection; return s[s.length - 1] }
  const commit = (next: MapDocument) => {
    const prev = doc()
    if (next === prev) return
    set(st => ({ past: [...st.past.slice(-HISTORY_LIMIT + 1), prev], future: [] }))
    useDoc.getState().setDoc(next)
  }
  const mutate = (fn: (sheet: Sheet, d: MapDocument) => void) => commit(produce(doc(), d => fn(current(d), d)))
  const newTopic = (title: string): Topic => ({ id: uid(), title, children: [] })
  const childTitle = (sheet: Sheet, parentId: string) => sheet.rootTopic.id === parentId ? 'Основная тема' : 'Подтема'

  return {
    sheetId: null, selection: [], editingId: null, editSeed: null, past: [], future: [],
    view: { zoom: 1, x: 0, y: 0 }, clipboard: null, styleClipboard: null,

    reset: () => {
      const d = useDoc.getState().doc
      set({ sheetId: d?.sheets[0]?.id ?? null, selection: d ? [d.sheets[0].rootTopic.id] : [], editingId: null, past: [], future: [] })
    },
    sheet: () => { const d = useDoc.getState().doc; return d ? current(d) : null },
    mutate,
    setView: v => set(st => ({ view: { ...st.view, ...v } })),
    select: ids => set({ selection: ids }),
    toggleSelect: id => set(st => ({ selection: st.selection.includes(id) ? st.selection.filter(s => s !== id) : [...st.selection, id] })),
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
      if (!loc.parent && !loc.floating) return get().addChild()
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
        for (const id of ids) { const l = locate(sh, id); if (l) l.siblings.splice(l.index, 1) }
      })
      set({ selection: [next.id] })
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
      const moving = topLevel(sheet, ids).filter(id => id !== sheet.rootTopic.id && id !== targetId && !isAncestor(idx, id, targetId))
      if (!moving.length) return
      if (mode !== 'child' && targetId === sheet.rootTopic.id) mode = 'child'
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
      const moving = topLevel(sheet, ids).filter(id => id !== sheet.rootTopic.id)
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
    setPosition: (id, pos) => mutate(sh => { const l = locate(sh, id); if (l?.floating) l.topic.position = pos }),

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
      const { past } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      set(st => ({ past: st.past.slice(0, -1), future: [doc(), ...st.future], editingId: null }))
      useDoc.getState().setDoc(prev)
      keepValidSelection()
    },
    redo: () => {
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
