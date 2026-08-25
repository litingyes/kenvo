import {
  createModels,
  createProvider,
  type Model,
  type MutableModels,
  type Provider as PiProvider,
} from '@earendil-works/pi-ai'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'

export type ProviderId = 'openai' | 'anthropic' | 'deepseek' | 'moonshotai' | 'alibaba' | 'xai'

export interface ProviderConfig {
  id: ProviderId
  name: string
  defaultBaseUrl: string
  modelsEndpoint: string
  apiKeyHeaderName: string
  apiKeyPrefix?: string
  extraHeaders?: Record<string, string>
  iconKey: string
  description: string
  recommended?: boolean
  /** pi-ai builtin catalog id, when the provider has one. */
  catalogId?: string
  /** Wire API used by this provider's models. */
  api: 'openai-completions' | 'anthropic-messages'
}

export interface ProviderInstance {
  id: ProviderId
  apiKey?: string
  baseUrl?: string
  enabled: boolean
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com',
    modelsEndpoint: '/v1/models',
    apiKeyHeaderName: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    iconKey: 'OpenAI',
    description: 'Use OpenAI models via API key.',
    recommended: true,
    catalogId: 'openai',
    api: 'openai-completions',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    modelsEndpoint: '/v1/models',
    apiKeyHeaderName: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
    iconKey: 'Anthropic',
    description: 'Use Claude models via API key.',
    catalogId: 'anthropic',
    api: 'anthropic-messages',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    modelsEndpoint: '/models',
    apiKeyHeaderName: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    iconKey: 'DeepSeek',
    description: 'Use DeepSeek models via API key.',
    catalogId: 'deepseek',
    api: 'openai-completions',
  },
  {
    id: 'moonshotai',
    name: 'Moonshot AI',
    defaultBaseUrl: 'https://api.moonshot.cn',
    modelsEndpoint: '/v1/models',
    apiKeyHeaderName: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    iconKey: 'Moonshot',
    description: 'Use Moonshot AI models via API key.',
    catalogId: 'moonshotai',
    api: 'openai-completions',
  },
  {
    id: 'alibaba',
    name: 'Alibaba Cloud',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    modelsEndpoint: '/v1/models',
    apiKeyHeaderName: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    iconKey: 'Alibaba',
    description: 'Use Qwen models via API key.',
    api: 'openai-completions',
  },
  {
    id: 'xai',
    name: 'xAI',
    defaultBaseUrl: 'https://api.x.ai',
    modelsEndpoint: '/v1/models',
    apiKeyHeaderName: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    iconKey: 'XAI',
    description: 'Use xAI Grok models via API key.',
    catalogId: 'xai',
    api: 'openai-completions',
  },
]

export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function getAllProviders(): ProviderConfig[] {
  return PROVIDERS
}

// ---------- Configured instances ----------

const providerInstances = new Map<ProviderId, ProviderInstance>()

export function configureProvider(
  id: ProviderId,
  config: { apiKey?: string | null; baseUrl?: string | null; enabled?: boolean | null },
): void {
  const existing = providerInstances.get(id)
  providerInstances.set(id, {
    id,
    apiKey: config.apiKey ?? existing?.apiKey,
    baseUrl: config.baseUrl ?? existing?.baseUrl,
    enabled: config.enabled ?? existing?.enabled ?? false,
  })
}

export function getProviderInstance(id: ProviderId): ProviderInstance | undefined {
  return providerInstances.get(id)
}

// ---------- Model catalog ----------

function chatCompletionsBaseUrl(config: ProviderConfig, baseUrl: string): string {
  const prefix = config.modelsEndpoint.replace(/\/?models\/?$/, '')
  return `${baseUrl.replace(/\/+$/, '')}${prefix}`
}

/** pi-ai models need the API-versioned base URL (e.g. https://api.openai.com/v1). */
function resolveModelBaseUrl(config: ProviderConfig, instance?: ProviderInstance): string {
  const baseUrl = instance?.baseUrl || config.defaultBaseUrl
  if (config.api === 'anthropic-messages') {
    return baseUrl.replace(/\/+$/, '')
  }
  return chatCompletionsBaseUrl(config, baseUrl)
}

