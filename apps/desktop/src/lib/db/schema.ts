import { api } from '@/lib/electron/api'

let initPromise: Promise<void> | null = null

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id             TEXT PRIMARY KEY,
    path           TEXT NOT NULL UNIQUE,
    title          TEXT,
    created_at     INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_active
     ON workspaces(last_active_at DESC)`,
  `CREATE TABLE IF NOT EXISTS terminal_sessions (
    id             TEXT PRIMARY KEY,
    workspace_id   TEXT,
    title          TEXT,
    cwd            TEXT NOT NULL,
    created_at     INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS terminal_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    command     TEXT NOT NULL,
    cwd         TEXT NOT NULL,
    exit_code   INTEGER,
    executed_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_history_session
     ON terminal_history(session_id, executed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_active
     ON terminal_sessions(last_active_at DESC)`,
  `CREATE TABLE IF NOT EXISTS workspace_tabs (
    id             TEXT PRIMARY KEY,
    workspace_id   TEXT NOT NULL,
    type           TEXT NOT NULL,
    ref            TEXT NOT NULL,
    title          TEXT,
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tabs_workspace
     ON workspace_tabs(workspace_id, position)`,
]

async function ensureSchema(): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await api.db.execute(stmt)
  }
}

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = ensureSchema()
  return initPromise
}

export async function getDatabase() {
  await initDatabase()
  return api.db
}
