import type { LucideIcon } from 'lucide-react'
import { FolderTreeIcon, GitBranchIcon, HistoryIcon, InfoIcon } from 'lucide-react'
import type * as React from 'react'

import type { RightView, TerminalSession, WorkspaceTab } from '@/lib/terminal/types'

import { FileTreePanel } from './file-tree-panel'
import { GitPanel } from './git-panel'
import { HistoryPanel } from './history-panel'
import { PathInfoPanel } from './path-info-panel'

export interface PanelContext {
  workspaceId: string
  workspacePath: string
  homeDir: string
  activeTab: WorkspaceTab | null
  activeSession: TerminalSession | null
  /** The path the path panel should operate on. */
  contextPath: string
  isGitRepo: boolean

  // Actions provided by the consumer so the registry stays isolated from store details.
  openFileTab: (filePath: string, opts?: { pinned?: boolean }) => Promise<WorkspaceTab>
  insertCommandIntoActiveTerminal: (command: string) => void
}

export type PanelScope = 'core' | 'contextual'

export interface PanelDefinition {
  id: RightView
  icon: LucideIcon
  labelKey: `infoPanel.tabs.${RightView}`
  scope: PanelScope
  isAvailable: (ctx: PanelContext) => boolean
  render: (ctx: PanelContext) => React.ReactNode
}

export const PANEL_REGISTRY: PanelDefinition[] = [
  {
    id: 'files',
    icon: FolderTreeIcon,
    labelKey: 'infoPanel.tabs.files',
    scope: 'core',
    isAvailable: () => true,
    render: (ctx) => (
      <FileTreePanel
        cwd={ctx.workspacePath}
        homeDir={ctx.homeDir}
        isGitRepo={ctx.isGitRepo}
        onOpenFile={(p) => void ctx.openFileTab(p)}
        onPinFile={(p) => void ctx.openFileTab(p, { pinned: true })}
      />
    ),
  },
  {
    id: 'path',
    icon: InfoIcon,
    labelKey: 'infoPanel.tabs.path',
    scope: 'core',
    isAvailable: () => true,
    render: (ctx) => <PathInfoPanel cwd={ctx.contextPath} />,
  },
  {
    id: 'git',
    icon: GitBranchIcon,
    labelKey: 'infoPanel.tabs.git',
    scope: 'contextual',
    isAvailable: (ctx) => ctx.isGitRepo,
    render: (ctx) => <GitPanel cwd={ctx.workspacePath} />,
  },
  {
    id: 'history',
    icon: HistoryIcon,
    labelKey: 'infoPanel.tabs.history',
    scope: 'contextual',
    isAvailable: (ctx) => ctx.activeTab?.type === 'terminal' && ctx.activeSession != null,
    render: (ctx) => {
      if (!ctx.activeSession) return null
      return (
        <HistoryPanel
          sessionId={ctx.activeSession.id}
          onInsertCommand={ctx.insertCommandIntoActiveTerminal}
        />
      )
    },
  },
]
