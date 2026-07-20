import { createFileRoute } from '@tanstack/react-router'

import { AppearanceSettings } from '@/components/settings/appearance-settings'

export const Route = createFileRoute('/settings/appearance')({
  component: AppearancePage,
})

function AppearancePage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <AppearanceSettings />
    </div>
  )
}
