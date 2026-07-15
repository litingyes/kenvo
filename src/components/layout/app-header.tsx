import * as React from 'react'

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
  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center border-b border-border bg-background pl-20"
    >
      <ViewSwitcher
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleLeftSidebar={onToggleLeftSidebar}
        onToggleRightSidebar={onToggleRightSidebar}
      />

      <div data-tauri-drag-region className="min-w-2 flex-1 self-stretch" />

      <div className="flex shrink-0 items-center gap-1 pr-2 [-webkit-app-region:no-drag]">
        {rightContent}
      </div>
    </div>
  )
}
