import * as React from 'react'

import { useIsMacOS } from '@/hooks/use-platform'
import { useTrafficLightInset } from '@/hooks/use-traffic-light-inset'
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
  const trafficLightInset = useTrafficLightInset()

  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center border-b border-border bg-background',
        isMacOS && '[-webkit-app-region:drag]',
      )}
      style={
        isMacOS
          ? ({ '--traffic-light-inset': `${trafficLightInset}px` } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className={cn(
          'flex h-full shrink-0 items-center pr-3 [-webkit-app-region:no-drag]',
          isMacOS && 'pl-(--traffic-light-inset)',
        )}
      >
        <ViewSwitcher
          leftSidebarOpen={leftSidebarOpen}
          rightSidebarOpen={rightSidebarOpen}
          onToggleLeftSidebar={onToggleLeftSidebar}
          onToggleRightSidebar={onToggleRightSidebar}
        />
      </div>

      <div className="min-w-2 flex-1 self-stretch" />

      <div className="flex h-full shrink-0 items-center gap-2 px-3 [-webkit-app-region:no-drag]">
        {rightContent}
      </div>
    </div>
  )
}
