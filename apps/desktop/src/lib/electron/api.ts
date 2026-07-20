import { IPC_CHANNELS } from '../../../electron/ipc-channels'
import type { ElectronAPI } from '../../../electron/preload'

export type { DirEntry } from '../../../electron/fs'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

const { electronAPI } = window

export function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return electronAPI.invoke(channel, ...args) as Promise<T>
}

export function listen<T = unknown>(channel: string, callback: (payload: T) => void): () => void {
  return electronAPI.listen(channel, callback as (payload: unknown) => void)
}

export const api = {
  app: electronAPI.app,
  agentServer: electronAPI.agentServer,
  os: electronAPI.os,
  window: electronAPI.window,
  path: electronAPI.path,
  resources: electronAPI.resources,
  clipboard: electronAPI.clipboard,
  dialog: electronAPI.dialog,
  fs: electronAPI.fs,
  shell: electronAPI.shell,
  db: electronAPI.db,
  log: electronAPI.log,
  updater: electronAPI.updater,
}

// Re-export channels for typed usage
export { IPC_CHANNELS }
