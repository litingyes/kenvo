import path from 'path'

import Database from 'better-sqlite3'
import { app } from 'electron'

let db: Database.Database | null = null

const LOG_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    level        TEXT NOT NULL,
    target       TEXT,
    message      TEXT NOT NULL,
    raw          TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_logs_source_timestamp
     ON logs(source, timestamp_ms DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp
     ON logs(level, timestamp_ms DESC, id DESC)`,
]

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'kenvo.db')
}

function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')
    for (const statement of LOG_TABLE_STATEMENTS) {
      db.exec(statement)
    }
  }
  return db
}

export interface LogRecordInput {
  source: 'app' | 'agentServer' | 'aiConversations'
  timestampMs: number
  level: string
  target?: string
  message: string
  raw: string
}

export function insertLogRecord(record: LogRecordInput): void {
  try {
    getDatabase()
      .prepare(
        `INSERT INTO logs (source, timestamp_ms, level, target, message, raw)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.source,
        record.timestampMs,
        record.level,
        record.target ?? null,
        record.message,
        record.raw,
      )
  } catch {
    // Logging must never interrupt the application.
  }
}

export function initDatabase(): void {
  // Open the database file eagerly; the renderer owns schema migrations
  // (see src/lib/db/schema.ts) and applies them through dbExecute.
  getDatabase()
}

function convertPlaceholders(sql: string): string {
  // Tauri SQL uses $1, $2, ...; better-sqlite3 uses ?
  return sql.replace(/\$(\d+)/g, '?')
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