function defaultModel(id: string, config: ProviderConfig, baseUrl: string): Model<Api> {
  return {
    id,
    name: id,
    api: config.api,
    provider: config.id,
    baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  } as Model<Api>
}

type Api = 'openai-completions' | 'anthropic-messages'

/**
 * Known models for a provider instance: builtin catalog entries (re-based onto
 * the configured base URL) merged with dynamically fetched model ids.
 */
export async function listModels(instance: ProviderInstance): Promise<Model<Api>[]> {
  const config = getProviderConfig(instance.id)
  if (!config) return []

  const baseUrl = resolveModelBaseUrl(config, instance)
  const catalog: Model<Api>[] = config.catalogId
    ? (getBuiltinModels(config.catalogId as never) as unknown as readonly Model<Api>[]).map(
        (m) => ({
          ...m,
          baseUrl,
        }),
      )
    : []

  const known = new Map<string, Model<Api>>(catalog.map((m) => [m.id, m]))
  const dynamicIds = await fetchModelIds(instance)
  for (const id of dynamicIds) {
    if (!known.has(id)) {
      known.set(id, defaultModel(id, config, baseUrl))
    }
  }
  return [...known.values()]
}

// ---------- HTTP model listing / connectivity test ----------

export async function testProvider(
  instance: ProviderInstance,
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getProviderConfig(instance.id)
    if (!config) {
      return { success: false, error: 'Unknown provider' }
    }
    if (!instance.apiKey) {
      return { success: false, error: 'API key is required' }
    }

    const models = await fetchModelIds(instance)
    if (models.length === 0) {
      return { success: false, error: 'No models available' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function fetchModelIds(instance: ProviderInstance): Promise<string[]> {
  const config = getProviderConfig(instance.id)
  if (!config) {
    return []
  }

  try {
    const baseUrl = instance.baseUrl || config.defaultBaseUrl
    const headers: Record<string, string> = { ...config.extraHeaders }

    if (instance.apiKey) {
      headers[config.apiKeyHeaderName] = `${config.apiKeyPrefix || ''}${instance.apiKey}`
    }

    const response = await fetch(`${baseUrl}${config.modelsEndpoint}`, {
      headers,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = (await response.json()) as { data?: Array<{ id: string }> }
    return data.data?.map((m) => m.id).filter(Boolean) || []
  } catch {
    return []
  }
}

// ---------- pi-ai Models collection ----------

let cachedModels: MutableModels | null = null

/**
 * Build (and cache) the pi-ai Models collection over the currently configured
 * provider instances. Rebuilt whenever provider configuration changes.
 */
export function getModelsCollection(): MutableModels {
  if (cachedModels) return cachedModels

  const models = createModels()

  for (const instance of providerInstances.values()) {
    if (!instance.apiKey) continue
    const config = getProviderConfig(instance.id)
    if (!config) continue

    const baseUrl = resolveModelBaseUrl(config, instance)
    const catalog: Model<Api>[] = config.catalogId
      ? (getBuiltinModels(config.catalogId as never) as unknown as readonly Model<Api>[]).map(
          (m) => ({
            ...m,
            baseUrl,
          }),
        )
      : []

    const provider: PiProvider<Api> = createProvider<Api>({
      id: config.id,
      name: config.name,
      baseUrl,
      auth: {
        apiKey: {
          name: `${config.name} API key`,
          resolve: async () => ({ auth: { apiKey: instance.apiKey } }),
        },
      },
      models: catalog,
      fetchModels: async () => {
        const ids = await fetchModelIds(instance)
        const known = new Set(catalog.map((m) => m.id))
        return ids.filter((id) => !known.has(id)).map((id) => defaultModel(id, config, baseUrl))
      },
      api: buildApi(config),
    })

    models.setProvider(provider)
  }

  cachedModels = models
  return models
}

/** Invalidate the cached Models collection after provider config changes. */
export function invalidateModelsCollection(): void {
  cachedModels = null
}

function buildApi(config: ProviderConfig) {
  // Lazy wrappers defer loading the underlying vendor SDK until first use.
  if (config.api === 'anthropic-messages') {
    return anthropicMessagesApi()
  }
  return openAICompletionsApi()
}
