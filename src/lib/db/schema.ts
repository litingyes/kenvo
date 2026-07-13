import Database from '@tauri-apps/plugin-sql'

const DB_PATH = 'sqlite:lume.db'

let dbInstance: Database | null = null
let initPromise: Promise<Database> | null = null

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

async function initDatabase(db: Database): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.execute(stmt)
  }
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    const db = await Database.load(DB_PATH)
    await initDatabase(db)
    dbInstance = db
    return db
  })()

  return initPromise
}
