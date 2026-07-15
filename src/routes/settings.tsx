import { createFileRoute } from '@tanstack/react-router'

import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { SettingsSidebar } from '@/components/settings/settings-sidebar'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <SettingsSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-8 py-6">
          <h1 className="text-lg font-semibold">Appearance</h1>
          <p className="text-sm text-muted-foreground">Customize the appearance of Kenvo.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <AppearanceSettings />
        </div>
      </main>
    </div>
  )
}
