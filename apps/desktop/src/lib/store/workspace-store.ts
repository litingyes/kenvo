import { create } from 'zustand'

import {
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  duplicateSession as dbDuplicateSession,
  listSessionsByWorkspace,
  renameSession as dbRenameSession,
  updateCwd as dbUpdateCwd,
} from '@/lib/db/terminal-repo'
import {
  createTab as dbCreateTab,
  deleteTab as dbDeleteTab,
  deleteWorkspace as dbDeleteWorkspace,
  findOrCreateWorkspaceByPath,
  listWorkspaces as dbListWorkspaces,
  touchTab as dbTouchTab,
  touchWorkspace as dbTouchWorkspace,
  updateWorkspaceTitle as dbUpdateWorkspaceTitle,
} from '@/lib/db/workspace-repo'
import { api } from '@/lib/electron/api'
import {
  destroyTerminalInstance,
  insertCommandIntoTerminal,
} from '@/lib/terminal/terminal-instance-registry'
import type {
  EditorApp,
  GroupMode,
  RightView,
  SortMode,
  TerminalSession,
  Workspace,
  WorkspaceTab,
} from '@/lib/terminal/types'

function basename(p: string): string {
  if (!p || p === '/') return '/'
  const parts = p.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || p
}

function pickActiveTabId(tabs: WorkspaceTab[]): string | null {
  if (tabs.length === 0) return null
  let best = tabs[0]!
  for (const t of tabs) {
    if (t.last_active_at > best.last_active_at) best = t
  }
  return best.id
}

interface WorkspaceStore {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  tabs: WorkspaceTab[]
  sessions: TerminalSession[]
  activeTabId: string | null
  loaded: boolean

  groupMode: GroupMode
  sortMode: SortMode
  rightView: RightView
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  historyVersion: number
  availableEditors: EditorApp[] | null

  loadWorkspaces: () => Promise<void>
  hydrate: (data: {
    workspace: Workspace
    tabs: WorkspaceTab[]
    sessions: TerminalSession[]
  }) => void
  addWorkspaceByPath: (folderPath: string) => Promise<Workspace>
  addWorkspaceViaDialog: () => Promise<Workspace | null>
  removeWorkspace: (id: string) => Promise<void>
  renameWorkspace: (id: string, title: string) => Promise<void>
  touchActiveWorkspace: () => Promise<void>

  openTerminalTab: (cwd?: string) => Promise<WorkspaceTab>
  openTerminalTabForSession: (sessionId: string) => Promise<WorkspaceTab>
  openFileTab: (filePath: string) => Promise<WorkspaceTab>
  closeTab: (tabId: string) => Promise<void>
  setActiveTab: (tabId: string) => void
  insertCommandIntoActiveTerminal: (command: string) => void

  updateSessionCwd: (id: string, cwd: string) => Promise<void>
  refreshSessions: () => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  duplicateSession: (id: string) => Promise<TerminalSession | null>
  closeSession: (id: string) => Promise<void>

  setGroupMode: (mode: GroupMode) => void
  setSortMode: (mode: SortMode) => void
  setRightView: (view: RightView) => void
  setLeftSidebarOpen: (open: boolean) => void
  setRightSidebarOpen: (open: boolean) => void
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  bumpHistory: () => void
  detectAvailableEditors: () => Promise<EditorApp[]>
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  tabs: [],
  sessions: [],
  activeTabId: null,
  loaded: false,

  groupMode: 'time',
  sortMode: 'updated',
  rightView: 'files',
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  historyVersion: 0,
  availableEditors: null,

  loadWorkspaces: async () => {
    const workspaces = await dbListWorkspaces()
    set({ workspaces })
  },

  hydrate: (data) => {
    const activeTabId = pickActiveTabId(data.tabs)
    set({
      activeWorkspace: data.workspace,
      tabs: data.tabs,
      sessions: data.sessions,
      activeTabId,
      loaded: true,
    })
  },

  addWorkspaceByPath: async (folderPath) => {
    const workspace = await findOrCreateWorkspaceByPath(folderPath)
    set((state) => ({
      workspaces: state.workspaces.some((w) => w.id === workspace.id)
        ? state.workspaces
        : [workspace, ...state.workspaces],
    }))
    return workspace
  },

