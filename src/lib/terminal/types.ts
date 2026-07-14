export interface TerminalSession {
  id: string
  title: string | null
  cwd: string
  created_at: number
  last_active_at: number
}

export interface HistoryEntry {
  id: number | null
  session_id: string
  command: string
  cwd: string
  exit_code: number | null
  executed_at: number
}

export type OutputLineType = 'command' | 'output' | 'error' | 'system'

export interface OutputLine {
  id: string
  type: OutputLineType
  text: string
  cwd?: string
}

export type GroupMode = 'none' | 'time' | 'path'

export type SortMode = 'created' | 'updated'

export type RightView = 'path' | 'history' | 'git' | 'tree'

export interface SessionGroup {
  key: string
  label: string
  sessions: TerminalSession[]
}

export interface EditorApp {
  cli: string
  name: string
}
