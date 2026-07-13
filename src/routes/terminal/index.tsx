import { createFileRoute, redirect } from '@tanstack/react-router'
import { homeDir } from '@tauri-apps/api/path'

import { createSession, getRecentSession } from '@/lib/db/terminal-repo'

export const Route = createFileRoute('/terminal/')({
  loader: async () => {
    const recent = await getRecentSession()
    if (recent) {
      throw redirect({ to: '/terminal/$sessionId', params: { sessionId: recent.id } })
    }
    const home = await homeDir().catch(() => '/')
    const session = await createSession(home)
    throw redirect({ to: '/terminal/$sessionId', params: { sessionId: session.id } })
  },
  component: TerminalIndexComponent,
})

function TerminalIndexComponent() {
  return null
}
