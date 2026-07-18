import { createFileRoute } from '@tanstack/react-router'

import { LogViewer } from '@/components/settings/log-viewer'

export const Route = createFileRoute('/settings/logs')({
  component: LogsPage,
})

function LogsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <LogViewer />
    </div>
  )
}
