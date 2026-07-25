import path from 'node:path'

import { getDatabase } from '@/lib/db/schema'
import type { Workspace, WorkspaceTab, WorkspaceTabType } from '@/lib/terminal/types'

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

function rowToWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: row.id as string,
    path: row.path as string,
    title: (row.title as string | null) ?? null,
    created_at: row.created_at as number,
    last_active_at: row.last_active_at as number,
  }
}

function rowToTab(row: Record<string, unknown>): WorkspaceTab {
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    type: row.type as WorkspaceTabType,
    ref: row.ref as string,
    title: (row.title as string | null) ?? null,
    position: row.position as number,
    created_at: row.created_at as number,
    last_active_at: row.last_active_at as number,
  }
}

export async function createWorkspace(folderPath: string, title?: string): Promise<Workspace> {
  const db = await getDatabase()
  const id = uuid()
  const ts = now()
  await db.execute(
    'INSERT INTO workspaces (id, path, title, created_at, last_active_at) VALUES ($1, $2, $3, $4, $5)',
    [id, folderPath, title ?? path.basename(folderPath), ts, ts],
  )
  return {
    id,
    path: folderPath,
    title: title ?? path.basename(folderPath),
    created_at: ts,
    last_active_at: ts,
  }
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const db = await getDatabase()
  const rows = (await db.select('SELECT * FROM workspaces WHERE id = $1', [id])) as Record<
    string,
    unknown
  >[]
  return rows.length > 0 ? rowToWorkspace(rows[0]!) : null
}

export async function getWorkspaceByPath(folderPath: string): Promise<Workspace | null> {
  const db = await getDatabase()
  const rows = (await db.select('SELECT * FROM workspaces WHERE path = $1', [
    folderPath,
  ])) as Record<string, unknown>[]
  return rows.length > 0 ? rowToWorkspace(rows[0]!) : null
}

export async function getRecentWorkspace(): Promise<Workspace | null> {
  const db = await getDatabase()
  const rows = (await db.select(
    'SELECT * FROM workspaces ORDER BY last_active_at DESC LIMIT 1',
  )) as Record<string, unknown>[]
  return rows.length > 0 ? rowToWorkspace(rows[0]!) : null
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const db = await getDatabase()
  const rows = (await db.select('SELECT * FROM workspaces ORDER BY last_active_at DESC')) as Record<
    string,
    unknown
  >[]
  return rows.map(rowToWorkspace)
}

export async function touchWorkspace(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE workspaces SET last_active_at = $1 WHERE id = $2', [now(), id])
}

export async function updateWorkspaceTitle(id: string, title: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE workspaces SET title = $1 WHERE id = $2', [title, id])
}

export async function findOrCreateWorkspaceByPath(
  folderPath: string,
  title?: string,
): Promise<Workspace> {
  const existing = await getWorkspaceByPath(folderPath)
  if (existing) return existing
  return createWorkspace(folderPath, title)
}

export async function deleteWorkspace(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM workspace_tabs WHERE workspace_id = $1', [id])
  await db.execute(
    'DELETE FROM terminal_history WHERE session_id IN (SELECT id FROM terminal_sessions WHERE workspace_id = $1)',
    [id],
  )
  await db.execute('DELETE FROM terminal_sessions WHERE workspace_id = $1', [id])
  await db.execute('DELETE FROM workspaces WHERE id = $1', [id])
}

// ---- Tabs ----

export async function createTab(
  workspaceId: string,
  type: WorkspaceTabType,
  ref: string,
  title?: string,
): Promise<WorkspaceTab> {
  const db = await getDatabase()
  const id = uuid()
  const ts = now()
  await db.execute(
    'INSERT INTO workspace_tabs (id, workspace_id, type, ref, title, position, created_at, last_active_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, workspaceId, type, ref, title ?? null, ts, ts, ts],
  )
  return {
    id,
    workspace_id: workspaceId,
    type,
    ref,
    title: title ?? null,
    position: ts,
    created_at: ts,
    last_active_at: ts,
  }
}

export async function listTabs(workspaceId: string): Promise<WorkspaceTab[]> {
  const db = await getDatabase()
  const rows = (await db.select(
    'SELECT * FROM workspace_tabs WHERE workspace_id = $1 ORDER BY position ASC',
    [workspaceId],
  )) as Record<string, unknown>[]
  return rows.map(rowToTab)
}

export async function getTab(id: string): Promise<WorkspaceTab | null> {
  const db = await getDatabase()
  const rows = (await db.select('SELECT * FROM workspace_tabs WHERE id = $1', [id])) as Record<
    string,
    unknown
  >[]
  return rows.length > 0 ? rowToTab(rows[0]!) : null
}

export async function updateTabTitle(id: string, title: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE workspace_tabs SET title = $1 WHERE id = $2', [title, id])
}

export async function touchTab(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE workspace_tabs SET last_active_at = $1 WHERE id = $2', [now(), id])
}

export async function setTabPosition(id: string, position: number): Promise<void> {
  const db = await getDatabase()
  await db.execute('UPDATE workspace_tabs SET position = $1 WHERE id = $2', [position, id])
}

export async function deleteTab(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM workspace_tabs WHERE id = $1', [id])
}

export async function deleteTabsByWorkspace(workspaceId: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM workspace_tabs WHERE workspace_id = $1', [workspaceId])
}
