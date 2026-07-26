import { FileIcon, SquareTerminalIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useWorkspaceStore } from '@/lib/store/workspace-store'
import type { WorkspaceTab } from '@/lib/terminal/types'
import { cn } from '@/lib/utils'

export function WorkspaceTabBar() {
  const { t } = useTranslation()
  const tabs = useWorkspaceStore((s) => s.tabs)
  const sessions = useWorkspaceStore((s) => s.sessions)
  const activeTabId = useWorkspaceStore((s) => s.activeTabId)
  const dirtyTabs = useWorkspaceStore((s) => s.dirtyTabs)
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab)
  const closeTab = useWorkspaceStore((s) => s.closeTab)
  const openTerminalTab = useWorkspaceStore((s) => s.openTerminalTab)

  const titleFor = React.useCallback(
    (tab: WorkspaceTab): string => {
      if (tab.title) return tab.title
      if (tab.type === 'terminal') {
        const session = sessions.find((s) => s.id === tab.ref)
        if (session?.title) return session.title
        return basename(session?.cwd ?? 'terminal')
      }
      return basename(tab.ref)
    },
    [sessions],
  )

  return (
    <div className="flex items-center gap-0.5 border-b border-border bg-background pr-1 pl-1">
      <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={cn(
                'group flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex min-w-0 items-center gap-1.5"
              >
                {tab.type === 'terminal' ? (
                  <SquareTerminalIcon className="size-3.5 shrink-0" />
                ) : (
                  <FileIcon className="size-3.5 shrink-0" />
                )}
                <span className="max-w-40 truncate">{titleFor(tab)}</span>
                {dirtyTabs.has(tab.id) && (
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void closeTab(tab.id)}
                className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                aria-label={t('terminal.closeSession')}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          )
        })}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={() => void openTerminalTab()}
        aria-label={t('terminal.newSession')}
      >
        <SquareTerminalIcon className="size-3.5" />
      </Button>
    </div>
  )
}

function basename(p: string): string {
  if (!p || p === '/') return '/'
  const parts = p.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || p
}
