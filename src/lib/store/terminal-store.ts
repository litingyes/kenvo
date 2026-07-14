import { create } from 'zustand'

import {
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  duplicateSession as dbDuplicateSession,
  listSessions,
  renameSession as dbRenameSession,
  updateCwd as dbUpdateCwd,
} from '@/lib/db/terminal-repo'
import type {
  EditorApp,
  GroupMode,
  RightView,
  SortMode,
  TerminalSession,
} from '@/lib/terminal/types'

interface TerminalStore {
  sessions: TerminalSession[]
  activeId: string | null
  groupMode: GroupMode
  sortMode: SortMode
  rightView: RightView
  loaded: boolean
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  historyVersion: number
  availableEditors: EditorApp[] | null

  loadSessions: () => Promise<void>
  createSession: (cwd?: string, title?: string) => Promise<TerminalSession>
  closeSession: (id: string) => Promise<void>
  setActive: (id: string) => void
  setGroupMode: (mode: GroupMode) => void
  setSortMode: (mode: SortMode) => void
  setRightView: (view: RightView) => void
  updateSessionCwd: (id: string, cwd: string) => Promise<void>
  refreshSessions: () => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  duplicateSession: (id: string) => Promise<TerminalSession | null>
  setLeftSidebarOpen: (open: boolean) => void
  setRightSidebarOpen: (open: boolean) => void
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  bumpHistory: () => void
  detectAvailableEditors: () => Promise<EditorApp[]>
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: [],
  activeId: null,
  groupMode: 'time',
  sortMode: 'updated',
  rightView: 'path',
  loaded: false,
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  historyVersion: 0,
  availableEditors: null,

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

  setSortMode: (mode) => {
    set({ sortMode: mode })
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

  renameSession: async (id, title) => {
    await dbRenameSession(id, title)
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
    }))
  },

  duplicateSession: async (id) => {
    const dup = await dbDuplicateSession(id)
    if (!dup) return null
    set((state) => ({ sessions: [dup, ...state.sessions], activeId: dup.id }))
    return dup
  },

  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),

  bumpHistory: () => set((s) => ({ historyVersion: s.historyVersion + 1 })),

  detectAvailableEditors: async () => {
    if (get().availableEditors) return get().availableEditors!
    const { detectAvailableEditors: detect } = await import('@/lib/terminal/open-with')
    const found = await detect()
    set({ availableEditors: found })
    return found
  },
}))

export function sortSessions(sessions: TerminalSession[], mode: SortMode): TerminalSession[] {
  const sorted = [...sessions]
  if (mode === 'created') {
    sorted.sort((a, b) => b.created_at - a.created_at)
  } else {
    sorted.sort((a, b) => b.last_active_at - a.last_active_at)
  }
  return sorted
}

export function getActiveSession(): TerminalSession | null {
  const s = useTerminalStore.getState()
  return s.sessions.find((x) => x.id === s.activeId) ?? null
}
