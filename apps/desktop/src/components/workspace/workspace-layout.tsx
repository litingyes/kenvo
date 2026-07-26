import { PanelLeftIcon, PanelRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/layout/app-header'
import { InfoPanel } from '@/components/terminal/info-panel'
import { TerminalView } from '@/components/terminal/terminal-view'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useWorkspaceStore } from '@/lib/store/workspace-store'

import { FileViewer } from './file-viewer'
import { WorkspaceSidebar } from './workspace-sidebar'
import { WorkspaceTabBar } from './workspace-tab-bar'

interface WorkspaceLayoutProps {
  homeDir: string
}

export function WorkspaceLayout({ homeDir }: WorkspaceLayoutProps) {
  const { t } = useTranslation()
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const leftOpen = useWorkspaceStore((s) => s.leftSidebarOpen)
  const rightOpen = useWorkspaceStore((s) => s.rightSidebarOpen)
  const toggleLeft = useWorkspaceStore((s) => s.toggleLeftSidebar)
  const toggleRight = useWorkspaceStore((s) => s.toggleRightSidebar)
  const tabs = useWorkspaceStore((s) => s.tabs)
  const sessions = useWorkspaceStore((s) => s.sessions)
  const activeTabId = useWorkspaceStore((s) => s.activeTabId)

  const workspacePath = activeWorkspace?.path ?? ''

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <AppHeader
        leftContent={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleLeft}
              aria-label={t('terminal.leftSidebar')}
            >
              <PanelLeftIcon className="size-3.5" />
            </Button>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xs font-medium text-foreground">
                {activeWorkspace?.title ?? ''}
              </span>
            </div>
          </div>
        }
        rightContent={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleRight}
            aria-label={t('terminal.rightSidebar')}
          >
            <PanelRightIcon className="size-3.5" />
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          {leftOpen && (
            <>
              <ResizablePanel defaultSize="20%" minSize="15%" maxSize="40%">
                <WorkspaceSidebar />
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}
          <ResizablePanel defaultSize={leftOpen ? '60%' : '80%'} minSize="30%">
            <div className="flex h-full flex-col">
              <WorkspaceTabBar />
              <div className="relative min-h-0 flex-1">
                {tabs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <p className="text-xs">{t('workspace.noTabs')}</p>
                    <NewTerminalButton />
                  </div>
                ) : (
                  tabs.map((tab) => {
                    const active = tab.id === activeTabId
                    if (tab.type === 'terminal') {
                      const session = sessions.find((s) => s.id === tab.ref)
                      if (!session) return null
                      return (
                        <div key={tab.id} className={active ? 'absolute inset-0' : 'hidden'}>
                          <TerminalView
                            sessionId={session.id}
                            initialCwd={session.cwd}
                            active={active}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={tab.id} className={active ? 'absolute inset-0' : 'hidden'}>
                        <FileViewer key={tab.ref} filePath={tab.ref} tabId={tab.id} />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </ResizablePanel>
          {rightOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize="20%" minSize="15%" maxSize="40%">
                <InfoPanel
                  workspaceId={activeWorkspace?.id ?? ''}
                  workspacePath={workspacePath}
                  homeDir={homeDir}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

function NewTerminalButton() {
  const { t } = useTranslation()
  const openTerminalTab = useWorkspaceStore((s) => s.openTerminalTab)
  return (
    <Button variant="outline" size="sm" onClick={() => void openTerminalTab()}>
      {t('terminal.newSession')}
    </Button>
  )
}
