import { createFileRoute, redirect } from '@tanstack/react-router'
import * as React from 'react'

import { WorkspaceLayout } from '@/components/workspace/workspace-layout'
import { createSession, listSessionsByWorkspace } from '@/lib/db/terminal-repo'
import { createTab, getWorkspace, listTabs, touchWorkspace } from '@/lib/db/workspace-repo'
import { api } from '@/lib/electron/api'
import { useWorkspaceStore } from '@/lib/store/workspace-store'
import { setNewTerminalTabHandler } from '@/lib/workspace-bus'

function basename(p: string): string {
  if (!p || p === '/') return '/'
  const parts = p.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || p
}

export const Route = createFileRoute('/workspace/$workspaceId')({
  loader: async ({ params }) => {
    const workspace = await getWorkspace(params.workspaceId)
    if (!workspace) {
      throw redirect({ to: '/workspace' })
    }

    let tabs = await listTabs(workspace.id)
    if (tabs.length === 0) {
      const sessions = await listSessionsByWorkspace(workspace.id)
      if (sessions.length > 0) {
        const sorted = [...sessions].sort((a, b) => b.last_active_at - a.last_active_at)
        for (const s of sorted) {
          await createTab(workspace.id, 'terminal', s.id, s.title ?? basename(s.cwd))
        }
      } else {
        const session = await createSession(workspace.path)
        await createTab(
          workspace.id,
          'terminal',
          session.id,
          session.title ?? basename(session.cwd),
        )
      }
      tabs = await listTabs(workspace.id)
    }

    const sessions = await listSessionsByWorkspace(workspace.id)
    await touchWorkspace(workspace.id)

    return { workspace, tabs, sessions }
  },
  component: WorkspaceScreen,
})

function WorkspaceScreen() {
  const data = Route.useLoaderData()
  const hydrate = useWorkspaceStore((s) => s.hydrate)
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces)
  const openTerminalTab = useWorkspaceStore((s) => s.openTerminalTab)
  const [homeDir, setHomeDir] = React.useState('')

  React.useEffect(() => {
    hydrate(data)
  }, [data, hydrate])

  React.useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  React.useEffect(() => {
    void api.path
      .homeDir()
      .then(setHomeDir)
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    setNewTerminalTabHandler(() => {
      void openTerminalTab()
    })
    return () => setNewTerminalTabHandler(null)
  }, [openTerminalTab])

  return <WorkspaceLayout homeDir={homeDir} />
}
