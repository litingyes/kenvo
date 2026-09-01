import { IPC_CHANNELS, invoke, listen } from '@/lib/electron/api'

export type LogSource = 'app' | 'agentServer' | 'aiConversations'

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'UNKNOWN'

export interface RawLogLine {
  source: LogSource
  timestamp: string
  timestampMs: number
  level: LogLevel
  target?: string
  message: string
  raw: string
}

export interface LogLine extends RawLogLine {
  id: string
}

export interface LogStreamPayload {
  source: LogSource
  lines: RawLogLine[]
}

export interface LogErrorPayload {
  source: LogSource
  message: string
}

export type LogStreamEvent =
  | { event: 'initial'; data: LogStreamPayload }
  | { event: 'newLines'; data: LogStreamPayload }
  | { event: 'reset'; data: LogStreamPayload }
  | { event: 'error'; data: LogErrorPayload }

export interface StreamOptions {
  maxInitialLines?: number
  tail?: boolean
}

export interface LogQueryOptions {
  afterId?: number
  limit?: number
  level?: LogLevel
  keyword?: string
  fromTimestampMs?: number
  toTimestampMs?: number
}

export interface LogStreamHandle {
  streamId: string
  unsubscribe: () => void
}

export interface LogFilter {
  keyword: string
  level: LogLevel | 'all'
}

export const ALL_SOURCES: LogSource[] = ['app', 'agentServer', 'aiConversations']

export async function streamLog(
  sources: LogSource[],
  options: StreamOptions,
  onEvent: (event: LogStreamEvent) => void,
): Promise<LogStreamHandle> {
  const unsubscribe = listen<LogStreamEvent>(IPC_CHANNELS.LOG_EVENT, (event) => {
    onEvent(event)
  })

  try {
    const streamId = await invoke<string>(IPC_CHANNELS.STREAM_LOG, { sources, options })
    return { streamId, unsubscribe }
  } catch (error) {
    unsubscribe()
    throw error
  }
}

export function stopLogStream(streamId: string): Promise<void> {
  return invoke(IPC_CHANNELS.STOP_LOG_STREAM, streamId)
}

export function exportLog(source: LogSource, destPath: string): Promise<void> {
  return invoke(IPC_CHANNELS.EXPORT_LOG, source, destPath)
}

export function queryLogs(sources: LogSource[], options?: LogQueryOptions): Promise<RawLogLine[]> {
  return invoke(IPC_CHANNELS.QUERY_LOGS, sources, options)
}

export function clearStoredLogs(sources: LogSource[]): Promise<number> {
  return invoke(IPC_CHANNELS.CLEAR_LOGS, sources)
}

export function isHigherOrEqualLevel(level: LogLevel, threshold: LogLevel): boolean {
  const order: LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'UNKNOWN']
  return order.indexOf(level) >= order.indexOf(threshold)
}
