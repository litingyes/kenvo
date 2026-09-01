import { Agent, type AgentEvent } from '@earendil-works/pi-agent-core'
import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type { Model } from '@earendil-works/pi-ai'

import { serverLog, writeAiRecord } from './logging.js'
import { clearProposals } from './proposals.js'
import {
  getModelsCollection,
  getProviderInstance,
  listModels,
  type ProviderId,
} from './providers.js'
import { buildSystemPrompt, getSkill } from './skills.js'
import { createFsTools } from './tools/fs-tools.js'

interface SessionEntry {
  agent: Agent
  skillId: string
  projectRoot: string
  providerId: string
  modelId: string
  createdAt: number
  writePolicy: 'direct' | 'proposal'
}

const sessions = new Map<string, SessionEntry>()

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message)
  }
}

async function resolveModel(providerId: string, modelId: string): Promise<Model<never>> {
  const instance = getProviderInstance(providerId as ProviderId)
  if (!instance?.apiKey) {
    throw new SessionError(`Provider not configured: ${providerId}`, 400)
  }

  // Ensure dynamic (non-catalog) models are available.
  const available = await listModels(instance)
  const found = available.find((m) => m.id === modelId)
  if (!found) {
    throw new SessionError(`Unknown model: ${providerId}/${modelId}`, 404)
  }
  return found as Model<never>
}

export interface CreateSessionOptions {
  sessionId: string
  skillId: string
  projectRoot: string
  providerId: string
  modelId: string
  /** Prior transcript to resume from (pi AgentMessage JSON). */
  history?: AgentMessage[]
  writePolicy?: 'direct' | 'proposal'
}

export async function createSession(options: CreateSessionOptions): Promise<void> {
  const skill = getSkill(options.skillId)
  if (!skill) {
    throw new SessionError(`Unknown skill: ${options.skillId}`, 404)
  }

  const model = await resolveModel(options.providerId, options.modelId)
  const models = getModelsCollection()
  const writePolicy =
    options.writePolicy ?? (options.skillId === 'screenwriter' ? 'proposal' : 'direct')

  const agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(skill),
      model,
      tools: createFsTools(options.projectRoot, {
        sessionId: options.sessionId,
        writePolicy,
      }),
      messages: options.history ?? [],
    },
    streamFn: models.streamSimple.bind(models),
    sessionId: options.sessionId,
  })

  sessions.set(options.sessionId, {
    agent,
    skillId: options.skillId,
    projectRoot: options.projectRoot,
    providerId: options.providerId,
    modelId: options.modelId,
    createdAt: Date.now(),
    writePolicy,
  })

  serverLog('info', 'session created', {
    sessionId: options.sessionId,
    skillId: options.skillId,
    providerId: options.providerId,
    modelId: options.modelId,
    resumedMessages: options.history?.length ?? 0,
  })
}

export function getSession(sessionId: string): SessionEntry | undefined {
  return sessions.get(sessionId)
}

export function destroySession(sessionId: string): void {
  const entry = sessions.get(sessionId)
  if (!entry) return
  if (entry.agent.state.isStreaming) {
    entry.agent.abort()
  }
  sessions.delete(sessionId)
  clearProposals(sessionId)
  serverLog('info', 'session destroyed', { sessionId })
}

/**
 * Run one prompt turn, forwarding every agent event to `onEvent`.
 * Resolves with the final transcript when the run settles.
 */
export async function runPrompt(
  sessionId: string,
  input: string,
  onEvent: (event: AgentEvent) => void,
): Promise<AgentMessage[]> {
  const entry = sessions.get(sessionId)
  if (!entry) {
    throw new SessionError(`Unknown session: ${sessionId}`, 404)
  }
  if (entry.agent.state.isStreaming) {
    throw new SessionError('Session is busy; steer or abort the current run first', 409)
  }

  const startedAt = Date.now()
  const unsubscribe = entry.agent.subscribe((event) => {
    onEvent(event)
    if (event.type === 'message_end' && event.message.role === 'assistant') {
      const usage = event.message.usage
      writeAiRecord({
        type: 'assistant-message',
        sessionId,
        agentId: entry.skillId,
        provider: entry.providerId,
        model: entry.modelId,
        stopReason: event.message.stopReason,
        usage: usage
          ? {
              input: usage.input,
              output: usage.output,
              cost: usage.cost?.total,
            }
          : undefined,
      })
    }
  })

  try {
    await entry.agent.prompt(input)
    serverLog('info', 'prompt run finished', {
      sessionId,
      durationMs: Date.now() - startedAt,
      messages: entry.agent.state.messages.length,
    })
    return entry.agent.state.messages
  } finally {
    unsubscribe()
  }
}

export function steerSession(sessionId: string, input: string): void {
  const entry = sessions.get(sessionId)
  if (!entry) {
    throw new SessionError(`Unknown session: ${sessionId}`, 404)
  }
  if (!entry.agent.state.isStreaming) {
    throw new SessionError('Session is not running; send a normal message instead', 409)
  }
  entry.agent.steer({ role: 'user', content: input, timestamp: Date.now() })
  serverLog('info', 'steer queued', { sessionId })
}

export function abortSession(sessionId: string): void {
  const entry = sessions.get(sessionId)
  if (!entry) {
    throw new SessionError(`Unknown session: ${sessionId}`, 404)
  }
  entry.agent.abort()
  serverLog('info', 'session aborted', { sessionId })
}

export function getSessionMessages(sessionId: string): AgentMessage[] {
  const entry = sessions.get(sessionId)
  if (!entry) {
    throw new SessionError(`Unknown session: ${sessionId}`, 404)
  }
  return entry.agent.state.messages
}
