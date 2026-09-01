import fs from 'fs/promises'
import path from 'path'

import { WebContents } from 'electron'

import { dbExecute, dbSelect } from './db'
import { IPC_CHANNELS } from './ipc-channels'
import { getAppPaths } from './paths'

export type LogSource = 'app' | 'agentServer' | 'aiConversations'

export interface LogLine {
  source: LogSource
  timestamp: string
  timestampMs: number
  level: string
  target?: string
  message: string
  raw: string
}

export type LogStreamEvent =
  | { event: 'initial'; data: { source: LogSource; lines: LogLine[] } }
  | { event: 'newLines'; data: { source: LogSource; lines: LogLine[] } }
  | { event: 'reset'; data: { source: LogSource; lines: LogLine[] } }
  | { event: 'error'; data: { source: LogSource; message: string } }

export interface StreamOptions {
  maxInitialLines?: number
  tail?: boolean
}

export interface LogQueryOptions {
  afterId?: number
  limit?: number
  level?: string
  keyword?: string
  fromTimestampMs?: number
  toTimestampMs?: number
}

export interface StoredLogRecord {
  id: number
  source: LogSource
  timestampMs: number
  level: string
  target: string | null
  message: string
  raw: string
}

const DEFAULT_MAX_INITIAL_LINES = 500
const DEFAULT_MAX_INITIAL_BYTES = 1024 * 1024
const DEFAULT_POLL_INTERVAL_MS = 500
const DEFAULT_MAX_QUERY_LINES = 1000
const MESSAGE_PREVIEW_LEN = 200
const MAX_LINE_LENGTH = 50_000

