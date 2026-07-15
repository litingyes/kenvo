import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { Command } from '@tauri-apps/plugin-shell'

import i18n from '@/lib/i18n'

async function runShell(cmd: string, cwd: string = '/'): Promise<void> {
  const result = await Command.create('run-zsh', ['-c', cmd], { cwd }).execute()
  if (result.code !== 0) {
    const message = result.stderr?.trim() || i18n.t('errors.commandFailed', { code: result.code })
    throw new Error(message)
  }
}

export async function revealInFinder(path: string): Promise<void> {
  await runShell(`open -R ${JSON.stringify(path)}`)
}

export async function openInEditor(path: string, cli: string): Promise<void> {
  await runShell(`${cli} ${JSON.stringify(path)}`)
}

export async function copyToClipboard(text: string): Promise<void> {
  await writeText(text)
}
