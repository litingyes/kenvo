import { create } from 'zustand'

import {
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  listSessions,
  updateCwd as dbUpdateCwd,
} from '@/lib/db/terminal-repo'
import type { GroupMode, RightView, TerminalSession } from '@/lib/terminal/types'

interface TerminalStore {
  sessions: TerminalSession[]
  activeId: string | null
  groupMode: GroupMode
  rightView: RightView
  loaded: boolean

  loadSessions: () => Promise<void>
  createSession: (cwd?: string, title?: string) => Promise<TerminalSession>
  closeSession: (id: string) => Promise<void>
  setActive: (id: string) => void
  setGroupMode: (mode: GroupMode) => void
  setRightView: (view: RightView) => void
  updateSessionCwd: (id: string, cwd: string) => Promise<void>
  refreshSessions: () => Promise<void>
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeId: null,
  groupMode: 'time',
  rightView: 'path',
  loaded: false,

  loadSessions: async () => {
    const sessions = await listSessions()
    set({ sessions, loaded: true })
  },

  createSession: async (cwd, title) => {
    const session = await dbCreateSession(cwd ?? '/', title)
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeId: session.id,
    }))
    return session
  },

  closeSession: async (id) => {
    await dbDeleteSession(id)
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const activeId = state.activeId === id ? (sessions[0]?.id ?? null) : state.activeId
      return { sessions, activeId }
    })
  },

  setActive: (id) => {
    set({ activeId: id })
  },

  setGroupMode: (mode) => {
    set({ groupMode: mode })
  },

  setRightView: (view) => {
    set({ rightView: view })
  },

  updateSessionCwd: async (id, cwd) => {
    await dbUpdateCwd(id, cwd)
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, cwd } : s)),
    }))
  },

  refreshSessions: async () => {
    const sessions = await listSessions()
    set({ sessions })
  },
}))
