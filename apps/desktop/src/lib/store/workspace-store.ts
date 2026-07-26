import i18n from 'i18next'
import { toast } from 'sonner'
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
  updateTabRef as dbUpdateTabRef,
  updateWorkspaceTitle as dbUpdateWorkspaceTitle,
} from '@/lib/db/workspace-repo'
import { disposeFileEditor, saveFileEditor } from '@/lib/editor/editor-registry'
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
  dirtyTabs: Set<string>
  previewTabId: string | null

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
  openFileTab: (filePath: string, opts?: { pinned?: boolean }) => Promise<WorkspaceTab>
  closeTab: (tabId: string) => Promise<void>
  setActiveTab: (tabId: string) => void
  pinTab: (tabId: string) => void
  setTabDirty: (tabId: string, dirty: boolean) => void
  saveFileTab: (tabId: string) => Promise<void>
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
  dirtyTabs: new Set<string>(),
  previewTabId: null,

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
      previewTabId: null,
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
        ? {
            activeWorkspace: null,
            tabs: [],
            sessions: [],
            activeTabId: null,
            loaded: false,
            previewTabId: null,
          }
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

  openFileTab: async (filePath, opts) => {
    const ws = get().activeWorkspace
    if (!ws) throw new Error('No active workspace')

    const pinned = opts?.pinned ?? false
    const existing = get().tabs.find((t) => t.type === 'file' && t.ref === filePath)
    if (existing) {
      if (pinned && get().previewTabId === existing.id) {
        set({ previewTabId: null })
      }
      get().setActiveTab(existing.id)
      return existing
    }

    const previewTabId = get().previewTabId
    const previewTab = previewTabId ? get().tabs.find((t) => t.id === previewTabId) : undefined
    if (!pinned && previewTab?.type === 'file') {
      // Reuse preview slot.
      disposeFileEditor(previewTab.id)
      const title = basename(filePath)
      await dbUpdateTabRef(previewTab.id, filePath, title)
      const updated: WorkspaceTab = { ...previewTab, ref: filePath, title }
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === updated.id ? updated : t)),
        activeTabId: updated.id,
      }))
      return updated
    }

    if (pinned && previewTab?.type === 'file') {
      // Replace preview slot and pin it.
      disposeFileEditor(previewTab.id)
      const title = basename(filePath)
      await dbUpdateTabRef(previewTab.id, filePath, title)
      const updated: WorkspaceTab = { ...previewTab, ref: filePath, title }
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === updated.id ? updated : t)),
        activeTabId: updated.id,
        previewTabId: null,
      }))
      return updated
    }

    const tab = await dbCreateTab(ws.id, 'file', filePath, basename(filePath))
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      previewTabId: pinned ? state.previewTabId : tab.id,
    }))
    return tab
  },

  closeTab: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab) return

    if (tab.type === 'file' && get().dirtyTabs.has(tabId)) {
      const title = tab.title ?? tab.ref
      const { response } = await api.dialog.showMessageBox({
        type: 'warning',
        buttons: [
          i18n?.t('editor.save') ?? 'Save',
          i18n?.t('editor.dontSave') ?? "Don't Save",
          i18n?.t('editor.cancel') ?? 'Cancel',
        ],
        defaultId: 0,
        cancelId: 2,
        message:
          i18n?.t('editor.unsavedChangesMessage', { file: title }) ??
          `"${title}" has unsaved changes. Do you want to save them?`,
      })

      if (response === 2) return
      if (response === 0) {
        await get().saveFileTab(tabId)
      }
    }

    await dbDeleteTab(tabId)
    if (tab.type === 'terminal') {
      await destroyTerminalInstance(tab.ref)
      await dbDeleteSession(tab.ref)
    }
    if (tab.type === 'file') {
      disposeFileEditor(tabId)
    }
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== tabId)
      const sessions =
        tab.type === 'terminal' ? state.sessions.filter((s) => s.id !== tab.ref) : state.sessions
      const dirtyTabs = new Set(state.dirtyTabs)
      dirtyTabs.delete(tabId)
      const previewTabId = state.previewTabId === tabId ? null : state.previewTabId
      let activeTabId = state.activeTabId
      if (activeTabId === tabId) {
        const idx = state.tabs.findIndex((t) => t.id === tabId)
        activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null
      }
      return { tabs, sessions, dirtyTabs, activeTabId, previewTabId }
    })
  },

  setActiveTab: (tabId) => {
    const tab = useWorkspaceStore.getState().tabs.find((t) => t.id === tabId)
    if (tab) void dbTouchTab(tabId)
    set({ activeTabId: tabId })
  },

  pinTab: (tabId) => {
    set((state) => (state.previewTabId === tabId ? { previewTabId: null } : {}))
  },

  setTabDirty: (tabId, dirty) =>
    set((state) => {
      const dirtyTabs = new Set(state.dirtyTabs)
      if (dirty) dirtyTabs.add(tabId)
      else dirtyTabs.delete(tabId)
      // A dirty preview tab becomes pinned so it is not silently replaced.
      const isPreview = state.previewTabId === tabId
      if (dirty && isPreview) {
        return { dirtyTabs, previewTabId: null }
      }
      return { dirtyTabs }
    }),

  saveFileTab: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab || tab.type !== 'file') return
    await saveFileEditor(tabId, tab.ref)
    set((state) => {
      const dirtyTabs = new Set(state.dirtyTabs)
      dirtyTabs.delete(tabId)
      return { dirtyTabs }
    })
    toast.success(i18n?.t('editor.saved') ?? 'Saved')
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
