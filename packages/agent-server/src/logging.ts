import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const AI_LOG_FILE = 'ai-conversations.jsonl'
const SERVER_LOG_FILE = 'agent-server.log'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_ROTATED_FILES = 2

const readyDirs = new Set<string>()

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
  appendLine(getDataDir() ?? getLogDir(), AI_LOG_FILE, line)
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
  appendLine(getLogDir(), SERVER_LOG_FILE, line)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '"[unserializable]"'
  }
}
