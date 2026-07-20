import { BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron'

import { IPC_CHANNELS } from './ipc-channels'
import { createSettingsWindow } from './window'

export type MenuLanguage = 'en-US' | 'zh-CN'

interface MenuLabels {
  app: string
  about: string
  settings: string
  hide: string
  quit: string
  edit: string
  settingsWindowTitle: string
}

export function menuLabels(language: string): MenuLabels {
  if (language === 'zh-CN') {
    return {
      app: 'Kenvo',
      about: '关于 Kenvo',
      settings: '设置...',
      hide: '隐藏 Kenvo',
      quit: '退出 Kenvo',
      edit: '编辑',
      settingsWindowTitle: '设置',
    }
  }
  return {
    app: 'Kenvo',
    about: 'About Kenvo',
    settings: 'Settings...',
    hide: 'Hide Kenvo',
    quit: 'Quit Kenvo',
    edit: 'Edit',
    settingsWindowTitle: 'Settings',
  }
}

export function buildMenu(language: string): Menu {
  const labels = menuLabels(language)

  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.app,
      submenu: [
        { label: labels.about, enabled: false },
        { type: 'separator' },
        {
          label: labels.settings,
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            createSettingsWindow()
          },
        },
        { type: 'separator' },
        { label: labels.hide, role: 'hide' },
        { label: labels.quit, role: 'quit' },
      ],
    },
    {
      label: labels.edit,
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

export function setupMenu(language: string): void {
  const menu = buildMenu(language)
  Menu.setApplicationMenu(menu)
}

export function sendLanguageChangedToAllWindows(language: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(IPC_CHANNELS.LANGUAGE_CHANGED, { language })
  })
}
