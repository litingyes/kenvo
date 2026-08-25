import { createFileRoute, redirect } from '@tanstack/react-router'
import * as React from 'react'

import { ProjectLayout } from '@/components/project/project-layout'
import { getProject, listTabs, touchProject } from '@/lib/db/project-repo'
import { useProjectStore } from '@/lib/store/project-store'

export const Route = createFileRoute('/project/$projectId')({
  loader: async ({ params }) => {
    const project = await getProject(params.projectId)
    if (!project) {
      throw redirect({ to: '/' })
    }
    const tabs = await listTabs(project.id)
    await touchProject(project.id)
    return { project, tabs }
  },
  component: ProjectScreen,
})

function ProjectScreen() {
  const data = Route.useLoaderData()
  const hydrate = useProjectStore((s) => s.hydrate)

  React.useEffect(() => {
    hydrate(data.project, data.tabs)
  }, [data, hydrate])

  return <ProjectLayout project={data.project} />
}
