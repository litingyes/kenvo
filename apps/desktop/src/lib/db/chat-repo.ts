import { getDatabase } from './schema'

export interface ChatSession {
  id: string
  project_id: string
  skill_id: string
  title: string | null
  provider_id: string | null
  model_id: string | null
  created_at: number
  last_active_at: number
}

export interface ChatMessageRow {
  id: number
  session_id: string
  seq: number
  role: string
  message: string
  created_at: number
}

function genId(): string {
  return crypto.randomUUID()
}

// ---------- Sessions ----------

export async function createChatSession(
  projectId: string,
  skillId: string,
  providerId?: string,
  modelId?: string,
): Promise<ChatSession> {
  const db = await getDatabase()
  const now = Date.now()
  const session: ChatSession = {
    id: genId(),
    project_id: projectId,
    skill_id: skillId,
    title: null,
    provider_id: providerId ?? null,
    model_id: modelId ?? null,
    created_at: now,
    last_active_at: now,
  }
  await db.execute(
    `INSERT INTO chat_sessions
       (id, project_id, skill_id, title, provider_id, model_id, created_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.project_id,
      session.skill_id,
      session.title,
      session.provider_id,
      session.model_id,
      now,
      now,
    ],
  )
  return session
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const db = await getDatabase()
  const rows = await db.select<ChatSession>(`SELECT * FROM chat_sessions WHERE id = ?`, [id])
  return rows[0] ?? null
}

export async function listChatSessions(projectId: string): Promise<ChatSession[]> {
  const db = await getDatabase()
  return db.select<ChatSession>(
    `SELECT * FROM chat_sessions WHERE project_id = ? ORDER BY last_active_at DESC`,
    [projectId],
  )
}

/** All sessions across projects, most recently active first. */
export async function listAllChatSessions(): Promise<ChatSession[]> {
  const db = await getDatabase()
  return db.select<ChatSession>(`SELECT * FROM chat_sessions ORDER BY last_active_at DESC`)
}

export async function updateChatSessionTitle(id: string, title: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(`UPDATE chat_sessions SET title = ? WHERE id = ?`, [title, id])
}

/** Update the session's skill / model selection (used when the user switches either in chat). */
export async function updateChatSessionConfig(
  id: string,
  config: { skillId?: string; providerId?: string; modelId?: string },
): Promise<void> {
  const db = await getDatabase()
  if (config.skillId !== undefined) {
    await db.execute(`UPDATE chat_sessions SET skill_id = ? WHERE id = ?`, [config.skillId, id])
  }
  if (config.providerId !== undefined) {
    await db.execute(`UPDATE chat_sessions SET provider_id = ? WHERE id = ?`, [
      config.providerId,
      id,
    ])
  }
  if (config.modelId !== undefined) {
    await db.execute(`UPDATE chat_sessions SET model_id = ? WHERE id = ?`, [config.modelId, id])
  }
}

export async function touchChatSession(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(`UPDATE chat_sessions SET last_active_at = ? WHERE id = ?`, [Date.now(), id])
}

export async function deleteChatSession(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute(`DELETE FROM chat_messages WHERE session_id = ?`, [id])
  await db.execute(`DELETE FROM chat_sessions WHERE id = ?`, [id])
}

// ---------- Messages ----------

export async function appendChatMessage(
  sessionId: string,
  role: string,
  messageJson: string,
): Promise<void> {
  const db = await getDatabase()
  const rows = await db.select<{ max_seq: number | null }>(
    `SELECT MAX(seq) AS max_seq FROM chat_messages WHERE session_id = ?`,
    [sessionId],
  )
  const seq = (rows[0]?.max_seq ?? -1) + 1
  await db.execute(
    `INSERT INTO chat_messages (session_id, seq, role, message, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, seq, role, messageJson, Date.now()],
  )
}

export async function listChatMessages(sessionId: string): Promise<ChatMessageRow[]> {
  const db = await getDatabase()
  return db.select<ChatMessageRow>(
    `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY seq ASC`,
    [sessionId],
  )
}

export async function countChatMessages(sessionId: string): Promise<number> {
  const db = await getDatabase()
  const rows = await db.select<{ n: number }>(
    `SELECT COUNT(*) AS n FROM chat_messages WHERE session_id = ?`,
    [sessionId],
  )
  return rows[0]?.n ?? 0
}
