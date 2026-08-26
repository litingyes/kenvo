import { create } from 'zustand'

import type { Project, ProjectTab } from '@/lib/db/project-repo'
import { closeTab, listTabs, openTab } from '@/lib/db/project-repo'

interface ProjectState {
  project: Project | null
  tabs: ProjectTab[]
  activeTabId: string | null
  leftSidebarOpen: boolean
  /** Whether the editor drawer is visible (slides over the chat view). */
  editorOpen: boolean
  /** Bump to force the project file tree to reload (e.g. agent file activity). */
  treeVersion: number

  hydrate: (project: Project, tabs: ProjectTab[]) => void
  openFile: (filePath: string) => Promise<void>
  closeFile: (tabId: string) => Promise<void>
  activateTab: (tabId: string) => void
  reloadTabs: () => Promise<void>
  toggleLeftSidebar: () => void
  toggleEditor: () => void
  setEditorOpen: (open: boolean) => void
  bumpTree: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  tabs: [],
  activeTabId: null,
  leftSidebarOpen: true,
  editorOpen: false,
  treeVersion: 0,

  hydrate: (project, tabs) => {
    set({
      project,
      tabs,
      activeTabId: tabs.length > 0 ? (get().activeTabId ?? tabs[tabs.length - 1].id) : null,
      // The editor drawer starts closed so the chat view owns the screen.
      editorOpen: false,
    })
  },

  openFile: async (filePath) => {
    const project = get().project
    if (!project) return
    const tab = await openTab(project.id, filePath)
    const tabs = await listTabs(project.id)
    set({ tabs, activeTabId: tab.id, editorOpen: true })
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
      // No open documents left: close the drawer.
      editorOpen: tabs.length > 0 ? get().editorOpen : false,
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
  toggleEditor: () => set((s) => ({ editorOpen: !s.editorOpen })),
  setEditorOpen: (open) => set({ editorOpen: open }),
  bumpTree: () => set((s) => ({ treeVersion: s.treeVersion + 1 })),
}))
