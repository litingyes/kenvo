import { createFileRoute } from '@tanstack/react-router'

import { ScreenplayWorkbench } from '@/components/screenplay/screenplay-workbench'
import type { ScreenplayMode } from '@/components/screenplay/types'

function parseMode(value: unknown): ScreenplayMode | undefined {
  return value === 'canvas' || value === 'editor' || value === 'audit' ? value : undefined
}

export interface ScreenplaySearch {
  mode?: ScreenplayMode
  file?: string
}

export const Route = createFileRoute('/screenplay/$projectId')({
  validateSearch: (search: Record<string, unknown>): ScreenplaySearch => ({
    mode: parseMode(search.mode),
    file: typeof search.file === 'string' && search.file.length > 0 ? search.file : undefined,
  }),
  component: ScreenplayRoute,
})

function ScreenplayRoute() {
  const { projectId } = Route.useParams()
  const { mode, file } = Route.useSearch()
  return <ScreenplayWorkbench projectId={projectId} initialMode={mode} initialDocumentPath={file} />
}
