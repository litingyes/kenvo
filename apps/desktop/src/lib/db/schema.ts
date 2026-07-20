import { api } from '@/lib/electron/api'

let initPromise: Promise<void> | null = null

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS terminal_sessions (
    id             TEXT PRIMARY KEY,
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
