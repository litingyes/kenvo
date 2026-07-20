import os from 'os'
import path from 'path'

import { app } from 'electron'

const TAURI_IDENTIFIER = 'app.vercel.kenvo'

function tauriAppDataDir(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support', TAURI_IDENTIFIER)
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'),
        TAURI_IDENTIFIER,
      )
    default:
      return path.join(
        process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'),
        TAURI_IDENTIFIER,
      )
  }
}

function tauriAppLogDir(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Logs', TAURI_IDENTIFIER)
    case 'win32':
      return path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'),
        TAURI_IDENTIFIER,
        'logs',
      )
    default:
      return path.join(
        process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'),
        TAURI_IDENTIFIER,
        'logs',
      )
  }
}

export function setTauriPaths(): void {
  app.setPath('userData', tauriAppDataDir())
  app.setAppLogsPath(tauriAppLogDir())
}

export function getAppPaths(): { logDir: string; dataDir: string } {
  return {
    logDir: app.getPath('logs'),
    dataDir: app.getPath('userData'),
  }
}

export function homeDir(): string {
  return os.homedir()
}
