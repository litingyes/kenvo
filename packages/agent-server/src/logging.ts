import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import Database from 'better-sqlite3'

const AI_LOG_FILE = 'ai-conversations.jsonl'
const SERVER_LOG_FILE = 'agent-server.log'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_ROTATED_FILES = 2

const readyDirs = new Set<string>()

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

interface LogStatement {
  all(...params: unknown[]): unknown[]
  run(...params: unknown[]): unknown
}

interface LogDatabase {
  exec(sql: string): void
  prepare(sql: string): LogStatement
  pragma?(sql: string): unknown
}

interface BuiltinSqliteModule {
  DatabaseSync: new (path: string) => LogDatabase
}

interface DbLogRecord {
  source: 'agentServer' | 'aiConversations'
  timestampMs: number
  level: string
  target?: string
  message: string
  raw: string
}

let logDatabase: LogDatabase | null | undefined

function getLogDatabase(): LogDatabase | null {
  if (logDatabase !== undefined) return logDatabase

  const dbPath = process.env.KENVO_DB_PATH?.trim()
  if (!dbPath) {
    logDatabase = null
    return logDatabase
  }

  try {
    const getBuiltinModule = (
      process as NodeJS.Process & {
        getBuiltinModule?: (id: string) => unknown
      }
    ).getBuiltinModule
    const builtinSqlite = getBuiltinModule?.('node:sqlite') as BuiltinSqliteModule | undefined
    if (builtinSqlite) {
      const database = new builtinSqlite.DatabaseSync(dbPath)
      database.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
      for (const statement of LOG_TABLE_STATEMENTS) {
        database.exec(statement)
      }
      logDatabase = database
      return logDatabase
    }

    const nativeBinding = process.env.KENVO_SQLITE_NATIVE_BINDING?.trim()
    const database = (nativeBinding
      ? new Database(dbPath, { nativeBinding })
      : new Database(dbPath)) as unknown as LogDatabase
    database.pragma?.('journal_mode = WAL')
    database.pragma?.('busy_timeout = 5000')
    for (const statement of LOG_TABLE_STATEMENTS) {
      database.exec(statement)
    }
    logDatabase = database
  } catch {
    logDatabase = null
  }

  return logDatabase
}

function writeDatabaseRecord(record: DbLogRecord): void {
  const database = getLogDatabase()
  if (!database) return

  try {
    database
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
    // The file sink remains the fallback if the database is unavailable.
  }
}

function createEnvDirResolver(name: string): () => string | null {
  let cached: string | null | undefined
  return () => {
    if (cached !== undefined) {
      return cached
    }
    const fromEnv = process.env[name]?.trim()
    cached = fromEnv && fromEnv.length > 0 ? fromEnv : null
    return cached
  }
}

export const getLogDir = createEnvDirResolver('KENVO_LOG_DIR')
export const getDataDir = createEnvDirResolver('KENVO_DATA_DIR')

function ensureDir(dir: string): boolean {
  if (readyDirs.has(dir)) {
    return true
  }
  try {
    mkdirSync(dir, { recursive: true })
    readyDirs.add(dir)
    return true
  } catch {
    return false
  }
}

function rotateIfNeeded(filePath: string): void {
  try {
    if (!existsSync(filePath) || statSync(filePath).size < MAX_FILE_BYTES) {
      return
    }
    const oldest = `${filePath}.${MAX_ROTATED_FILES}`
    rmSync(oldest, { force: true })
    for (let i = MAX_ROTATED_FILES - 1; i >= 1; i--) {
      const src = `${filePath}.${i}`
      if (existsSync(src)) {
        renameSync(src, `${filePath}.${i + 1}`)
      }
    }
    renameSync(filePath, `${filePath}.1`)
  } catch {
    // Rotation is best-effort; never block logging on it.
  }
}

function appendLine(dir: string | null, fileName: string, line: string): void {
  if (!dir || !ensureDir(dir)) {
    return
  }
  const filePath = join(dir, fileName)
  rotateIfNeeded(filePath)
  try {
    appendFileSync(filePath, `${line}\n`, 'utf8')
  } catch {
    readyDirs.delete(dir)
  }
}

export function writeAiRecord(record: Record<string, unknown>): void {
  const timestamp = new Date()
  let line: string
  try {
    line = JSON.stringify({ ts: timestamp.toISOString(), ...record })
  } catch {
    line = JSON.stringify({
      ts: timestamp.toISOString(),
      type: record.type ?? 'unknown',
      serializationError: true,
    })
  }

  const type = typeof record.type === 'string' ? record.type : 'unknown'
  const operationId = typeof record.operationId === 'string' ? record.operationId : ''
  const provider = typeof record.provider === 'string' ? record.provider : ''
  const model = typeof record.modelId === 'string' ? record.modelId : ''
  const callId = typeof record.callId === 'string' ? record.callId : ''
  const message = operationId
    ? [type, operationId, provider, model].filter(Boolean).join(' | ')
    : `${type} ${callId}`.trim()
  const level =
    type === 'error'
      ? 'ERROR'
      : type === 'warning' || type === 'warn'
        ? 'WARN'
        : type === 'conversation'
          ? 'DEBUG'
          : 'INFO'
  writeDatabaseRecord({
    source: 'aiConversations',
    timestampMs: timestamp.getTime(),
    level,
    target: type,
    message,
    raw: line,
  })
  appendLine(getDataDir() ?? getLogDir(), AI_LOG_FILE, line)
}

export function serverLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
): void {
  const timestamp = new Date()
  const ts = timestamp.toISOString()
  const suffix = meta ? ` ${safeJson(meta)}` : ''
  const line = `${ts} [${level.toUpperCase()}] ${message}${suffix}`
  const target =
    typeof meta?.agentId === 'string'
      ? meta.agentId
      : typeof meta?.task === 'string'
        ? meta.task
        : undefined
  writeDatabaseRecord({
    source: 'agentServer',
    timestampMs: timestamp.getTime(),
    level: level.toUpperCase(),
    target,
    message,
    raw: line,
  })
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
  appendLine(getLogDir(), SERVER_LOG_FILE, line)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '"[unserializable]"'
  }
}
