import { create } from 'zustand'

import type { Project, ProjectTab } from '@/lib/db/project-repo'
import { closeTab, listTabs, openTab } from '@/lib/db/project-repo'

interface ProjectState {
  project: Project | null
  tabs: ProjectTab[]
  activeTabId: string | null
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean

  hydrate: (project: Project, tabs: ProjectTab[]) => void
  openFile: (filePath: string) => Promise<void>
  closeFile: (tabId: string) => Promise<void>
  activateTab: (tabId: string) => void
  reloadTabs: () => Promise<void>
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,
  leftSidebarOpen: true,
  rightSidebarOpen: true,

  hydrate: (project, tabs) => {
    set({
      project,
      tabs,
      activeTabId: tabs.length > 0 ? (get().activeTabId ?? tabs[tabs.length - 1].id) : null,
    })
  },

  openFile: async (filePath) => {
    const project = get().project
    if (!project) return
    const tab = await openTab(project.id, filePath)
    const tabs = await listTabs(project.id)
    set({ tabs, activeTabId: tab.id })
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

  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
}))
