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
