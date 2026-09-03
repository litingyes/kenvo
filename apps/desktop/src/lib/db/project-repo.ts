import { getDatabase } from './schema'

export interface Project {
  id: string
  path: string
  title: string
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
  await db.execute(`DELETE FROM projects WHERE id = ?`, [id])
}
