import { Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/electron/api'
import { useThemeBridge } from '@/lib/settings/theme-bridge'
import { useThemeStore } from '@/lib/store/theme-store'
import { checkForUpdate } from '@/lib/updater'

export const Route = createRootRoute({
  component: RootComponent,
})

function ThemePresetSync() {
  const { themePreset } = useThemeStore()
  useThemeBridge()

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', themePreset)
  }, [themePreset])

  return null
}

function RootComponent() {
  const navigate = useNavigate()

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault()
            void navigate({ to: '/terminal' })
            break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

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
        <ThemePresetSync />
        <TooltipProvider>
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </React.Fragment>
  )
}
