import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener'

export async function revealInFinder(path: string): Promise<void> {
  await revealItemInDir(path)
}

export async function openInEditor(path: string, cli: string): Promise<void> {
  await openPath(path, cli)
}

export async function openExternal(path: string): Promise<void> {
  await openPath(path)
}

export async function copyToClipboard(text: string): Promise<void> {
  await writeText(text)
}
