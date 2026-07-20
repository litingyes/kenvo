import { createFileRoute } from '@tanstack/react-router'

import { LanguageSettings } from '@/components/settings/language-settings'

export const Route = createFileRoute('/settings/language')({
  component: LanguagePage,
})

function LanguagePage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <LanguageSettings />
    </div>
  )
}
