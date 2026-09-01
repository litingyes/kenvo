import { getDatabase } from './schema'

export interface Project {
  id: string
  path: string
  title: string
  created_at: number
  last_active_at: number
}

export interface ProjectTab {
  id: string
  project_id: string
  file_path: string
  position: number
  created_at: number
  last_active_at: number
}

function genId(): string {
  return crypto.randomUUID()
}

// ---------- Projects ----------

export async function createProject(path: string, title: string): Promise<Project> {
  const db = await getDatabase()
  const now = Date.now()
  const project: Project = {
    id: genId(),
    path,
    title,
    created_at: now,
    last_active_at: now,
  }
  await db.execute(
    `INSERT INTO projects (id, path, title, created_at, last_active_at)
     VALUES (?, ?, ?, ?, ?)`,
    [project.id, project.path, project.title, now, now],
  )
  return project
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase()
  const rows = await db.select<Project>(`SELECT * FROM projects WHERE id = ?`, [id])
  return rows[0] ?? null
}

export async function getProjectByPath(path: string): Promise<Project | null> {
  const db = await getDatabase()
  const rows = await db.select<Project>(`SELECT * FROM projects WHERE path = ?`, [path])
  return rows[0] ?? null
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDatabase()
  return db.select<Project>(`SELECT * FROM projects ORDER BY last_active_at DESC`)
}

export async function touchProject(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(`UPDATE projects SET last_active_at = ? WHERE id = ?`, [Date.now(), id])
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    `DELETE FROM chat_messages WHERE session_id IN
    (SELECT id FROM chat_sessions WHERE project_id = ?)`,
    [id],
  )
  await db.execute(`DELETE FROM chat_sessions WHERE project_id = ?`, [id])
  await db.execute(`DELETE FROM project_tabs WHERE project_id = ?`, [id])
  await db.execute(`DELETE FROM projects WHERE id = ?`, [id])
}

// ---------- Tabs ----------

export async function listTabs(projectId: string): Promise<ProjectTab[]> {
  const db = await getDatabase()
  return db.select<ProjectTab>(
    `SELECT * FROM project_tabs WHERE project_id = ? ORDER BY position ASC`,
    [projectId],
  )
}

export async function openTab(projectId: string, filePath: string): Promise<ProjectTab> {
  const db = await getDatabase()
  const existing = await db.select<ProjectTab>(
    `SELECT * FROM project_tabs WHERE project_id = ? AND file_path = ?`,
    [projectId, filePath],
  )
  if (existing[0]) {
    await db.execute(`UPDATE project_tabs SET last_active_at = ? WHERE id = ?`, [
      Date.now(),
      existing[0].id,
    ])
    return existing[0]
  }

  const maxPos = await db.select<{ max_pos: number | null }>(
    `SELECT MAX(position) AS max_pos FROM project_tabs WHERE project_id = ?`,
    [projectId],
  )
  const now = Date.now()
  const tab: ProjectTab = {
    id: genId(),
    project_id: projectId,
    file_path: filePath,
    position: (maxPos[0]?.max_pos ?? -1) + 1,
    created_at: now,
    last_active_at: now,
  }
  await db.execute(
    `INSERT INTO project_tabs (id, project_id, file_path, position, created_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tab.id, tab.project_id, tab.file_path, tab.position, now, now],
  )
  return tab
}

export async function closeTab(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(`DELETE FROM project_tabs WHERE id = ?`, [id])
}

export async function moveTab(id: string, position: number): Promise<void> {
  const db = await getDatabase()
  await db.execute(`UPDATE project_tabs SET position = ? WHERE id = ?`, [position, id])
}

export async function updateTabFilePath(
  projectId: string,
  fromPath: string,
  toPath: string,
): Promise<void> {
  const db = await getDatabase()
  await db.execute(
    `UPDATE project_tabs SET file_path = ?, last_active_at = ?
     WHERE project_id = ? AND file_path = ?`,
    [toPath, Date.now(), projectId, fromPath],
  )
}