const APP_LOG_RE =
  /^\[(\d{4}-\d{2}-\d{2})\]\[(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]\[(\w+)\]\[(.*?)\]\s*(.*)$/
const AGENT_LOG_RE =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+\[(\w+)\]\s+(.*)$/

interface ActiveStream {
  cancel: boolean
  sender: WebContents
  interval?: NodeJS.Timeout
  pollInFlight?: boolean
  fallbackStarted?: boolean
}

const activeStreams = new Map<string, ActiveStream>()
let nextStreamId = 1

function sourceFileName(source: LogSource): string {
  switch (source) {
    case 'app':
      return 'kenvo.log'
    case 'agentServer':
      return 'agent-server.log'
    case 'aiConversations':
      return 'ai-conversations.jsonl'
  }
}

function sourceDir(source: LogSource): string {
  const { logDir, dataDir } = getAppPaths()
  return source === 'aiConversations' ? dataDir : logDir
}

function sourcePath(source: LogSource): string {
  return path.join(sourceDir(source), sourceFileName(source))
}

function send(sender: WebContents, event: LogStreamEvent): void {
  sender.send(IPC_CHANNELS.LOG_EVENT, event)
}

const VALID_SOURCES = new Set<LogSource>(['app', 'agentServer', 'aiConversations'])

function normalizeSources(sources: LogSource[]): LogSource[] {
  const unique = new Set<LogSource>()
  for (const source of sources) {
    if (VALID_SOURCES.has(source)) unique.add(source)
  }
  return [...unique]
}

function toLogLine(record: StoredLogRecord): LogLine {
  return {
    source: record.source,
    timestamp: new Date(record.timestampMs).toISOString(),
    timestampMs: record.timestampMs,
    level: record.level.toUpperCase(),
    target: record.target ?? undefined,
    message: truncateMessage(record.message),
    raw: record.raw,
  }
}

function queryRecordsForSource(
  source: LogSource,
  limit?: number,
  options: LogQueryOptions = {},
): StoredLogRecord[] {
  const conditions = ['source = ?']
  const params: unknown[] = [source]
  if (options.level) {
    conditions.push('level = ?')
    params.push(options.level.toUpperCase())
  }
  if (options.fromTimestampMs !== undefined) {
    conditions.push('timestamp_ms >= ?')
    params.push(options.fromTimestampMs)
  }
  if (options.toTimestampMs !== undefined) {
    conditions.push('timestamp_ms <= ?')
    params.push(options.toTimestampMs)
  }
  if (options.keyword?.trim()) {
    const keyword = `%${options.keyword.trim().toLowerCase()}%`
    conditions.push(
      "(lower(message) LIKE ? OR lower(COALESCE(target, '')) LIKE ? OR lower(raw) LIKE ?)",
    )
    params.push(keyword, keyword, keyword)
  }
  const limitSql = limit === undefined ? '' : ' LIMIT ?'
  if (limit !== undefined) params.push(limit)
  const rows = dbSelect<StoredLogRecord>(
    `SELECT id, source, timestamp_ms AS timestampMs, level, target, message, raw
       FROM logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY id DESC${limitSql}`,
    params,
  )
  return rows.reverse()
}

function queryRecordsAfterId(
  sources: LogSource[],
  afterId: number,
  limit: number,
  options: LogQueryOptions = {},
): StoredLogRecord[] {
  const placeholders = sources.map(() => '?').join(', ')
  const conditions = [`source IN (${placeholders})`, 'id > ?']
  const params: unknown[] = [...sources, afterId]
  if (options.level) {
    conditions.push('level = ?')
    params.push(options.level.toUpperCase())
  }
  if (options.fromTimestampMs !== undefined) {
    conditions.push('timestamp_ms >= ?')
    params.push(options.fromTimestampMs)
  }
  if (options.toTimestampMs !== undefined) {
    conditions.push('timestamp_ms <= ?')
    params.push(options.toTimestampMs)
  }
  if (options.keyword?.trim()) {
    const keyword = `%${options.keyword.trim().toLowerCase()}%`
    conditions.push(
      "(lower(message) LIKE ? OR lower(COALESCE(target, '')) LIKE ? OR lower(raw) LIKE ?)",
    )
    params.push(keyword, keyword, keyword)
  }
  params.push(limit)
  return dbSelect<StoredLogRecord>(
    `SELECT id, source, timestamp_ms AS timestampMs, level, target, message, raw
       FROM logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY id ASC
      LIMIT ?`,
    params,
  )
}

function queryInitialRecords(sources: LogSource[], maxInitialLines: number): StoredLogRecord[] {
  return sources.flatMap((source) => queryRecordsForSource(source, maxInitialLines))
}

export function queryLogRecords(sources: LogSource[], options: LogQueryOptions = {}): LogLine[] {
  const normalizedSources = normalizeSources(sources)
  if (normalizedSources.length === 0) return []

  const records =
    options.afterId === undefined
      ? normalizedSources.flatMap((source) =>
          queryRecordsForSource(source, options.limit ?? DEFAULT_MAX_INITIAL_LINES, options),
        )
      : queryRecordsAfterId(
          normalizedSources,
          options.afterId,
          options.limit ?? DEFAULT_MAX_QUERY_LINES,
          options,
        )
  return records
    .map(toLogLine)
    .sort((a, b) => a.timestampMs - b.timestampMs || a.source.localeCompare(b.source))
}

export function clearLogRecords(sources: LogSource[]): number {
  const normalizedSources = normalizeSources(sources)
  if (normalizedSources.length === 0) return 0
  const placeholders = normalizedSources.map(() => '?').join(', ')
  return dbExecute(`DELETE FROM logs WHERE source IN (${placeholders})`, normalizedSources).changes
}

function truncateMessage(message: string): string {
  if (message.length > MESSAGE_PREVIEW_LEN) {
    return `${message.slice(0, MESSAGE_PREVIEW_LEN)}...`
  }
  return message
}

function parseAppLine(raw: string): LogLine | null {
  const match = APP_LOG_RE.exec(raw)
  if (!match) return null
  const [, dateStr, timeStr, level, target, message] = match
  const ts = new Date(`${dateStr}T${timeStr}`)
  if (Number.isNaN(ts.getTime())) return null
  return {
    source: 'app',
    timestamp: ts.toISOString(),
    timestampMs: ts.getTime(),
    level: level.toUpperCase(),
    target: target || undefined,
    message: truncateMessage(message),
    raw,
  }
}

function splitAgentRest(rest: string): { message: string; target?: string } {
  const trimmed = rest.trimEnd()
  const bracePos = trimmed.lastIndexOf('{')
  if (bracePos >= 0) {
    const msgPart = trimmed.slice(0, bracePos)
    const jsonPart = trimmed.slice(bracePos)
    try {
      const json = JSON.parse(jsonPart)
      const target = (json.agentId || json.task || undefined) as string | undefined
      return { message: msgPart.trim(), target }
    } catch {
      // ignore
    }
  }
  return { message: trimmed }
}

function parseAgentLine(raw: string): LogLine | null {
  const match = AGENT_LOG_RE.exec(raw)
  if (!match) return null
  const [, tsStr, level, rest] = match
  const ts = new Date(tsStr)
  if (Number.isNaN(ts.getTime())) return null
  const { message, target } = splitAgentRest(rest)
  return {
    source: 'agentServer',
    timestamp: ts.toISOString(),
    timestampMs: ts.getTime(),
    level: level.toUpperCase(),
    target,
    message: truncateMessage(message),
    raw,
  }
}

function parseAiLine(raw: string): LogLine | null {
  try {
    const json = JSON.parse(raw)
    const tsStr = json.ts as string | undefined
    if (!tsStr) return null
    const ts = new Date(tsStr)
    if (Number.isNaN(ts.getTime())) return null

    const ty = (json.type as string) ?? 'unknown'
    const level =
      ty === 'error'
        ? 'ERROR'
        : ty === 'warning' || ty === 'warn'
          ? 'WARN'
          : ty === 'conversation'
            ? 'DEBUG'
            : 'INFO'

    const operationId = (json.operationId as string) ?? ''
    const provider = (json.provider as string) ?? ''
    const model = (json.modelId as string) ?? ''
    const callId = (json.callId as string) ?? ''

    const message = operationId
      ? [ty, operationId, provider, model].filter(Boolean).join(' | ')
      : `${ty} ${callId}`.trim()

    return {
      source: 'aiConversations',
      timestamp: ts.toISOString(),
      timestampMs: ts.getTime(),
      level,
      target: ty,
      message: truncateMessage(message),
      raw,
    }
  } catch {
    return null
  }
}

function parseLine(source: LogSource, raw: string): LogLine | null {
  const trimmed = raw.trimEnd().trim()
  if (!trimmed) return null
  const safeRaw =
    raw.length > MAX_LINE_LENGTH ? `${raw.slice(0, MAX_LINE_LENGTH)}...(truncated)` : raw
  switch (source) {
    case 'app':
      return parseAppLine(safeRaw)
    case 'agentServer':
      return parseAgentLine(safeRaw)
    case 'aiConversations':
      return parseAiLine(safeRaw)
  }
}

async function readTailLines(
  filePath: string,
  maxBytes: number,
  maxLines: number,
): Promise<string[]> {
  let statInfo: Awaited<ReturnType<typeof fs.stat>>
  try {
    statInfo = await fs.stat(filePath)
  } catch {
    return []
  }
  const size = statInfo.size
  if (size === 0) return []
  const start = size <= maxBytes ? 0 : size - maxBytes
  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(Number(size - start))
    await handle.read(buffer, 0, buffer.length, Number(start))
    let text = buffer.toString('utf-8')
    if (start > 0 && text.includes('\n')) {
      text = text.slice(text.indexOf('\n') + 1)
    }
    const lines = text.split('\n')
    if (lines.length > maxLines) {
      return lines.slice(lines.length - maxLines)
    }
    return lines
  } finally {
    await handle.close()
  }
}

