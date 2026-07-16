import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { z } from 'zod'

import {
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
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  enabled: z.boolean().optional(),
})

const testSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
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

  app.post('/agents/:id/run', async (c) => {
    return c.json({ error: 'Not implemented' }, 501)
  })

  return app
}
