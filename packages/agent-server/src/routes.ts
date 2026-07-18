import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { z } from 'zod'

import { getAgent, listAgents } from './agents/registry.js'
import { serverLog } from './logging.js'
import {
  createLanguageModel,
  fetchModels,
  getAllProviders,
  getProviderConfig,
  testProvider,
  type ProviderId,
  type ProviderInstance,
} from './providers.js'
import type { ProviderMetadata } from './types.js'

const providerInstances = new Map<ProviderId, ProviderInstance>()

const configureSchema = z.object({
  apiKey: z.string().nullish(),
  baseUrl: z.string().nullish(),
  enabled: z.boolean().nullish(),
})

const testSchema = z.object({
  apiKey: z.string().nullish(),
  baseUrl: z.string().nullish(),
})

const runAgentSchema = z.object({
  task: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  input: z.unknown(),
})

export function createApp() {
  const app = new Hono()

  app.use(cors())
  app.use(logger())

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.get('/providers', (c) => {
    const providers: ProviderMetadata[] = getAllProviders().map((config) => {
      const instance = providerInstances.get(config.id)
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

    const existing = providerInstances.get(id)
    providerInstances.set(id, {
      id,
      apiKey: parsed.data.apiKey ?? existing?.apiKey,
      baseUrl: parsed.data.baseUrl ?? existing?.baseUrl,
      enabled: parsed.data.enabled ?? existing?.enabled ?? false,
    })

    return c.json({ success: true })
  })

  app.post('/providers/:id/test', async (c) => {
    const id = c.req.param('id') as ProviderId
    const body = await c.req.json()
    const parsed = testSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors }, 400)
    }

    const existing = providerInstances.get(id)
    const apiKey = parsed.data.apiKey ?? existing?.apiKey

    if (!apiKey) {
      return c.json({ success: false, error: 'Provider not configured' }, 400)
    }

    const instance: ProviderInstance = {
      id,
      apiKey,
      baseUrl: parsed.data.baseUrl ?? existing?.baseUrl,
      enabled: existing?.enabled ?? false,
    }

    const result = await testProvider(instance)
    return c.json(result, result.success ? 200 : 400)
  })

  app.get('/providers/:id/models', async (c) => {
    const id = c.req.param('id') as ProviderId
    const instance = providerInstances.get(id)
    if (!instance) {
      return c.json({ error: 'Provider not configured' }, 400)
    }

    const models = await fetchModels(instance)
    return c.json({ models })
  })

  app.post('/chat', async (c) => {
    return c.json({ error: 'Not implemented' }, 501)
  })

  app.get('/agents', (c) => {
    return c.json({ agents: listAgents() })
  })

  app.post('/agents/:id/run', async (c) => {
    const agent = getAgent(c.req.param('id'))
    if (!agent) {
      return c.json({ error: 'Unknown agent' }, 404)
    }

    const body = await c.req.json()
    const parsed = runAgentSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors }, 400)
    }

    const { task: taskId, providerId, modelId, input } = parsed.data
    const task = agent.tasks[taskId]
    if (!task) {
      return c.json({ error: `Unknown task: ${taskId}` }, 404)
    }

    const instance = providerInstances.get(providerId as ProviderId)
    if (!instance?.apiKey) {
      return c.json({ error: 'Provider not configured' }, 400)
    }

    const inputParsed = task.inputSchema.safeParse(input)
    if (!inputParsed.success) {
      return c.json({ error: inputParsed.error.errors }, 400)
    }

    const startedAt = Date.now()
    serverLog('info', 'agent run started', {
      agentId: agent.id,
      task: taskId,
      providerId,
      modelId,
    })

    try {
      const model = createLanguageModel(instance, modelId)
      const output = await task.run(model, inputParsed.data)
      serverLog('info', 'agent run succeeded', {
        agentId: agent.id,
        task: taskId,
        providerId,
        modelId,
        durationMs: Date.now() - startedAt,
      })
      return c.json({ output })
    } catch (error) {
      serverLog('error', 'agent run failed', {
        agentId: agent.id,
        task: taskId,
        providerId,
        modelId,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
    }
  })

  return app
}
