import * as React from 'react'

import { useIsMacOS } from '@/hooks/use-platform'
import { useTrafficLightInset } from '@/hooks/use-traffic-light-inset'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  leftContent?: React.ReactNode
  /** Rendered left-aligned in the flexible middle zone (e.g. session title). */
  centerContent?: React.ReactNode
  rightContent?: React.ReactNode
  /** Pad the left zone past the macOS traffic lights. Disable when the
   * traffic lights sit over a sibling column (e.g. the sidebar) instead. */
  withTrafficLightInset?: boolean
  /** Show the bottom border. Disable for seamless column surfaces. */
  bordered?: boolean
}

export function AppHeader({
  leftContent,
  centerContent,
  rightContent,
  withTrafficLightInset = true,
  bordered = true,
}: AppHeaderProps) {
  const isMacOS = useIsMacOS()
  const trafficLightInset = useTrafficLightInset()
  const applyInset = isMacOS && withTrafficLightInset

  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center bg-background',
        bordered && 'border-b border-border',
        isMacOS && '[-webkit-app-region:drag]',
      )}
      style={
        applyInset
          ? ({ '--traffic-light-inset': `${trafficLightInset}px` } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className={cn(
          'flex h-full shrink-0 items-center pr-3 [-webkit-app-region:no-drag]',
          applyInset && 'pl-(--traffic-light-inset)',
        )}
      >
        {leftContent}
      </div>

      <div className="flex min-w-2 flex-1 items-center self-stretch">{centerContent}</div>

      <div className="flex h-full shrink-0 items-center gap-2 px-3 [-webkit-app-region:no-drag]">
        {rightContent}
      </div>
    </div>
  )
}
