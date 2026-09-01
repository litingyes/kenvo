import { create } from 'zustand'

import type { Project, ProjectTab } from '@/lib/db/project-repo'
import { closeTab, listTabs, openTab, updateTabFilePath } from '@/lib/db/project-repo'

/** How the project launcher sorts projects. */
export type SessionListSort = 'recent' | 'name'

interface ProjectState {
  project: Project | null
  tabs: ProjectTab[]
  activeTabId: string | null
  leftSidebarOpen: boolean
  /** Whether the right-side feature panel (Files) is visible. */
  rightPanelOpen: boolean
  /** Sidebar project/session ordering: by recent activity or by name. */
  sessionListSort: SessionListSort
  /** Bump to force the project file tree to reload (e.g. agent file activity). */
  treeVersion: number

  hydrate: (project: Project, tabs: ProjectTab[]) => void
  openFile: (filePath: string) => Promise<void>
  closeFile: (tabId: string) => Promise<void>
  activateTab: (tabId: string) => void
  reloadTabs: () => Promise<void>
  remapFilePath: (fromPath: string, toPath: string) => Promise<void>
  toggleLeftSidebar: () => void
  toggleRightPanel: () => void
  setRightPanelOpen: (open: boolean) => void
  setSessionListSort: (sort: SessionListSort) => void
  bumpTree: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,
  leftSidebarOpen: true,
  rightPanelOpen: false,
  sessionListSort: 'recent',
  treeVersion: 0,

  hydrate: (project, tabs) => {
    const current = get().activeTabId
    const stillThere = current !== null && tabs.some((t) => t.id === current)
    set({
      project,
      tabs,
      activeTabId: tabs.length > 0 ? (stillThere ? current : tabs[tabs.length - 1].id) : null,
    })
  },

  openFile: async (filePath) => {
    const project = get().project
    if (!project) return
    const tab = await openTab(project.id, filePath)
    const tabs = await listTabs(project.id)
    set({ tabs, activeTabId: tab.id, rightPanelOpen: true })
  },

  closeFile: async (tabId) => {
    const project = get().project
    if (!project) return
    await closeTab(tabId)
    const tabs = await listTabs(project.id)
    const { activeTabId } = get()
    set({
      tabs,
      activeTabId:
        activeTabId === tabId ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null) : activeTabId,
    })
  },

  activateTab: (tabId) => set({ activeTabId: tabId }),

  reloadTabs: async () => {
    const project = get().project
    if (!project) return
    const tabs = await listTabs(project.id)
    set({ tabs })
  },

  remapFilePath: async (fromPath, toPath) => {
    const project = get().project
    if (!project) return
    await updateTabFilePath(project.id, fromPath, toPath)
    const tabs = await listTabs(project.id)
    set({ tabs })
  },

  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setSessionListSort: (sort) => set({ sessionListSort: sort }),
  bumpTree: () => set((s) => ({ treeVersion: s.treeVersion + 1 })),
}))
