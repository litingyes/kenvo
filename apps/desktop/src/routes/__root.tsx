import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/electron/api'
import { useThemeBridge } from '@/lib/settings/theme-bridge'
import { checkForUpdate } from '@/lib/updater'

export const Route = createRootRoute({
  component: RootComponent,
})

function ThemeBridge() {
  useThemeBridge()

  return null
}

function RootComponent() {
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
