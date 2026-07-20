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
    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id             TEXT PRIMARY KEY,
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
  `)
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
