import { Outlet, createFileRoute } from '@tanstack/react-router'

import { SettingsSidebar } from '@/components/settings/settings-sidebar'

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <SettingsSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
