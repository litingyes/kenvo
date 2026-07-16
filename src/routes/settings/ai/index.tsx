import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/ai/')({
  component: AiIndexPage,
})

function AiIndexPage() {
  return <Navigate to="/settings/ai/basic" />
}
