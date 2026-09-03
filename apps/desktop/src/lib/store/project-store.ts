import { create } from 'zustand'

import type { Project } from '@/lib/db/project-repo'

/** How the project launcher sorts projects. */
export type ProjectListSort = 'recent' | 'name'

interface ProjectState {
  project: Project | null
  leftSidebarOpen: boolean
  projectListSort: ProjectListSort
  hydrate: (project: Project) => void
  toggleLeftSidebar: () => void
  setProjectListSort: (sort: ProjectListSort) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  leftSidebarOpen: true,
  projectListSort: 'recent',
  hydrate: (project) => set({ project }),
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  setProjectListSort: (sort) => set({ projectListSort: sort }),
}))
