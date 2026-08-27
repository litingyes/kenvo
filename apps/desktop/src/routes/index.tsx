import { createFileRoute } from '@tanstack/react-router'

import { StudioLayout } from '@/components/studio/studio-layout'

export const Route = createFileRoute('/')({
  component: StudioLayout,
})
