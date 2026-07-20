import { runExternalQuiet } from '@/lib/terminal/external-runner'
import { openInEditor } from '@/lib/terminal/opener-helpers'
import type { EditorApp } from '@/lib/terminal/types'

const EDITOR_WHITELIST: EditorApp[] = [
  { cli: 'code', name: 'VS Code' },
  { cli: 'cursor', name: 'Cursor' },
  { cli: 'zed', name: 'Zed' },
  { cli: 'subl', name: 'Sublime Text' },
  { cli: 'webstorm', name: 'WebStorm' },
  { cli: 'nvim', name: 'Neovim' },
  { cli: 'emacs', name: 'Emacs' },
]

export function getEditorWhitelist(): EditorApp[] {
  return EDITOR_WHITELIST
}

export async function detectAvailableEditors(): Promise<EditorApp[]> {
  const clis = EDITOR_WHITELIST.map((e) => e.cli)
  const cmd = `which ${clis.map((c) => JSON.stringify(c)).join(' ')} 2>/dev/null || true`
  const out = await runExternalQuiet(cmd, '/')
  const found = new Set<string>()
  for (const line of out.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split('/')
    const base = parts[parts.length - 1]
    if (base) found.add(base)
  }
  return EDITOR_WHITELIST.filter((e) => found.has(e.cli))
}

export async function openPathInEditor(path: string, cli: string): Promise<void> {
  await openInEditor(path, cli)
}
