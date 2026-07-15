import * as React from 'react'

import { useIsMacOS } from '@/hooks/use-platform'
import { cn } from '@/lib/utils'

import { ViewSwitcher } from './view-switcher'

interface AppHeaderProps {
  rightContent?: React.ReactNode
  leftSidebarOpen?: boolean
  rightSidebarOpen?: boolean
  onToggleLeftSidebar?: () => void
  onToggleRightSidebar?: () => void
}

export function AppHeader({
  rightContent,
  leftSidebarOpen,
  rightSidebarOpen,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: AppHeaderProps) {
  const isMacOS = useIsMacOS()

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center border-b border-border bg-background"
    >
      <div
        className={cn(
          'flex shrink-0 items-center px-3 [-webkit-app-region:no-drag]',
          isMacOS ? 'h-full pl-[84px]' : 'h-full',
        )}
      >
        <ViewSwitcher
          leftSidebarOpen={leftSidebarOpen}
          rightSidebarOpen={rightSidebarOpen}
          onToggleLeftSidebar={onToggleLeftSidebar}
          onToggleRightSidebar={onToggleRightSidebar}
        />
      </div>

      <div data-tauri-drag-region className="min-w-2 flex-1 self-stretch" />

      <div className="flex h-full shrink-0 items-center gap-2 px-3 [-webkit-app-region:no-drag]">
        {rightContent}
      </div>
    </div>
  )
}