  addWorkspaceViaDialog: async () => {
    const res = await api.dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths.length) return null
    return get().addWorkspaceByPath(res.filePaths[0]!)
  },

  removeWorkspace: async (id) => {
    await dbDeleteWorkspace(id)
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      ...(state.activeWorkspace?.id === id
        ? { activeWorkspace: null, tabs: [], sessions: [], activeTabId: null, loaded: false }
        : {}),
    }))
  },

  renameWorkspace: async (id, title) => {
    await dbUpdateWorkspaceTitle(id, title)
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, title } : w)),
      activeWorkspace:
        state.activeWorkspace?.id === id
          ? { ...state.activeWorkspace, title }
          : state.activeWorkspace,
    }))
  },

  touchActiveWorkspace: async () => {
    const ws = get().activeWorkspace
    if (!ws) return
    await dbTouchWorkspace(ws.id)
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === ws.id ? { ...w, last_active_at: Date.now() } : w,
      ),
    }))
  },

  openTerminalTab: async (cwd) => {
    const ws = get().activeWorkspace
    if (!ws) throw new Error('No active workspace')
    const session = await dbCreateSession(cwd ?? ws.path)
    const tab = await dbCreateTab(
      ws.id,
      'terminal',
      session.id,
      session.title ?? basename(session.cwd),
    )
    set((state) => ({
      sessions: [session, ...state.sessions],
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }))
    await get().touchActiveWorkspace()
    return tab
  },

  openTerminalTabForSession: async (sessionId) => {
    const ws = get().activeWorkspace
    if (!ws) throw new Error('No active workspace')
    const session = get().sessions.find((s) => s.id === sessionId)
    const tab = await dbCreateTab(
      ws.id,
      'terminal',
      sessionId,
      session?.title ?? session?.cwd ?? '',
    )
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
    return tab
  },

  openFileTab: async (filePath) => {
    const ws = get().activeWorkspace
    if (!ws) throw new Error('No active workspace')
    const existing = get().tabs.find((t) => t.type === 'file' && t.ref === filePath)
    if (existing) {
      get().setActiveTab(existing.id)
      return existing
    }
    const tab = await dbCreateTab(ws.id, 'file', filePath, basename(filePath))
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
    return tab
  },

  closeTab: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab) return
    await dbDeleteTab(tabId)
    if (tab.type === 'terminal') {
      await destroyTerminalInstance(tab.ref)
      await dbDeleteSession(tab.ref)
    }
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== tabId)
      const sessions =
        tab.type === 'terminal' ? state.sessions.filter((s) => s.id !== tab.ref) : state.sessions
      let activeTabId = state.activeTabId
      if (activeTabId === tabId) {
        const idx = state.tabs.findIndex((t) => t.id === tabId)
        activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null
      }
      return { tabs, sessions, activeTabId }
    })
  },

  setActiveTab: (tabId) => {
    const tab = useWorkspaceStore.getState().tabs.find((t) => t.id === tabId)
    if (tab) void dbTouchTab(tabId)
    set({ activeTabId: tabId })
  },

  insertCommandIntoActiveTerminal: (command) => {
    const { tabs, activeTabId } = get()
    const tab = tabs.find((t) => t.id === activeTabId && t.type === 'terminal')
    if (tab) insertCommandIntoTerminal(tab.ref, command)
  },

  updateSessionCwd: async (id, cwd) => {
    await dbUpdateCwd(id, cwd)
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, cwd } : s)),
    }))
  },

  refreshSessions: async () => {
    const ws = get().activeWorkspace
    if (!ws) return
    const sessions = await listSessionsByWorkspace(ws.id)
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
    set((state) => ({ sessions: [dup, ...state.sessions] }))
    return dup
  },

  closeSession: async (id) => {
    const tabs = get().tabs.filter((t) => t.type === 'terminal' && t.ref === id)
    for (const t of tabs) await get().closeTab(t.id)
  },

  setGroupMode: (mode) => set({ groupMode: mode }),
  setSortMode: (mode) => set({ sortMode: mode }),
  setRightView: (view) => set({ rightView: view }),
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

export function getActiveTerminalSession(state: WorkspaceStore): TerminalSession | null {
  if (!state.activeTabId) return null
  const tab = state.tabs.find((t) => t.id === state.activeTabId && t.type === 'terminal')
  if (!tab) return null
  return state.sessions.find((s) => s.id === tab.ref) ?? null
}

export { basename as workspaceBasename }
