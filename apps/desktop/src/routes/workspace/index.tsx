import { createFileRoute, redirect } from '@tanstack/react-router'

import { findOrCreateWorkspaceByPath, getRecentWorkspace } from '@/lib/db/workspace-repo'
import { api } from '@/lib/electron/api'

export const Route = createFileRoute('/workspace/')({
  loader: async () => {
    const recent = await getRecentWorkspace()
    if (recent) {
      throw redirect({ to: '/workspace/$workspaceId', params: { workspaceId: recent.id } })
    }
    const home = await api.path.homeDir().catch(() => '/')
    const workspace = await findOrCreateWorkspaceByPath(home)
    throw redirect({ to: '/workspace/$workspaceId', params: { workspaceId: workspace.id } })
  },
  component: WorkspaceIndexComponent,
})

function WorkspaceIndexComponent() {
  return null
}
