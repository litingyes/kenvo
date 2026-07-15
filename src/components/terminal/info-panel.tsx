import {
  FolderTreeIcon,
  GitBranchIcon,
  HistoryIcon,
  InfoIcon,
  PanelRightCloseIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTerminalStore } from '@/lib/store/terminal-store'
import type { RightView } from '@/lib/terminal/types'
import { cn } from '@/lib/utils'

import { FileTreePanel } from './panels/file-tree-panel'
import { GitPanel } from './panels/git-panel'
import { HistoryPanel } from './panels/history-panel'
import { PathInfoPanel } from './panels/path-info-panel'

interface InfoPanelProps {
  sessionId: string
  cwd: string
  homeDir: string
  onInsertCommand: (cmd: string) => void
}

const VIEWS: { id: RightView; icon: React.ElementType }[] = [
  { id: 'path', icon: InfoIcon },
  { id: 'history', icon: HistoryIcon },
  { id: 'git', icon: GitBranchIcon },
  { id: 'files', icon: FolderTreeIcon },
]

const ViewTab = React.memo(function ViewTab({
  view,
  label,
  active,
  onSelect,
}: {
  view: (typeof VIEWS)[number]
  label: string
  active: boolean
  onSelect: (id: RightView) => void
}) {
  return (
    <button
      onClick={() => onSelect(view.id)}
      className={cn(
        'flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <view.icon className="size-3.5" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  )
})

export function InfoPanel({ sessionId, cwd, homeDir, onInsertCommand }: InfoPanelProps) {
  const { t } = useTranslation()
  const rightView = useTerminalStore((s) => s.rightView)
  const setRightView = useTerminalStore((s) => s.setRightView)
  const toggleRightSidebar = useTerminalStore((s) => s.toggleRightSidebar)

  const handleSelectView = React.useCallback((id: RightView) => setRightView(id), [setRightView])

  return (
    <div className="flex h-full flex-col border-l border-border">
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1.5">
        {VIEWS.map((view) => (
          <ViewTab
            key={view.id}
            view={view}
            label={t(`infoPanel.tabs.${view.id}`)}
            active={rightView === view.id}
            onSelect={handleSelectView}
          />
        ))}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-0.5 shrink-0"
          onClick={toggleRightSidebar}
          aria-label={t('terminal.collapseRightSidebar')}
        >
          <PanelRightCloseIcon className="size-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {rightView === 'path' && <PathInfoPanel cwd={cwd} />}
          {rightView === 'history' && (
            <HistoryPanel sessionId={sessionId} onInsertCommand={onInsertCommand} />
          )}
          {rightView === 'git' && <GitPanel cwd={cwd} />}
          {rightView === 'files' && <FileTreePanel cwd={cwd} homeDir={homeDir} />}
        </div>
      </ScrollArea>
    </div>
  )
}
