import type { ProjectTemplate } from '@/components/screenplay/screenplay-template'
import type { ScreenplayMode } from '@/components/screenplay/types'

export type ProjectViewId = 'screenplay'
export type ProjectDefaultMode = Exclude<ScreenplayMode, 'editor'>

export interface ProjectConfig {
  schemaVersion: 1
  template: ProjectTemplate
  views: ProjectViewId[]
  defaultView: ProjectViewId
  screenplay: {
    defaultMode: ProjectDefaultMode
  }
}

export type ProjectConfigReadResult =
  | { status: 'missing'; config: null }
  | { status: 'invalid'; config: null }
  | { status: 'valid'; config: ProjectConfig }

export const PROJECT_CONFIG_PATH = '.kenvo/project.json'

export const PROJECT_VIEW_IDS: ProjectViewId[] = ['screenplay']

export function defaultProjectConfig(template: ProjectTemplate = 'blank'): ProjectConfig {
  return {
    schemaVersion: 1,
    template,
    views: ['screenplay'],
    defaultView: 'screenplay',
    screenplay: {
      defaultMode: 'canvas',
    },
  }
}

function isProjectTemplate(value: unknown): value is ProjectTemplate {
  return value === 'short-video-drama' || value === 'blank'
}

function isProjectViewId(value: unknown): value is ProjectViewId {
  return value === 'screenplay'
}

function isProjectDefaultMode(value: unknown): value is ProjectDefaultMode {
  return value === 'canvas' || value === 'audit'
}

export function parseProjectConfig(value: unknown): ProjectConfig | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const screenplay = record.screenplay
  if (!screenplay || typeof screenplay !== 'object') return null
  const screenplayRecord = screenplay as Record<string, unknown>
  if (
    record.schemaVersion !== 1 ||
    !isProjectTemplate(record.template) ||
    !Array.isArray(record.views) ||
    record.views.length === 0 ||
    !record.views.every(isProjectViewId) ||
    !isProjectViewId(record.defaultView) ||
    !record.views.includes(record.defaultView) ||
    !isProjectDefaultMode(screenplayRecord.defaultMode)
  ) {
    return null
  }
  return {
    schemaVersion: 1,
    template: record.template,
    views: [...record.views],
    defaultView: record.defaultView,
    screenplay: {
      defaultMode: screenplayRecord.defaultMode,
    },
  }
}

export function withProjectDefaultMode(
  config: ProjectConfig,
  defaultMode: ProjectDefaultMode,
): ProjectConfig {
  return {
    ...config,
    screenplay: {
      ...config.screenplay,
      defaultMode,
    },
  }
}
