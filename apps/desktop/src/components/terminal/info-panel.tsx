import type { TFunction } from 'i18next'
import { PanelRightCloseIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkspaceStore } from '@/lib/store/workspace-store'
import { getActiveTerminalSession } from '@/lib/store/workspace-store'
import type { RightView } from '@/lib/terminal/types'
import { cn } from '@/lib/utils'

import { PANEL_REGISTRY, type PanelDefinition } from './panels/panel-registry'

interface InfoPanelProps {
  workspaceId: string
  workspacePath: string
  homeDir: string
}

export function InfoPanel({ workspaceId, workspacePath, homeDir }: InfoPanelProps) {
  const { t } = useTranslation()
  const rightView = useWorkspaceStore((s) => s.rightView)
  const setRightView = useWorkspaceStore((s) => s.setRightView)
  const toggleRightSidebar = useWorkspaceStore((s) => s.toggleRightSidebar)
  const openFileTab = useWorkspaceStore((s) => s.openFileTab)
  const insertCommandIntoActiveTerminal = useWorkspaceStore(
    (s) => s.insertCommandIntoActiveTerminal,
  )
  const tabs = useWorkspaceStore((s) => s.tabs)
  const activeTabId = useWorkspaceStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activeSession = useWorkspaceStore(getActiveTerminalSession)
  const isGitRepo = useWorkspaceStore((s) => s.isGitRepo)

  const contextPath = React.useMemo(() => {
    if (activeTab?.type === 'terminal') {
      return activeSession?.cwd ?? workspacePath
    }
    if (activeTab?.type === 'file') {
      return activeTab.ref
    }
    return workspacePath
  }, [activeTab, activeSession, workspacePath])

  const context = React.useMemo(
    () => ({
      workspaceId,
      workspacePath,
      homeDir,
      activeTab,
      activeSession,
      contextPath,
      isGitRepo: isGitRepo ?? false,
      openFileTab,
      insertCommandIntoActiveTerminal,
    }),
    [
      workspaceId,
      workspacePath,
      homeDir,
      activeTab,
      activeSession,
      contextPath,
      isGitRepo,
      openFileTab,
      insertCommandIntoActiveTerminal,
    ],
  )

  const availablePanels = React.useMemo(
    () => PANEL_REGISTRY.filter((p) => p.isAvailable(context)),
    [context],
  )

  const effectiveView = React.useMemo<RightView>(() => {
    if (availablePanels.some((p) => p.id === rightView)) return rightView
    return availablePanels[0]?.id ?? 'files'
  }, [availablePanels, rightView])

  const activePanel = availablePanels.find((p) => p.id === effectiveView) ?? availablePanels[0]

  const handleSelectView = React.useCallback((id: RightView) => setRightView(id), [setRightView])

  return (
    <TooltipProvider delay={400}>
      <div className="flex h-full flex-row-reverse border-l border-border">
        {/* Vertical icon rail on the outer edge. */}
        <div className="flex w-9 flex-col items-center gap-0.5 border-l border-border bg-muted/30 py-1">
          <RailGroups
            panels={availablePanels}
            activeView={effectiveView}
            onSelect={handleSelectView}
            t={t}
          />
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 shrink-0"
                  onClick={toggleRightSidebar}
                  aria-label={t('terminal.collapseRightSidebar')}
                >
                  <PanelRightCloseIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="left">{t('terminal.collapseRightSidebar')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Panel content. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 items-center border-b border-border px-3">
            <h2 className="text-xs font-semibold text-foreground">
              {activePanel ? t(activePanel.labelKey) : ''}
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">{activePanel ? activePanel.render(context) : null}</div>
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  )
}

function RailGroups({
  panels,
  activeView,
  onSelect,
  t,
}: {
  panels: PanelDefinition[]
  activeView: RightView
  onSelect: (id: RightView) => void
  t: TFunction
}) {
  const core = panels.filter((p) => p.scope === 'core')
  const contextual = panels.filter((p) => p.scope === 'contextual')

  return (
    <>
      {core.map((panel) => (
        <RailButton
          key={panel.id}
          panel={panel}
          active={activeView === panel.id}
          onClick={() => onSelect(panel.id)}
          t={t}
        />
      ))}
      {core.length > 0 && contextual.length > 0 && (
        <Separator orientation="horizontal" className="my-1 w-5" />
      )}
      {contextual.map((panel) => (
        <RailButton
          key={panel.id}
          panel={panel}
          active={activeView === panel.id}
          onClick={() => onSelect(panel.id)}
          t={t}
        />
      ))}
    </>
  )
}

function RailButton({
  panel,
  active,
  onClick,
  t,
}: {
  panel: PanelDefinition
  active: boolean
  onClick: () => void
  t: TFunction
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            className={cn(
              'relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              active && 'bg-accent text-foreground',
            )}
            aria-label={t(panel.labelKey)}
          >
            {active && (
              <span className="absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground" />
            )}
            <panel.icon className="size-4" />
          </button>
        }
      />
      <TooltipContent side="left">{t(panel.labelKey)}</TooltipContent>
    </Tooltip>
  )
}
