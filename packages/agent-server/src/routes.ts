import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'

import { getAgent as getAgentDefinition, listAgents } from './agents/registry.js'
import { serverLog } from './logging.js'
import {
  configureProvider,
  fetchModelIds,
  getAllProviders,
  getProviderConfig,
  getProviderInstance,
  invalidateModelsCollection,
  listModels,
  testProvider,
  type ProviderId,
} from './providers.js'
import {
  abortSession,
  createSession,
  destroySession,
  getSession,
  getSessionMessages,
  runPrompt,
  SessionError,
  steerSession,
} from './sessions.js'
import type { ProviderMetadata } from './types.js'

const configureSchema = z.object({
  apiKey: z.string().nullish(),
  baseUrl: z.string().nullish(),
  enabled: z.boolean().nullish(),
})

const testSchema = z.object({
  apiKey: z.string().nullish(),
  baseUrl: z.string().nullish(),
})

const createSessionSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  projectRoot: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  history: z.array(z.unknown()).optional(),
})

const messageSchema = z.object({
  input: z.string().min(1),
})

export function createApp() {
  const app = new Hono()

  app.use(cors())
  app.use(logger())

  app.get('/health', (c) => c.json({ status: 'ok' }))

  // ---------- Providers ----------

  app.get('/providers', (c) => {
    const providers: ProviderMetadata[] = getAllProviders().map((config) => {
      const instance = getProviderInstance(config.id)
      return {
        id: config.id,
        name: config.name,
        iconKey: config.iconKey,
        description: config.description,
        recommended: config.recommended,
        defaultBaseUrl: config.defaultBaseUrl,
        configured: Boolean(instance?.apiKey),
        enabled: instance?.enabled ?? false,
      }
    })
    return c.json({ providers })
  })

  app.post('/providers/:id/config', async (c) => {
    const id = c.req.param('id') as ProviderId
    const body = await c.req.json()
    const parsed = configureSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors }, 400)
    }

    const config = getProviderConfig(id)
    if (!config) {
      return c.json({ error: 'Unknown provider' }, 404)
    }

    configureProvider(id, parsed.data)
    invalidateModelsCollection()

    return c.json({ success: true })
  })

  app.post('/providers/:id/test', async (c) => {
    const id = c.req.param('id') as ProviderId
    const body = await c.req.json()
    const parsed = testSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors }, 400)
    }

    const existing = getProviderInstance(id)
    const apiKey = parsed.data.apiKey ?? existing?.apiKey

    if (!apiKey) {
      return c.json({ success: false, error: 'Provider not configured' }, 400)
    }

    const result = await testProvider({
      id,
      apiKey,
      baseUrl: parsed.data.baseUrl ?? existing?.baseUrl,
      enabled: existing?.enabled ?? false,
    })
    return c.json(result, result.success ? 200 : 400)
  })

  app.get('/providers/:id/models', async (c) => {
    const id = c.req.param('id') as ProviderId
    const instance = getProviderInstance(id)
    if (!instance) {
      return c.json({ error: 'Provider not configured' }, 400)
    }

    const models = await listModels(instance)
    return c.json({
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        reasoning: m.reasoning,
        input: m.input,
        cost: m.cost,
      })),
    })
  })

  // ---------- Agents ----------

  app.get('/agents', (c) => {
    return c.json({ agents: listAgents() })
  })

  app.get('/agents/:id/template', (c) => {
    const definition = getAgentDefinition(c.req.param('id'))
    if (!definition) {
      return c.json({ error: 'Unknown agent' }, 404)
    }
    return c.json({ files: definition.projectTemplate })
  })

  // ---------- Sessions ----------

  app.post('/sessions', async (c) => {
    const body = await c.req.json()
    const parsed = createSessionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors }, 400)
    }

    const { sessionId, agentId, projectRoot, providerId, modelId, history } = parsed.data

    try {
      await createSession({
        sessionId,
        agentId,
        projectRoot,
        providerId,
        modelId,
        history: history as never,
      })
      return c.json({ success: true })
    } catch (error) {
      if (error instanceof SessionError) {
        return c.json({ error: error.message }, error.status)
      }
      serverLog('error', 'failed to create session', {
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
    }
  })

  app.get('/sessions/:id/messages', (c) => {
    try {
      return c.json({ messages: getSessionMessages(c.req.param('id')) })
    } catch (error) {
      if (error instanceof SessionError) {
        return c.json({ error: error.message }, error.status)
      }
      throw error
    }
  })

  app.post('/sessions/:id/messages', async (c) => {
    const sessionId = c.req.param('id')
    const body = await c.req.json()
    const parsed = messageSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors }, 400)
    }

    if (!getSession(sessionId)) {
      return c.json({ error: `Unknown session: ${sessionId}` }, 404)
    }

    return streamSSE(c, async (stream) => {
      let seq = 0
      try {
        await runPrompt(sessionId, parsed.data.input, (event) => {
          void stream.writeSSE({
            event: 'message',
            data: JSON.stringify({ seq: seq++, ...event }),
          })
        })
        await stream.writeSSE({ event: 'done', data: '{}' })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        serverLog('error', 'prompt run failed', { sessionId, error: message })
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: message }) })
      }
    })
  })

  app.post('/sessions/:id/steer', async (c) => {
    const body = await c.req.json()
    const parsed = messageSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors }, 400)
    }
    try {
      steerSession(c.req.param('id'), parsed.data.input)
      return c.json({ success: true })
    } catch (error) {
      if (error instanceof SessionError) {
        return c.json({ error: error.message }, error.status)
      }
      throw error
    }
  })

  app.post('/sessions/:id/abort', (c) => {
    try {
      abortSession(c.req.param('id'))
      return c.json({ success: true })
    } catch (error) {
      if (error instanceof SessionError) {
        return c.json({ error: error.message }, error.status)
      }
      throw error
    }
  })

  app.delete('/sessions/:id', (c) => {
    destroySession(c.req.param('id'))
    return c.json({ success: true })
  })

  return app
}
