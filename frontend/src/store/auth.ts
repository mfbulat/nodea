import { create } from 'zustand'
import { api } from '../api/client'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  loaded: boolean
  load: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>(set => ({
  user: null,
  loaded: false,
  load: async () => {
    try {
      set({ user: await api<User>('/api/auth/me'), loaded: true })
    } catch {
      try { set({ user: await api<User>('/api/auth/refresh', { method: 'POST' }), loaded: true }) }
      catch { set({ user: null, loaded: true }) }
    }
  },
  login: async (email, password) => set({ user: await api<User>('/api/auth/login', { method: 'POST', json: { email, password } }) }),
  register: async (email, password) => set({ user: await api<User>('/api/auth/register', { method: 'POST', json: { email, password } }) }),
  logout: async () => { await api('/api/auth/logout', { method: 'POST' }); set({ user: null }) },
}))
