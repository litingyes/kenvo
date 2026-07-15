import { useLocation } from '@tanstack/react-router'
import { TerminalIcon } from 'lucide-react'
import * as React from 'react'

export type AppViewId = 'terminal'

export interface AppView {
  id: AppViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  route: string
}

export const APP_VIEWS: AppView[] = [
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon, route: '/terminal' },
]

export function useActiveView(): AppView {
  const location = useLocation()

  return React.useMemo(() => {
    const pathname = location.pathname
    const match = APP_VIEWS.find(
      (view) => pathname === view.route || pathname.startsWith(`${view.route}/`),
    )
    return match ?? APP_VIEWS[0]!
  }, [location.pathname])
}
