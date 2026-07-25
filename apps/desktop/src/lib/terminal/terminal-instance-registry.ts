import { disposeSession, writeToPty } from '@/lib/terminal/pty-manager'

export async function destroyTerminalInstance(sessionId: string): Promise<void> {
  disposeSession(sessionId)
}

export function insertCommandIntoTerminal(sessionId: string, command: string): void {
  writeToPty(sessionId, command)
}
