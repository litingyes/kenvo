import { api } from '@/lib/electron/api'
import type { ShellAdapter } from '@/lib/terminal/shell-adapter'

const instances = new Map<string, ShellAdapter>()

export function registerTerminalInstance(sessionId: string, adapter: ShellAdapter): void {
  instances.set(sessionId, adapter)
}

export function unregisterTerminalInstance(sessionId: string): void {
  instances.delete(sessionId)
}

export function getTerminalInstance(sessionId: string): ShellAdapter | undefined {
  return instances.get(sessionId)
}

export async function destroyTerminalInstance(sessionId: string): Promise<void> {
  const adapter = instances.get(sessionId)
  if (adapter) {
    adapter.destroy()
    instances.delete(sessionId)
  }
}

export function insertCommandIntoTerminal(sessionId: string, command: string): void {
  const adapter = instances.get(sessionId)
  if (adapter) adapter.insertCommand(command)
}

export async function killTerminalByPid(pid: number): Promise<void> {
  try {
    await api.shell.kill(pid)
  } catch {
    // ignore
  }
}
