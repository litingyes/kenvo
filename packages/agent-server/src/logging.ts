import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const AI_LOG_FILE = 'ai-conversations.jsonl'
const SERVER_LOG_FILE = 'agent-server.log'

let logDir: string | null = null
let dirReady = false

export function getLogDir(): string | null {
  if (logDir !== null) {
    return logDir || null
  }
  const fromEnv = process.env.KENVO_LOG_DIR?.trim()
  logDir = fromEnv && fromEnv.length > 0 ? fromEnv : ''
  return logDir || null
}

function ensureDir(dir: string): boolean {
  if (dirReady) {
    return true
  }
  try {
    mkdirSync(dir, { recursive: true })
    dirReady = true
    return true
  } catch {
    return false
  }
}

function appendLine(fileName: string, line: string): void {
  const dir = getLogDir()
  if (!dir || !ensureDir(dir)) {
    return
  }
  try {
    appendFileSync(join(dir, fileName), `${line}\n`, 'utf8')
  } catch {
    dirReady = false
  }
}

export function writeAiRecord(record: Record<string, unknown>): void {
  let line: string
  try {
    line = JSON.stringify({ ts: new Date().toISOString(), ...record })
  } catch {
    line = JSON.stringify({
      ts: new Date().toISOString(),
      type: record.type ?? 'unknown',
      serializationError: true,
    })
  }
  appendLine(AI_LOG_FILE, line)
}

export function serverLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
): void {
  const ts = new Date().toISOString()
  const suffix = meta ? ` ${safeJson(meta)}` : ''
  const line = `${ts} [${level.toUpperCase()}] ${message}${suffix}`
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
  appendLine(SERVER_LOG_FILE, line)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '"[unserializable]"'
  }
}
