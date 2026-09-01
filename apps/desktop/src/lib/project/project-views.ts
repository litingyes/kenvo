import type { ProjectViewId } from './project-config'

export interface ProjectViewDefinition {
  id: ProjectViewId
  labelKey: string
  descriptionKey: string
  path: '/screenplay/$projectId'
}

/** The project-view registry is intentionally small until more writing modes land. */
export const PROJECT_VIEWS: ProjectViewDefinition[] = [
  {
    id: 'screenplay',
    labelKey: 'projectViews.screenplay.title',
    descriptionKey: 'projectViews.screenplay.description',
    path: '/screenplay/$projectId',
  },
]

export function getProjectView(viewId: ProjectViewId): ProjectViewDefinition | undefined {
  return PROJECT_VIEWS.find((view) => view.id === viewId)
}
