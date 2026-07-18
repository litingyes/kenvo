import { Channel, invoke } from '@tauri-apps/api/core'

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

export interface LogFilter {
  keyword: string
  level: LogLevel | 'all'
}

export const ALL_SOURCES: LogSource[] = ['app', 'agentServer', 'aiConversations']

export function streamLog(
  sources: LogSource[],
  options: StreamOptions,
  onEvent: (event: LogStreamEvent) => void,
): Promise<string> {
  const channel = new Channel<LogStreamEvent>()
  channel.onmessage = (event) => {
    onEvent(event)
  }
  return invoke<string>('stream_log', {
    channel,
    sources,
    options,
  })
}

export function stopLogStream(streamId: string): Promise<void> {
  return invoke('stop_log_stream', { streamId })
}

export function exportLog(source: LogSource, destPath: string): Promise<void> {
  return invoke('export_log', { source, destPath })
}

export function isHigherOrEqualLevel(level: LogLevel, threshold: LogLevel): boolean {
  const order: LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'UNKNOWN']
  return order.indexOf(level) >= order.indexOf(threshold)
}
