export type ScreenplayStatus = 'idea' | 'outline' | 'draft' | 'revision' | 'locked'

export type ScreenplayView = 'canvas' | 'editor' | 'audit'

export type ScreenplayAction =
  | 'outline'
  | 'episode-outline'
  | 'scene-breakdown'
  | 'scene-draft'
  | 'revision'
  | 'continuity-audit'

export interface ShotCard {
  id: string
  order: number
  duration?: number
  heading: string
  fields: Record<string, string>
  startLine: number
  endLine: number
}

export interface SceneDocument {
  path: string
  frontmatter: Record<string, string | number | string[]>
  title: string
  summary?: string
  conflict?: string
  turn?: string
  location?: string
  time?: string
  duration?: number
  characters: string[]
  shots: ShotCard[]
  source: string
}

export interface SceneSummary {
  id: string
  path: string
  order: number
  title: string
  status: string
  duration?: number
  location?: string
  time?: string
  summary?: string
  conflict?: string
  turn?: string
  characters: string[]
  shotCount: number
  warningCount: number
  warnings: string[]
  shots: ShotCard[]
  example?: boolean
}

export interface EpisodeSummary {
  id: string
  path?: string
  order: number
  title: string
  status: string
  hook?: string
  cliffhanger?: string
  duration?: number
  scenes: SceneSummary[]
  warningCount: number
}

export interface ScreenplayDocumentRef {
  path: string
  title: string
}

export interface ScreenplayCanvasData {
  rootPath: string
  projectTitle: string
  episodes: EpisodeSummary[]
  outline?: ScreenplayDocumentRef
  storyBible?: ScreenplayDocumentRef
  characters: ScreenplayDocumentRef[]
  continuity: ScreenplayDocumentRef[]
  unorganized: ScreenplayDocumentRef[]
  totalDuration: number
  totalScenes: number
  totalShots: number
  warningCount: number
}

export interface ContinuityIssue {
  id: string
  severity: 'info' | 'warning' | 'error'
  message: string
  detail?: string
  path?: string
  line?: number
}

export interface ProposedFileChange {
  path: string
  operation: 'create' | 'update' | 'delete'
  beforeHash: string | null
  beforeText?: string
  afterText?: string
  summary: string
}

export interface ChangeSet {
  id: string
  title: string
  changes: ProposedFileChange[]
}

export const SHOT_FIELD_LABELS = ['画面', '动作', '镜头', '光色', '声音', '连续性'] as const

export type ShotFieldLabel = (typeof SHOT_FIELD_LABELS)[number]
