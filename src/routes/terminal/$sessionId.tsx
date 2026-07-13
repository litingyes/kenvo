import { createFileRoute, redirect } from '@tanstack/react-router'
import * as React from 'react'

import { TerminalLayout } from '@/components/terminal/terminal-layout'
import { TerminalView } from '@/components/terminal/terminal-view'
import { getHistory, getSession, listSessions } from '@/lib/db/terminal-repo'
import { useTerminalStore } from '@/lib/store/terminal-store'

export const Route = createFileRoute('/terminal/$sessionId')({
  loader: async ({ params }) => {
    const [session, history, sessions] = await Promise.all([
      getSession(params.sessionId),
      getHistory(params.sessionId),
      listSessions(),
    ])
    if (!session) {
      throw redirect({ to: '/terminal' })
    }
    return { session, history, sessions }
  },
  component: TerminalSessionComponent,
})

function TerminalSessionComponent() {
  const { session, history, sessions } = Route.useLoaderData()
  const initialHistory = history.map((h) => h.command).reverse()

  const updateSessionCwd = useTerminalStore((s) => s.updateSessionCwd)
  const refreshSessions = useTerminalStore((s) => s.refreshSessions)
  const insertCommandRef = React.useRef<((cmd: string) => void) | null>(null)
  const [homeDir, setHomeDir] = React.useState('')

  React.useEffect(() => {
    useTerminalStore.setState({ sessions, loaded: true, activeId: session.id })
  }, [sessions, session.id])

  const handleCwdChange = React.useCallback(
    (cwd: string) => {
      void updateSessionCwd(session.id, cwd)
      void refreshSessions()
    },
    [session.id, updateSessionCwd, refreshSessions],
  )

  return (
    <TerminalLayout
      activeSessionId={session.id}
      insertCommandRef={insertCommandRef}
      homeDir={homeDir}
    >
      <TerminalView
        sessionId={session.id}
        initialCwd={session.cwd}
        initialHistory={initialHistory}
        onCwdChange={handleCwdChange}
        onHomeDirChange={setHomeDir}
        insertCommandRef={insertCommandRef}
      />
    </TerminalLayout>
  )
}
