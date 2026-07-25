import { Outlet, createRootRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/electron/api'
import { useThemeBridge } from '@/lib/settings/theme-bridge'
import { checkForUpdate } from '@/lib/updater'
import { requestNewTerminalTab } from '@/lib/workspace-bus'

export const Route = createRootRoute({
  component: RootComponent,
})

function ThemeBridge() {
  useThemeBridge()

  return null
}

function RootComponent() {
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault()
            if (!location.pathname.startsWith('/workspace')) {
              void navigate({ to: '/workspace' })
            }
            requestNewTerminalTab()
            break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, location.pathname])

  React.useEffect(() => {
    if (import.meta.env.PROD) {
      api.window
        .getLabel()
        .then((label) => {
          if (label === 'main') {
            void checkForUpdate({ silent: true })
          }
        })
        .catch(() => {
          // ignore
        })
    }
  }, [])

  return (
    <React.Fragment>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <ThemeBridge />
        <TooltipProvider>
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </React.Fragment>
  )
}