async function readNewData(
  filePath: string,
  lastPos: number,
  pendingRef: { value: string },
): Promise<{ lines: string[]; newPos: number; rotated: boolean }> {
  let statInfo: Awaited<ReturnType<typeof fs.stat>>
  try {
    statInfo = await fs.stat(filePath)
  } catch (e) {
    throw new Error(`failed to read log metadata: ${(e as Error).message}`)
  }
  const size = statInfo.size

  if (size < lastPos) {
    pendingRef.value = ''
    const lines = await readTailLines(
      filePath,
      DEFAULT_MAX_INITIAL_BYTES,
      DEFAULT_MAX_INITIAL_LINES,
    )
    return { lines, newPos: size, rotated: true }
  }

  if (size === lastPos) {
    return { lines: [], newPos: lastPos, rotated: false }
  }

  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(Number(size - lastPos))
    await handle.read(buffer, 0, buffer.length, Number(lastPos))
    const text = buffer.toString('utf-8')
    const combined = pendingRef.value + text
    pendingRef.value = ''
    const lines = combined.split('\n')
    if (!combined.endsWith('\n')) {
      pendingRef.value = lines.pop() ?? ''
    }
    return { lines, newPos: size, rotated: false }
  } finally {
    await handle.close()
  }
}

interface SourceState {
  source: LogSource
  path: string
  position: number
  pending: { value: string }
}

