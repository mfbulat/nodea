export interface User { id: string; email: string }
export interface MapSummary { id: string; title: string; created_at: string; updated_at: string }
export interface MapFull extends MapSummary { document: MapDocument; revision: number }
export interface VersionSummary { id: string; title: string; created_at: string }

export interface Topic { id: string; title: string; children?: Topic[]; [k: string]: unknown }
export interface Sheet { id: string; title: string; rootTopic: Topic; [k: string]: unknown }
export interface MapDocument { version: number; sheets: Sheet[] }
