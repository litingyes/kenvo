import path from 'path'

import { BrowserWindow, Menu, app, screen } from 'electron'
import windowStateKeeper from 'electron-window-state'

import { IPC_CHANNELS } from './ipc-channels'
import { isMacOS } from './platform'
import { getTrafficLightPosition } from './traffic-light'

function setupDevContextMenu(contents: Electron.WebContents): void {
  contents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Inspect Element',
        click: () => {
          if (!contents.isDevToolsOpened()) {
            contents.openDevTools({ mode: 'detach' })
          }
          contents.inspectElement(params.x, params.y)
        },
      },
      { type: 'separator' },
      { role: 'reload' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ])
    menu.popup()
  })
}

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
    titleBarStyle: isMacOS() ? 'hidden' : 'default',
    trafficLightPosition: isMacOS() ? getTrafficLightPosition() : undefined,
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
    if (process.env.KENVO_DEVTOOLS !== '0') {
      mainWindow.webContents.openDevTools()
    }
    setupDevContextMenu(mainWindow.webContents)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  return mainWindow
}

export function createSettingsWindow(route = 'settings'): BrowserWindow {
  if (settingsWindow) {
    settingsWindow.focus()
    settingsWindow.webContents.send(IPC_CHANNELS.NAVIGATE, { path: `/${route}` })
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
    void settingsWindow.loadURL(`${rendererUrl}#/${route}`)
    setupDevContextMenu(settingsWindow.webContents)
  } else {
    void settingsWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      hash: route,
    })
  }

  return settingsWindow
}
