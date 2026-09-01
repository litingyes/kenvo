import { createFileRoute } from '@tanstack/react-router'

import { ScreenplayWorkbench } from '@/components/screenplay/screenplay-workbench'

export const Route = createFileRoute('/screenplay/$projectId')({
  component: ScreenplayRoute,
})

function ScreenplayRoute() {
  const { projectId } = Route.useParams()
  return <ScreenplayWorkbench projectId={projectId} />
}
