import fs from 'fs'
import path from 'path'

import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

import { IPC_CHANNELS } from './ipc-channels'

let updateWindow: BrowserWindow | null = null

export function setupUpdater(mainWindow: BrowserWindow): void {
  updateWindow = mainWindow

  autoUpdater.on('checking-for-update', () => {
    send(IPC_CHANNELS.UPDATER_EVENT, { event: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    send(IPC_CHANNELS.UPDATER_EVENT, { event: 'available', data: info })
  })

  autoUpdater.on('update-not-available', (info) => {
    send(IPC_CHANNELS.UPDATER_EVENT, { event: 'notAvailable', data: info })
  })

  autoUpdater.on('download-progress', (progress) => {
    send(IPC_CHANNELS.UPDATER_EVENT, { event: 'progress', data: progress })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send(IPC_CHANNELS.UPDATER_EVENT, { event: 'downloaded', data: info })
  })

  autoUpdater.on('error', (error) => {
    send(IPC_CHANNELS.UPDATER_EVENT, { event: 'error', data: { message: error.message } })
  })
}

function send(channel: string, payload: unknown): void {
  updateWindow?.webContents.send(channel, payload)
}

function hasUpdateConfig(): boolean {
  if (!app.isPackaged) return false
  const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml')
  return fs.existsSync(updateConfigPath)
}

export async function checkForUpdates(): Promise<unknown> {
  if (!hasUpdateConfig()) {
    return null
  }
  return autoUpdater.checkForUpdates()
}

export async function downloadAndInstall(): Promise<void> {
  await autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}

export function relaunchApp(): void {
  app.relaunch()
  app.quit()
}
