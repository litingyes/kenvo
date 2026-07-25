import path from 'path'

import Database from 'better-sqlite3'
import { app } from 'electron'

let db: Database.Database | null = null

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'kenvo.db')
}

function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
  }
  return db
}

function convertPlaceholders(sql: string): string {
  // Tauri SQL uses $1, $2, ...; better-sqlite3 uses ?
  return sql.replace(/\$(\d+)/g, '?')
}

export function initDatabase(): void {
  const database = getDatabase()
  database.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id             TEXT PRIMARY KEY,
      path           TEXT NOT NULL UNIQUE,
      title          TEXT,
      created_at     INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_active
      ON workspaces(last_active_at DESC);

    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id             TEXT PRIMARY KEY,
      workspace_id   TEXT,
      title          TEXT,
      cwd            TEXT NOT NULL,
      created_at     INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terminal_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL,
      command     TEXT NOT NULL,
      cwd         TEXT NOT NULL,
      exit_code   INTEGER,
      executed_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_session
      ON terminal_history(session_id, executed_at DESC);

    CREATE INDEX IF NOT EXISTS idx_sessions_active
      ON terminal_sessions(last_active_at DESC);

    CREATE TABLE IF NOT EXISTS workspace_tabs (
      id             TEXT PRIMARY KEY,
      workspace_id   TEXT NOT NULL,
      type           TEXT NOT NULL,
      ref            TEXT NOT NULL,
      title          TEXT,
      position       INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tabs_workspace
      ON workspace_tabs(workspace_id, position);
  `)

  migrateSessionsWorkspace(database)
}

function migrateSessionsWorkspace(database: Database.Database): void {
  const columns = database.prepare('PRAGMA table_info(terminal_sessions)').all() as Array<{
    name: string
  }>
  if (!columns.some((c) => c.name === 'workspace_id')) {
    database.exec('ALTER TABLE terminal_sessions ADD COLUMN workspace_id TEXT')
  }

  const orphans = database
    .prepare('SELECT DISTINCT cwd FROM terminal_sessions WHERE workspace_id IS NULL')
    .all() as Array<{ cwd: string }>

  for (const { cwd } of orphans) {
    const existing = database.prepare('SELECT id FROM workspaces WHERE path = ?').get(cwd) as
      | { id: string }
      | undefined

    let workspaceId: string
    if (existing) {
      workspaceId = existing.id
    } else {
      workspaceId = crypto.randomUUID()
      const ts = Date.now()
      database
        .prepare(
          'INSERT INTO workspaces (id, path, title, created_at, last_active_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(workspaceId, cwd, path.basename(cwd), ts, ts)
    }

    database
      .prepare(
        'UPDATE terminal_sessions SET workspace_id = ? WHERE cwd = ? AND workspace_id IS NULL',
      )
      .run(workspaceId, cwd)
  }
}

export function dbSelect<T = unknown>(sql: string, params?: unknown[]): T[] {
  const database = getDatabase()
  const statement = database.prepare(convertPlaceholders(sql))
  return statement.all(...(params ?? [])) as T[]
}

export function dbExecute(
  sql: string,
  params?: unknown[],
): { lastInsertRowid: number | bigint; changes: number } {
  const database = getDatabase()
  const statement = database.prepare(convertPlaceholders(sql))
  const result = statement.run(...(params ?? []))
  return {
    lastInsertRowid: result.lastInsertRowid,
    changes: result.changes,
  }
}

export function closeDatabase(): void {
  db?.close()
  db = null
}
