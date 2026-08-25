import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from './ipc-channels'
import { normalizePlatform } from './platform'
import type { TrafficLightInset } from './traffic-light'

const api = {
  platform: normalizePlatform(process.platform),
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  listen: (channel: string, callback: (payload: unknown) => void) => {
    const fn = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on(channel, fn)
    return () => {
      ipcRenderer.removeListener(channel, fn)
    }
  },

  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    relaunch: () => ipcRenderer.invoke(IPC_CHANNELS.APP_RELAUNCH),
  },

  agentServer: {
    start: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_SERVER_START),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_SERVER_STOP),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_SERVER_STATUS),
    port: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_SERVER_PORT),
    onStopped: (callback: () => void) => {
      const fn = () => callback()
      ipcRenderer.on(IPC_CHANNELS.AGENT_SERVER_STOPPED, fn)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_SERVER_STOPPED, fn)
      }
    },
  },

  os: {
    getType: () => ipcRenderer.invoke(IPC_CHANNELS.OS_GET_TYPE),
    getLocale: () => ipcRenderer.invoke(IPC_CHANNELS.OS_GET_LOCALE),
  },

  window: {
    getLabel: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_LABEL),
    getTrafficLightInset: (): Promise<TrafficLightInset> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_TRAFFIC_LIGHT_INSET),
  },

  path: {
    homeDir: () => ipcRenderer.invoke(IPC_CHANNELS.PATH_GET_HOME_DIR),
    getAppPaths: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_PATHS),
    openAppFolder: (kind: 'log' | 'data') => ipcRenderer.invoke(IPC_CHANNELS.OPEN_APP_FOLDER, kind),
  },

  resources: {
    readLocale: (language: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.RESOURCES_READ_LOCALE, language),
  },

  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, text),
  },

  dialog: {
    showSaveDialog: (options: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SHOW_SAVE, options),
    showOpenDialog: (options: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SHOW_OPEN, options),
    showMessageBox: (options: Electron.MessageBoxOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SHOW_MESSAGE, options),
  },

  fs: {
    readDir: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_DIR, path),
    stat: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_STAT, path),
    lstat: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_LSTAT, path),
    readTextFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_TEXT_FILE, path),
    readFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, path),
    writeTextFile: (path: string, content: string, options?: { append?: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_TEXT_FILE, path, content, options),
    writeFile: (path: string, content: Uint8Array, options?: { append?: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_FILE, path, content, options),
    exists: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_EXISTS, path),
    mkdir: (path: string, recursive?: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_MKDIR, path, recursive),
    remove: (path: string, recursive?: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_REMOVE, path, recursive),
    copyFile: (src: string, dest: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_COPY_FILE, src, dest),
    rename: (src: string, dest: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_RENAME, src, dest),
    watch: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_WATCH, path),
    unwatch: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_UNWATCH, path),
    onFileChanged: (callback: (payload: { path: string; eventType: string }) => void) => {
      const fn = (
        _event: Electron.IpcRendererEvent,
        payload: { path: string; eventType: string },
      ) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.FS_FILE_CHANGED, fn)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.FS_FILE_CHANGED, fn)
      }
    },
  },

  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, filePath),
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
  },

  db: {
    select: <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_SELECT, sql, params),
    execute: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_EXECUTE, sql, params),
  },

  log: {
    trace: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG, 'trace', message),
    debug: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG, 'debug', message),
    info: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG, 'info', message),
    warn: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG, 'warn', message),
    error: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG, 'error', message),
  },

  updater: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),
    downloadAndInstall: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD_INSTALL),
    onEvent: (callback: (payload: unknown) => void) => {
      const fn = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.UPDATER_EVENT, fn)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_EVENT, fn)
      }
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