function runDatabaseStream(
  streamId: string,
  sender: WebContents,
  sources: LogSource[],
  options: StreamOptions,
): void {
  const normalizedSources = normalizeSources(sources)
  const stream = activeStreams.get(streamId)
  if (!stream || normalizedSources.length === 0) return

  const maxInitialLines = options.maxInitialLines ?? DEFAULT_MAX_INITIAL_LINES
  const initialRecords = queryInitialRecords(normalizedSources, maxInitialLines)
  let lastId = initialRecords.reduce((max, record) => Math.max(max, record.id), 0)

  for (const source of normalizedSources) {
    send(sender, {
      event: 'initial',
      data: {
        source,
        lines: initialRecords.filter((record) => record.source === source).map(toLogLine),
      },
    })
  }

  if (options.tail === false) return

  const poll = async () => {
    const currentStream = activeStreams.get(streamId)
    if (!currentStream || currentStream.cancel || currentStream.pollInFlight) return
    currentStream.pollInFlight = true
    try {
      const newRecords = queryRecordsAfterId(normalizedSources, lastId, DEFAULT_MAX_QUERY_LINES)
      if (newRecords.length === 0) return
      lastId = newRecords[newRecords.length - 1]?.id ?? lastId

      for (const source of normalizedSources) {
        const lines = newRecords.filter((record) => record.source === source).map(toLogLine)
        if (lines.length > 0) {
          send(sender, { event: 'newLines', data: { source, lines } })
        }
      }
    } catch {
      if (currentStream.fallbackStarted) return
      currentStream.fallbackStarted = true
      if (currentStream.interval) {
        clearInterval(currentStream.interval)
        currentStream.interval = undefined
      }
      void runFileStream(streamId, sender, normalizedSources, {
        maxInitialLines,
        tail: true,
      }).catch((fallbackError) => {
        send(sender, {
          event: 'error',
          data: { source: 'app', message: (fallbackError as Error).message },
        })
      })
    } finally {
      currentStream.pollInFlight = false
    }
  }

  stream.interval = setInterval(() => void poll(), DEFAULT_POLL_INTERVAL_MS)
}

async function runFileStream(
  streamId: string,
  sender: WebContents,
  sources: LogSource[],
  options: StreamOptions,
): Promise<void> {
  const maxInitialLines = options.maxInitialLines ?? DEFAULT_MAX_INITIAL_LINES
  const tail = options.tail ?? true
  const intervalMs = DEFAULT_POLL_INTERVAL_MS

  const sourceStates: SourceState[] = []

  for (const source of sources) {
    if (activeStreams.get(streamId)?.cancel) return
    const filePath = sourcePath(source)
    try {
      const lines = await readTailLines(filePath, DEFAULT_MAX_INITIAL_BYTES, maxInitialLines)
      if (activeStreams.get(streamId)?.cancel) return
      const parsed = lines
        .map((line) => parseLine(source, line))
        .filter((line): line is LogLine => line !== null)
      send(sender, { event: 'initial', data: { source, lines: parsed } })
      let statInfo: Awaited<ReturnType<typeof fs.stat>>
      try {
        statInfo = await fs.stat(filePath)
      } catch {
        statInfo = { size: 0 } as Awaited<ReturnType<typeof fs.stat>>
      }
      sourceStates.push({
        source,
        path: filePath,
        position: Number(statInfo.size),
        pending: { value: '' },
      })
    } catch (e) {
      send(sender, {
        event: 'error',
        data: { source, message: (e as Error).message },
      })
      sourceStates.push({ source, path: filePath, position: 0, pending: { value: '' } })
    }
  }

  if (!tail) return

  const stream = activeStreams.get(streamId)
  if (!stream) return

  stream.interval = setInterval(() => {
    if (stream.cancel || stream.pollInFlight) return
    stream.pollInFlight = true
    void (async () => {
      try {
        for (const state of sourceStates) {
          if (stream.cancel) return
          try {
            const { lines, newPos, rotated } = await readNewData(
              state.path,
              state.position,
              state.pending,
            )
            state.position = newPos
            if (lines.length === 0) continue
            const parsed = lines
              .map((line) => parseLine(state.source, line))
              .filter((line): line is LogLine => line !== null)
            send(sender, {
              event: rotated ? 'reset' : 'newLines',
              data: { source: state.source, lines: parsed },
            })
          } catch (e) {
            send(sender, {
              event: 'error',
              data: { source: state.source, message: (e as Error).message },
            })
          }
        }
      } finally {
        stream.pollInFlight = false
      }
    })()
  }, intervalMs)
}

export async function startLogStream(
  sender: WebContents,
  sources: LogSource[],
  options: StreamOptions,
): Promise<string> {
  const streamId = `log-stream-${nextStreamId++}`
  activeStreams.set(streamId, { cancel: false, sender })
  try {
    runDatabaseStream(streamId, sender, sources, options)
  } catch {
    void runFileStream(streamId, sender, sources, options).catch((e) => {
      send(sender, {
        event: 'error',
        data: { source: 'app', message: (e as Error).message },
      })
    })
  }
  return streamId
}

export function stopLogStream(streamId: string): void {
  const stream = activeStreams.get(streamId)
  if (!stream) return
  stream.cancel = true
  if (stream.interval) {
    clearInterval(stream.interval)
  }
  activeStreams.delete(streamId)
}

export async function exportLog(source: LogSource, destPath: string): Promise<void> {
  try {
    const records = queryRecordsForSource(source)
    const content = records.length > 0 ? `${records.map((record) => record.raw).join('\n')}\n` : ''
    await fs.writeFile(destPath, content, 'utf8')
  } catch {
    const src = sourcePath(source)
    await fs.copyFile(src, destPath)
  }
}
