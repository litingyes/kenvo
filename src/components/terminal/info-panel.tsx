import {
  FolderTreeIcon,
  GitBranchIcon,
  HistoryIcon,
  InfoIcon,
  PanelRightCloseIcon,
} from 'lucide-react'
import * as React from 'react'

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

const VIEWS: { id: RightView; label: string; icon: React.ElementType }[] = [
  { id: 'path', label: 'Path', icon: InfoIcon },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'git', label: 'Git', icon: GitBranchIcon },
  { id: 'tree', label: 'Files', icon: FolderTreeIcon },
]

export function InfoPanel({ sessionId, cwd, homeDir, onInsertCommand }: InfoPanelProps) {
  const rightView = useTerminalStore((s) => s.rightView)
  const setRightView = useTerminalStore((s) => s.setRightView)
  const toggleRightSidebar = useTerminalStore((s) => s.toggleRightSidebar)

  return (
    <div className="flex h-full flex-col border-l border-border bg-muted/30">
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1.5">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            onClick={() => setRightView(view.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
              rightView === view.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <view.icon className="size-3.5" />
            <span className="hidden xl:inline">{view.label}</span>
          </button>
        ))}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-0.5 shrink-0"
          onClick={toggleRightSidebar}
          aria-label="Collapse right sidebar"
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
          {rightView === 'tree' && <FileTreePanel cwd={cwd} homeDir={homeDir} />}
        </div>
      </ScrollArea>
    </div>
  )
}
