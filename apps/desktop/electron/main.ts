import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'

import {
  broadcastAgentServerStopped,
  getAgentServerPort,
  getAgentServerStatus,
  setupAgentServerStopped,
  startAgentServer,
  stopAgentServer,
} from './agent-server'
import { dbExecute, dbSelect, initDatabase as initDb } from './db'
import {
  copyFile,
  cp,
  exists,
  lstat,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
} from './fs'
import { IPC_CHANNELS } from './ipc-channels'
import { exportLog, startLogStream, stopLogStream } from './log-viewer'
import { initLogger, logMessage } from './logger'
import { sendLanguageChangedToAllWindows, setupMenu } from './menu'
import { getAppPaths, homeDir, setTauriPaths } from './paths'
import { normalizePlatform } from './platform'
import { createPty, killAllPtys, killPty, resizePty, writePty } from './pty'
import { executeProcess, killProcess, openExternal, openPath, spawnProcess } from './shell'
import { getAiSettings, getLanguage, getTheme, setAiSettings, setLanguage, setTheme } from './store'
import { getMainWindowTrafficLightInset } from './traffic-light'
import {
  checkForUpdates,
  downloadAndInstall,
  quitAndInstall,
  relaunchApp,
  setupUpdater,
} from './updater'
import { createMainWindow, getMainWindow } from './window'

setTauriPaths()

app
  .whenReady()
  .then(async () => {
    await initLogger()
    initDb()
    setupMenu(getLanguage())
    const mainWindow = createMainWindow()
    setupUpdater(mainWindow)
    setupAgentServerStopped(() => {
      BrowserWindow.getAllWindows().forEach((win) => {
        broadcastAgentServerStopped(win.webContents)
      })
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })
  .catch((err) => {
    console.error('Failed to initialize app:', err)
    process.exit(1)
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// App / OS / Path / Window
ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => app.getVersion())
ipcMain.handle(IPC_CHANNELS.APP_RELAUNCH, () => {
  relaunchApp()
})
ipcMain.handle(IPC_CHANNELS.OS_GET_TYPE, () => normalizePlatform(process.platform))
ipcMain.handle(IPC_CHANNELS.OS_GET_LOCALE, () => app.getLocale())
ipcMain.handle(IPC_CHANNELS.PATH_GET_HOME_DIR, () => homeDir())
ipcMain.handle(IPC_CHANNELS.WINDOW_GET_LABEL, (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win === getMainWindow()) return 'main'
  return 'unknown'
})
ipcMain.handle(IPC_CHANNELS.WINDOW_GET_TRAFFIC_LIGHT_INSET, (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win === getMainWindow()) {
    return getMainWindowTrafficLightInset()
  }
  return { x: 0, y: 0, width: 0, height: 0, spacing: 0, margin: 0, paddingLeft: 0 }
})

// Resources
ipcMain.handle(IPC_CHANNELS.RESOURCES_READ_LOCALE, async (_event, language: string) => {
  const localePath = path.join(__dirname, '../../resources/locales', `${language}.json`)
  return fsPromises.readFile(localePath, 'utf-8')
})

// App paths
ipcMain.handle(IPC_CHANNELS.GET_APP_PATHS, () => getAppPaths())
ipcMain.handle(IPC_CHANNELS.OPEN_APP_FOLDER, async (_event, kind: 'log' | 'data') => {
  const { logDir, dataDir } = getAppPaths()
  const dir = kind === 'log' ? logDir : dataDir
  await shell.openPath(dir)
})

// Clipboard / Dialog
ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, async (_event, text: string) => {
  const { clipboard } = await import('electron')
  clipboard.writeText(text)
})

ipcMain.handle(
  IPC_CHANNELS.DIALOG_SHOW_SAVE,
  async (_event, options: Electron.SaveDialogOptions) => {
    const result = await dialog.showSaveDialog(options)
    return result
  },
)

ipcMain.handle(
  IPC_CHANNELS.DIALOG_SHOW_OPEN,
  async (_event, options: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(options)
    return result
  },
)

ipcMain.handle(
  IPC_CHANNELS.DIALOG_SHOW_MESSAGE,
  async (event, options: Electron.MessageBoxOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options)
    return result
  },
)

