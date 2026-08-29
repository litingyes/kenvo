import { createFileRoute } from '@tanstack/react-router'

import { AboutSettings } from '@/components/settings/about-settings'
import { ScrollArea } from '@/components/ui/scroll-area'

export const Route = createFileRoute('/settings/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-8">
        <AboutSettings />
      </div>
    </ScrollArea>
  )
}
