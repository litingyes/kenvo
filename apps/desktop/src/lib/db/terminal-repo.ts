import { getDatabase } from '@/lib/db/schema'
import { findOrCreateWorkspaceByPath } from '@/lib/db/workspace-repo'
import type { HistoryEntry, TerminalSession } from '@/lib/terminal/types'

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function now(): number {
  return Date.now()
}

function rowToSession(row: Record<string, unknown>): TerminalSession {
  return {
    id: row.id as string,
    workspace_id: (row.workspace_id as string | null) ?? '',
    title: (row.title as string | null) ?? null,
    cwd: row.cwd as string,
    created_at: row.created_at as number,
    last_active_at: row.last_active_at as number,
  }
}

function rowToHistory(row: Record<string, unknown>): HistoryEntry {
  return {
    id: row.id as number,
    session_id: row.session_id as string,
    command: row.command as string,
    cwd: row.cwd as string,
    exit_code: (row.exit_code as number | null) ?? null,
    executed_at: row.executed_at as number,
  }
}

export async function createSession(cwd: string, title?: string): Promise<TerminalSession> {
  const db = await getDatabase()
  const workspace = await findOrCreateWorkspaceByPath(cwd)
  const id = uuid()
  const ts = now()
  await db.execute(
    'INSERT INTO terminal_sessions (id, workspace_id, title, cwd, created_at, last_active_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, workspace.id, title ?? null, cwd, ts, ts],
  )
  return {
    id,
    workspace_id: workspace.id,
    title: title ?? null,
    cwd,
    created_at: ts,
    last_active_at: ts,
  }
}

export async function getRecentSession(): Promise<TerminalSession | null> {
  const db = await getDatabase()
  const rows = (await db.select(
    'SELECT * FROM terminal_sessions ORDER BY last_active_at DESC LIMIT 1',
  )) as Record<string, unknown>[]
  return rows.length > 0 ? rowToSession(rows[0]!) : null
}

export async function getSession(id: string): Promise<TerminalSession | null> {
  const db = await getDatabase()
  const rows = (await db.select('SELECT * FROM terminal_sessions WHERE id = $1', [id])) as Record<
    string,
    unknown
  >[]
  return rows.length > 0 ? rowToSession(rows[0]!) : null
}

export async function listSessions(): Promise<TerminalSession[]> {
  const db = await getDatabase()
  const rows = (await db.select(
    'SELECT * FROM terminal_sessions ORDER BY last_active_at DESC',
  )) as Record<string, unknown>[]
  return rows.map(rowToSession)
}

export async function listSessionsByWorkspace(workspaceId: string): Promise<TerminalSession[]> {
  const db = await getDatabase()
  const rows = (await db.select(
    'SELECT * FROM terminal_sessions WHERE workspace_id = $1 ORDER BY last_active_at DESC',
    [workspaceId],
  )) as Record<string, unknown>[]
  return rows.map(rowToSession)
}

export async function updateCwd(id: string, cwd: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE terminal_sessions SET cwd = $1, last_active_at = $2 WHERE id = $3', [
    cwd,
    now(),
    id,
  ])
}

export async function touchSession(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE terminal_sessions SET last_active_at = $1 WHERE id = $2', [now(), id])
}

export async function renameSession(id: string, title: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE terminal_sessions SET title = $1 WHERE id = $2', [title, id])
}

export async function duplicateSession(id: string): Promise<TerminalSession | null> {
  const db = await getDatabase()
  const rows = (await db.select('SELECT * FROM terminal_sessions WHERE id = $1', [id])) as Record<
    string,
    unknown
  >[]
  if (rows.length === 0) return null
  const src = rowToSession(rows[0]!)
  const newId = uuid()
  const ts = now()
  await db.execute(
    'INSERT INTO terminal_sessions (id, workspace_id, title, cwd, created_at, last_active_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [newId, src.workspace_id, src.title, src.cwd, ts, ts],
  )
  const histRows = (await db.select(
    'SELECT command, cwd, exit_code, executed_at FROM terminal_history WHERE session_id = $1 ORDER BY executed_at ASC',
    [id],
  )) as Record<string, unknown>[]
  for (const h of histRows) {
    await db.execute(
      'INSERT INTO terminal_history (session_id, command, cwd, exit_code, executed_at) VALUES ($1, $2, $3, $4, $5)',
      [newId, h.command, h.cwd, h.exit_code, h.executed_at],
    )
  }
  return {
    id: newId,
    workspace_id: src.workspace_id,
    title: src.title,
    cwd: src.cwd,
    created_at: ts,
    last_active_at: ts,
  }
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM terminal_history WHERE session_id = $1', [id])
  await db.execute('DELETE FROM terminal_sessions WHERE id = $1', [id])
}

export async function getHistory(sessionId: string, limit = 500): Promise<HistoryEntry[]> {
  const db = await getDatabase()
  const rows = (await db.select(
    'SELECT * FROM terminal_history WHERE session_id = $1 ORDER BY executed_at DESC LIMIT $2',
    [sessionId, limit],
  )) as Record<string, unknown>[]
  return rows.map(rowToHistory)
}

export async function addHistory(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    'INSERT INTO terminal_history (session_id, command, cwd, exit_code, executed_at) VALUES ($1, $2, $3, $4, $5)',
    [entry.session_id, entry.command, entry.cwd, entry.exit_code, entry.executed_at],
  )
}
