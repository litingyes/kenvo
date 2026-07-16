import { createFileRoute } from '@tanstack/react-router'

import { AboutSettings } from '@/components/settings/about-settings'

export const Route = createFileRoute('/settings/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <AboutSettings />
    </div>
  )
}