// Theme / Language / AI settings
ipcMain.handle(IPC_CHANNELS.GET_THEME, () => getTheme())
ipcMain.handle(IPC_CHANNELS.SET_THEME, (_event, mode: string) => {
  setTheme({ mode })
  const settings = getTheme()
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC_CHANNELS.THEME_CHANGED, settings)
  })
})

ipcMain.handle(IPC_CHANNELS.GET_LANGUAGE, () => getLanguage())
ipcMain.handle(IPC_CHANNELS.SET_LANGUAGE, (_event, language: string) => {
  setLanguage(language)
  setupMenu(language)
  sendLanguageChangedToAllWindows(language)
})

ipcMain.handle(IPC_CHANNELS.GET_AI_SETTINGS, () => getAiSettings())
ipcMain.handle(
  IPC_CHANNELS.SET_AI_SETTINGS,
  (_event, settings: ReturnType<typeof getAiSettings>) => {
    setAiSettings(settings)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC_CHANNELS.AI_SETTINGS_CHANGED, settings)
    })
  },
)

// DB
ipcMain.handle(IPC_CHANNELS.DB_SELECT, (_event, sql: string, params?: unknown[]) =>
  dbSelect(sql, params),
)
ipcMain.handle(IPC_CHANNELS.DB_EXECUTE, (_event, sql: string, params?: unknown[]) =>
  dbExecute(sql, params),
)

// FS
ipcMain.handle(IPC_CHANNELS.FS_READ_DIR, (_event, filePath: string) => readDir(filePath))
ipcMain.handle(IPC_CHANNELS.FS_STAT, (_event, filePath: string) => stat(filePath))
ipcMain.handle(IPC_CHANNELS.FS_LSTAT, (_event, filePath: string) => lstat(filePath))
ipcMain.handle(IPC_CHANNELS.FS_READ_TEXT_FILE, (_event, filePath: string) => readTextFile(filePath))
ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, (_event, filePath: string) => readFile(filePath))
ipcMain.handle(
  IPC_CHANNELS.FS_WRITE_TEXT_FILE,
  (_event, filePath: string, content: string, options?: { append?: boolean }) =>
    writeTextFile(filePath, content, options),
)
ipcMain.handle(
  IPC_CHANNELS.FS_WRITE_FILE,
  (_event, filePath: string, content: Uint8Array, options?: { append?: boolean }) =>
    writeFile(filePath, content, options),
)
ipcMain.handle(IPC_CHANNELS.FS_EXISTS, (_event, filePath: string) => exists(filePath))
ipcMain.handle(IPC_CHANNELS.FS_MKDIR, (_event, filePath: string, recursive?: boolean) =>
  mkdir(filePath, recursive),
)
ipcMain.handle(IPC_CHANNELS.FS_REMOVE, (_event, filePath: string, recursive?: boolean) =>
  remove(filePath, recursive),
)
ipcMain.handle(IPC_CHANNELS.FS_COPY_FILE, (_event, src: string, dest: string) =>
  copyFile(src, dest),
)
ipcMain.handle(IPC_CHANNELS.FS_RENAME, (_event, src: string, dest: string) => rename(src, dest))

// File watchers
// Watch the parent directory (not the file itself) so atomic saves that
// replace the file (git checkout, many editors) keep delivering events.
type DirWatcherEntry = {
  watcher: fs.FSWatcher
  files: Map<string, Set<Electron.WebContents>>
}

const dirWatchers = new Map<string, DirWatcherEntry>()
const watchedSenders = new WeakSet<Electron.WebContents>()

function ensureFileWatcher(filePath: string, sender: Electron.WebContents) {
  const dir = path.dirname(filePath)
  let entry = dirWatchers.get(dir)
  if (!entry) {
    const newEntry: DirWatcherEntry = {
      watcher: undefined as unknown as fs.FSWatcher,
      files: new Map(),
    }
    newEntry.watcher = fs.watch(dir, (eventType, filename) => {
      if (!filename) return
      for (const [watchedPath, subscribers] of newEntry.files) {
        if (path.basename(watchedPath) !== filename) continue
        for (const wc of subscribers) {
          if (!wc.isDestroyed()) {
            wc.send(IPC_CHANNELS.FS_FILE_CHANGED, { path: watchedPath, eventType })
          }
        }
      }
    })
    dirWatchers.set(dir, newEntry)
    entry = newEntry
  }

  let subscribers = entry.files.get(filePath)
  if (!subscribers) {
    subscribers = new Set()
    entry.files.set(filePath, subscribers)
  }
  subscribers.add(sender)

  if (!watchedSenders.has(sender)) {
    watchedSenders.add(sender)
    sender.once('destroyed', () => {
      for (const [itemDir, item] of dirWatchers) {
        for (const [itemPath, subscribers] of item.files) {
          subscribers.delete(sender)
          if (subscribers.size === 0) item.files.delete(itemPath)
        }
        if (item.files.size === 0) {
          item.watcher.close()
          dirWatchers.delete(itemDir)
        }
      }
    })
  }
}

