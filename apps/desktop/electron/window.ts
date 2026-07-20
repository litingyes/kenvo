import path from 'path'

import { BrowserWindow, app, screen } from 'electron'
import windowStateKeeper from 'electron-window-state'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

const rendererUrl = process.env.ELECTRON_RENDERER_URL

export function createMainWindow(): BrowserWindow {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  })

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 800,
    minHeight: 500,
    title: 'Kenvo',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 20 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindowState.manage(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev && rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools()
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  return mainWindow
}

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow) {
    settingsWindow.focus()
    return settingsWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 480,
    minWidth: 540,
    minHeight: 360,
    title: 'Settings',
    show: false,
    x: Math.round(screenWidth / 2 - 360),
    y: 120,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show()
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  if (isDev && rendererUrl) {
    void settingsWindow.loadURL(`${rendererUrl}#/settings`)
  } else {
    void settingsWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      hash: 'settings',
    })
  }

  return settingsWindow
}
