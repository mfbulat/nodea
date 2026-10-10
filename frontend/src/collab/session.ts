// Сессия совместного редактирования: WebSocket-провайдер Yjs, синхронизация
// документа с хранилищем редактора, отмена только своих правок, присутствие.
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { create } from 'zustand'
import type { MapDocument } from '../editor/model'
import { applyFlat, Flat, flatten, roots, toDocument } from './ydoc'

export interface Peer {
  clientId: number
  name: string
  color: string
  sheetId?: string
  cursor?: { x: number; y: number } | null
  selection?: string[]
}

interface CollabState {
  status: 'off' | 'connecting' | 'online' | 'offline'
  synced: boolean
  peers: Peer[]
  canUndo: boolean
  canRedo: boolean
}

export const useCollab = create<CollabState>(() => ({ status: 'off', synced: false, peers: [], canUndo: false, canRedo: false }))

const COLORS = ['#e5484d', '#f76b15', '#30a46c', '#0090ff', '#8e4ec6', '#d6409f', '#12a594', '#ad7f58']
const LOCAL = 'local'

export class CollabSession {
  ydoc = new Y.Doc()
  provider: WebsocketProvider
  undo: Y.UndoManager
  private flat: Flat | null = null
  private onRemote: (doc: MapDocument) => void

  constructor(mapId: string, share: string | null, user: string, onRemote: (doc: MapDocument) => void) {
    this.onRemote = onRemote
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const params: Record<string, string> = share ? { share } : {}
    this.provider = new WebsocketProvider(`${proto}://${location.host}/api/collab`, mapId, this.ydoc, { params })
    const { nodes, sheets, order } = roots(this.ydoc)
    this.undo = new Y.UndoManager([nodes, sheets, order], { trackedOrigins: new Set([LOCAL]), captureTimeout: 0 })
    const refreshUndo = () => useCollab.setState({ canUndo: this.undo.canUndo(), canRedo: this.undo.canRedo() })
    this.undo.on('stack-item-added', refreshUndo)
    this.undo.on('stack-item-popped', refreshUndo)
    this.undo.on('stack-cleared', refreshUndo)

    useCollab.setState({ status: 'connecting', synced: false, peers: [], canUndo: false, canRedo: false })
    this.provider.on('status', ({ status }: { status: string }) =>
      useCollab.setState({ status: status === 'connected' ? 'online' : status === 'connecting' ? 'connecting' : 'offline' }))
    this.provider.on('sync', (synced: boolean) => {
      if (!synced || useCollab.getState().synced) return
      useCollab.setState({ synced: true })
      this.pullRemote()
    })
    this.ydoc.on('update', (_u: Uint8Array, origin: unknown) => {
      if (origin !== LOCAL && useCollab.getState().synced) this.pullRemote()
    })

    const aw = this.provider.awareness
    const color = COLORS[this.ydoc.clientID % COLORS.length]
    aw.setLocalStateField('user', { name: user || 'Guest', color })
    aw.on('change', () => {
      const peers: Peer[] = []
      aw.getStates().forEach((st, clientId) => {
        if (clientId === this.ydoc.clientID || !st.user) return
        peers.push({ clientId, name: st.user.name, color: st.user.color, sheetId: st.sheetId, cursor: st.cursor, selection: st.selection })
      })
      useCollab.setState({ peers })
    })
  }

  private pullRemote() {
    const doc = toDocument(this.ydoc)
    if (!doc.sheets.length) return
    this.flat = flatten(doc)
    this.onRemote(doc)
  }

  /** Локальная правка документа → Y.Doc */
  push(doc: MapDocument) {
    if (!useCollab.getState().synced) return
    const next = flatten(doc)
    applyFlat(this.ydoc, this.flat, next, LOCAL)
    this.flat = next
  }

  setPresence(patch: Partial<Pick<Peer, 'sheetId' | 'cursor' | 'selection'>>) {
    const aw = this.provider.awareness
    for (const [k, v] of Object.entries(patch)) aw.setLocalStateField(k, v)
  }

  destroy() {
    this.provider.awareness.setLocalState(null)
    this.provider.destroy()
    this.ydoc.destroy()
    useCollab.setState({ status: 'off', synced: false, peers: [] })
  }
}

let current: CollabSession | null = null
export const collab = () => current
export function startCollab(mapId: string, share: string | null, user: string, onRemote: (d: MapDocument) => void) {
  current?.destroy()
  current = new CollabSession(mapId, share, user, onRemote)
  return current
}
export function stopCollab() {
  current?.destroy()
  current = null
}
