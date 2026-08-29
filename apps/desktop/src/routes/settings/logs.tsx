import { createFileRoute } from '@tanstack/react-router'

import { LogViewer } from '@/components/settings/log-viewer'

export const Route = createFileRoute('/settings/logs')({
  component: LogsPage,
})

function LogsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-8">
      <LogViewer />
    </div>
  )
}
