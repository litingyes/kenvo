import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

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
  },
]

export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function getAllProviders(): ProviderConfig[] {
  return PROVIDERS
}

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

    const models = await fetchModels(instance)
    if (models.length === 0) {
      return { success: false, error: 'No models available' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function fetchModels(instance: ProviderInstance): Promise<string[]> {
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

function chatCompletionsBaseUrl(config: ProviderConfig, baseUrl: string): string {
  const prefix = config.modelsEndpoint.replace(/\/?models\/?$/, '')
  return `${baseUrl.replace(/\/+$/, '')}${prefix}`
}

export function createLanguageModel(instance: ProviderInstance, modelId: string): LanguageModel {
  const config = getProviderConfig(instance.id)
  if (!config) {
    throw new Error(`Unknown provider: ${instance.id}`)
  }
  if (!instance.apiKey) {
    throw new Error(`Provider not configured: ${instance.id}`)
  }

  const baseUrl = instance.baseUrl || config.defaultBaseUrl

  if (instance.id === 'anthropic') {
    return createAnthropic({ apiKey: instance.apiKey, baseURL: baseUrl })(modelId)
  }

  return createOpenAICompatible({
    name: config.id,
    apiKey: instance.apiKey,
    baseURL: chatCompletionsBaseUrl(config, baseUrl),
  })(modelId)
}
