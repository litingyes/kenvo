import { api } from '@/lib/electron/api'

let initPromise: Promise<void> | null = null

const DROP_LEGACY_STATEMENTS = [
  `DROP TABLE IF EXISTS workspace_tabs`,
  `DROP TABLE IF EXISTS terminal_history`,
  `DROP TABLE IF EXISTS terminal_sessions`,
  `DROP TABLE IF EXISTS workspaces`,
]

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS projects (
    id             TEXT PRIMARY KEY,
    path           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    created_at     INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_active
     ON projects(last_active_at DESC)`,
  `CREATE TABLE IF NOT EXISTS project_tabs (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL,
    file_path      TEXT NOT NULL,
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tabs_project
     ON project_tabs(project_id, position)`,
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL,
    skill_id       TEXT NOT NULL,
    title          TEXT,
    provider_id    TEXT,
    model_id       TEXT,
    created_at     INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_sessions_project
     ON chat_sessions(project_id, last_active_at DESC)`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    seq         INTEGER NOT NULL,
    role        TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_session
     ON chat_messages(session_id, seq)`,
]

async function tableColumns(table: string): Promise<string[]> {
  const rows = await api.db.select<{ name: string }>(`PRAGMA table_info(${table})`)
  return rows.map((row) => row.name)
}

/** Migrate pre-skills databases: agents became session-scoped skills. */
async function migrateLegacyAgentColumns(): Promise<void> {
  const sessionCols = await tableColumns('chat_sessions')
  if (sessionCols.includes('agent_id') && !sessionCols.includes('skill_id')) {
    await api.db.execute(`ALTER TABLE chat_sessions RENAME COLUMN agent_id TO skill_id`)
  }
  const projectCols = await tableColumns('projects')
  if (projectCols.includes('agent_id')) {
    await api.db.execute(`ALTER TABLE projects DROP COLUMN agent_id`)
  }
}

async function ensureSchema(): Promise<void> {
  for (const stmt of DROP_LEGACY_STATEMENTS) {
    await api.db.execute(stmt)
  }
  for (const stmt of SCHEMA_STATEMENTS) {
    await api.db.execute(stmt)
  }
  await migrateLegacyAgentColumns()
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