function removeFileWatcher(filePath: string, sender: Electron.WebContents) {
  const dir = path.dirname(filePath)
  const entry = dirWatchers.get(dir)
  if (!entry) return
  const subscribers = entry.files.get(filePath)
  if (subscribers) {
    subscribers.delete(sender)
    if (subscribers.size === 0) entry.files.delete(filePath)
  }
  if (entry.files.size === 0) {
    entry.watcher.close()
    dirWatchers.delete(dir)
  }
}

ipcMain.handle(IPC_CHANNELS.FS_WATCH, (event, filePath: string) => {
  ensureFileWatcher(filePath, event.sender)
})
ipcMain.handle(IPC_CHANNELS.FS_UNWATCH, (event, filePath: string) => {
  removeFileWatcher(filePath, event.sender)
})

// Shell
ipcMain.handle(
  IPC_CHANNELS.SHELL_SPAWN,
  (
    event,
    command: string,
    args: string[],
    options: { cwd?: string; env?: Record<string, string> },
  ) => {
    return spawnProcess(event.sender, command, args, options)
  },
)
ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, (_event, url: string) => openExternal(url))
ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, (_event, filePath: string) => openPath(filePath))
ipcMain.handle(
  IPC_CHANNELS.SHELL_EXECUTE,
  (_event, command: string, args: string[], options: { cwd?: string }) =>
    executeProcess(command, args, options),
)
ipcMain.handle(IPC_CHANNELS.SHELL_CP, (_event, src: string, dest: string) => cp(src, dest))
ipcMain.handle(IPC_CHANNELS.SHELL_KILL, (_event, pid: number) => killProcess(pid))

// PTY
ipcMain.handle(IPC_CHANNELS.PTY_CREATE, (event, options: Parameters<typeof createPty>[1]) =>
  createPty(event.sender, options),
)
ipcMain.handle(IPC_CHANNELS.PTY_WRITE, (_event, sessionId: string, data: string) =>
  writePty(sessionId, data),
)
ipcMain.handle(IPC_CHANNELS.PTY_RESIZE, (_event, sessionId: string, cols: number, rows: number) =>
  resizePty(sessionId, cols, rows),
)
ipcMain.handle(IPC_CHANNELS.PTY_KILL, (_event, sessionId: string) => killPty(sessionId))

app.on('will-quit', () => {
  killAllPtys()
})

// Agent server
ipcMain.handle(IPC_CHANNELS.AGENT_SERVER_START, () => startAgentServer())
ipcMain.handle(IPC_CHANNELS.AGENT_SERVER_STOP, () => stopAgentServer())
ipcMain.handle(IPC_CHANNELS.AGENT_SERVER_STATUS, () => getAgentServerStatus())
ipcMain.handle(IPC_CHANNELS.AGENT_SERVER_PORT, () => getAgentServerPort())

// Logger
ipcMain.handle(
  IPC_CHANNELS.LOG,
  (_event, level: 'trace' | 'debug' | 'info' | 'warn' | 'error', message: string) => {
    logMessage(level, message)
  },
)

// Log viewer
ipcMain.handle(
  IPC_CHANNELS.STREAM_LOG,
  (
    event,
    {
      sources,
      options,
    }: {
      sources: import('./log-viewer').LogSource[]
      options: import('./log-viewer').StreamOptions
    },
  ) => startLogStream(event.sender, sources, options),
)
ipcMain.handle(IPC_CHANNELS.STOP_LOG_STREAM, (_event, streamId: string) => stopLogStream(streamId))
ipcMain.handle(
  IPC_CHANNELS.EXPORT_LOG,
  (_event, source: import('./log-viewer').LogSource, destPath: string) =>
    exportLog(source, destPath),
)

// Updater
ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, () => checkForUpdates())
ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD_INSTALL, async () => {
  await downloadAndInstall()
  quitAndInstall()
})
