import { api } from '@/lib/electron/api'
import i18n from '@/lib/i18n'

async function runShell(cmd: string, cwd: string = '/'): Promise<void> {
  const { code, stderr } = await api.shell.execute('/bin/sh', ['-c', cmd], { cwd })
  if (code !== 0) {
    const message = stderr?.trim() || i18n.t('errors.commandFailed', { code })
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
  await api.clipboard.writeText(text)
}
