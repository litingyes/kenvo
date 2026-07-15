import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { SettingsSidebar } from '@/components/settings/settings-sidebar'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <SettingsSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-8 py-6">
          <h1 className="text-lg font-semibold">{t('settings.appearance.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('settings.appearance.description')}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <AppearanceSettings />
        </div>
      </main>
    </div>
  )
}
