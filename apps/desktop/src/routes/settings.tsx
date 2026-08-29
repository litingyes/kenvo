import { Outlet, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

import { SettingsSidebar } from '@/components/settings/settings-sidebar'
import { useIsMacOS } from '@/hooks/use-platform'
import { api } from '@/lib/electron/api'

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  const isMacOS = useIsMacOS()
  const [isMainWindow, setIsMainWindow] = React.useState(false)

  React.useEffect(() => {
    api.window
      .getLabel()
      .then((label) => setIsMainWindow(label === 'main'))
      .catch(() => {
        // ignore
      })
  }, [])

  // The main window has a hidden title bar: reserve a top drag strip that
  // clears the macOS traffic lights, mirroring the studio's sidebar top bar.
  // The dedicated settings window has a native title bar and needs nothing.
  const showTrafficLightStrip = isMacOS && isMainWindow

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {showTrafficLightStrip && (
        <div className="flex h-9 shrink-0 [-webkit-app-region:drag]">
          <div className="w-56 shrink-0 border-r border-border bg-muted/30" />
          <div className="flex-1" />
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <SettingsSidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
