import { create } from 'zustand'
import { api, ApiError } from '../api/client'
import type { MapDocument, MapFull } from '../api/types'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

interface DocState {
  mapId: string | null
  title: string
  doc: MapDocument | null
  revision: number
  saveState: SaveState
  saveError: string
  open: (m: MapFull) => void
  close: () => void
  setDoc: (doc: MapDocument) => void
  setTitle: (title: string) => void
  flush: () => Promise<void>
}

const SAVE_DELAY = 800
let timer: ReturnType<typeof setTimeout> | null = null
let pendingDoc = false
let pendingTitle = false

export const useDoc = create<DocState>((set, get) => {
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { get().flush() }, SAVE_DELAY)
  }
  return {
    mapId: null, title: '', doc: null, revision: 0, saveState: 'saved', saveError: '',
    open: m => {
      pendingDoc = pendingTitle = false
      set({ mapId: m.id, title: m.title, doc: m.document, revision: m.revision, saveState: 'saved', saveError: '' })
    },
    close: () => set({ mapId: null, doc: null }),
    setDoc: doc => { pendingDoc = true; set({ doc, saveState: 'dirty' }); schedule() },
    setTitle: title => { pendingTitle = true; set({ title, saveState: 'dirty' }); schedule() },
    flush: async () => {
      if (timer) { clearTimeout(timer); timer = null }
      const { mapId, doc, title, revision, saveState } = get()
      if (!mapId || (!pendingDoc && !pendingTitle) || saveState === 'saving' || saveState === 'conflict') return
      const body: Record<string, unknown> = {}
      if (pendingTitle) body.title = title
      if (pendingDoc) { body.document = doc; body.base_revision = revision }
      pendingDoc = pendingTitle = false
      set({ saveState: 'saving' })
      try {
        const m = await api<MapFull>(`/api/maps/${mapId}`, { method: 'PATCH', json: body })
        if (get().mapId !== mapId) return
        const dirty = pendingDoc || pendingTitle
        set({ revision: m.revision, saveState: dirty ? 'dirty' : 'saved', saveError: '' })
        if (dirty) schedule()
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          set({ saveState: 'conflict', saveError: e.message })
        } else {
          if (body.title !== undefined) pendingTitle = true
          if (body.document !== undefined) pendingDoc = true
          set({ saveState: 'error', saveError: (e as Error).message })
          timer = setTimeout(() => { get().flush() }, 3000)
        }
      }
    },
  }
})

export const hasPendingChanges = () => pendingDoc || pendingTitle
