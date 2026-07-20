import { api } from '@/lib/electron/api'

export const logger = {
  trace: (message: string) => api.log.trace(message),
  debug: (message: string) => api.log.debug(message),
  info: (message: string) => api.log.info(message),
  warn: (message: string) => api.log.warn(message),
  error: (message: string) => api.log.error(message),
}

export function initErrorLogging(): void {
  window.addEventListener('error', (event) => {
    void logger.error(`[window.onerror] ${event.message} @ ${event.filename}:${event.lineno}`)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
    void logger.error(`[unhandledrejection] ${detail}`)
  })

  void logger.info('frontend logger initialized')
}
