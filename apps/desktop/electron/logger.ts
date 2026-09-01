import fs from 'fs/promises'
import path from 'path'

import { app } from 'electron'
import electronLog from 'electron-log'

import { insertLogRecord } from './db'

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

const LOG_FORMAT = '[{y}-{m}-{d}][{h}:{i}:{s}.{ms}][{level}][main] {text}'

export async function initLogger(): Promise<void> {
  const logDir = app.getPath('logs')
  await fs.mkdir(logDir, { recursive: true })

  const logFile = path.join(logDir, 'kenvo.log')

  electronLog.transports.file.resolvePathFn = () => logFile
  electronLog.transports.file.format = LOG_FORMAT
  electronLog.transports.console.format = LOG_FORMAT
}

export function logMessage(level: LogLevel, message: string): void {
  const timestampMs = Date.now()
  insertLogRecord({
    source: 'app',
    timestampMs,
    level: level === 'trace' ? 'TRACE' : level.toUpperCase(),
    target: 'main',
    message,
    raw: formatRawLog(timestampMs, level, message),
  })

  switch (level) {
    case 'trace':
      electronLog.verbose(message)
      break
    case 'debug':
      electronLog.debug(message)
      break
    case 'info':
      electronLog.info(message)
      break
    case 'warn':
      electronLog.warn(message)
      break
    case 'error':
      electronLog.error(message)
      break
  }
}

function formatRawLog(timestampMs: number, level: LogLevel, message: string): string {
  const date = new Date(timestampMs)
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  return `[${timestamp}][${time}][${level === 'trace' ? 'TRACE' : level.toUpperCase()}][main] ${message}`
}

export function getLogFilePath(): string {
  return path.join(app.getPath('logs'), 'kenvo.log')
}
