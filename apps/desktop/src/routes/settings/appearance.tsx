import { createFileRoute } from '@tanstack/react-router'

import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { ScrollArea } from '@/components/ui/scroll-area'

export const Route = createFileRoute('/settings/appearance')({
  component: AppearancePage,
})

function AppearancePage() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-8">
        <AppearanceSettings />
      </div>
    </ScrollArea>
  )
}
