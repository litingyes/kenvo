import fs from 'fs/promises'
import path from 'path'

import { app } from 'electron'
import electronLog from 'electron-log'

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

export function getLogFilePath(): string {
  return path.join(app.getPath('logs'), 'kenvo.log')
}
