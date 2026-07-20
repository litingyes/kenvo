import { createFileRoute, redirect } from '@tanstack/react-router'

import { createSession, getRecentSession } from '@/lib/db/terminal-repo'
import { api } from '@/lib/electron/api'

export const Route = createFileRoute('/terminal/')({
  loader: async () => {
    const recent = await getRecentSession()
    if (recent) {
      throw redirect({ to: '/terminal/$sessionId', params: { sessionId: recent.id } })
    }
    const home = await api.path.homeDir().catch(() => '/')
    const session = await createSession(home)
    throw redirect({ to: '/terminal/$sessionId', params: { sessionId: session.id } })
  },
  component: TerminalIndexComponent,
})

function TerminalIndexComponent() {
  return null
}
