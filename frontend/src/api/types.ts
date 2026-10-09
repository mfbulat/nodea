import type { MapDocument } from '../editor/model'
export type { MapDocument, Sheet, Topic } from '../editor/model'

export interface User { id: string; email: string }
export interface MapSummary { id: string; title: string; created_at: string; updated_at: string }
export interface MapFull extends MapSummary { document: MapDocument; revision: number }
export interface VersionSummary { id: string; title: string; created_at: string }
