import { debug, error, info, trace, warn } from '@tauri-apps/plugin-log'

export const logger = { trace, debug, info, warn, error }

export function initErrorLogging(): void {
  window.addEventListener('error', (event) => {
    void error(`[window.onerror] ${event.message} @ ${event.filename}:${event.lineno}`)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
    void error(`[unhandledrejection] ${detail}`)
  })

  void info('frontend logger initialized')
}
