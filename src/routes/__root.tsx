import { Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useThemeStore } from '@/lib/store/theme-store'

export const Route = createRootRoute({
  component: RootComponent,
})

function ThemePresetSync() {
  const { themePreset } = useThemeStore()

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
