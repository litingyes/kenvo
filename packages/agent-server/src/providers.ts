import { createAlibaba } from '@ai-sdk/alibaba'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createMoonshotAI } from '@ai-sdk/moonshotai'
import { createOpenAI } from '@ai-sdk/openai'
import { createXai } from '@ai-sdk/xai'
import { generateText } from 'ai'

export type ProviderId = 'openai' | 'anthropic' | 'deepseek' | 'moonshotai' | 'alibaba' | 'xai'

export interface ProviderConfig {
  id: ProviderId
  name: string
  defaultBaseUrl: string
  modelsEndpoint: string
  apiKeyHeaderName: string
  apiKeyPrefix?: string
  extraHeaders?: Record<string, string>
  defaultModels: string[]
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
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
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
    defaultModels: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'],
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
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
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
    defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
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
    defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
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
    defaultModels: ['grok-3', 'grok-2', 'grok-3-mini'],
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

export function createProviderFactory(id: ProviderId, apiKey?: string, baseUrl?: string) {
  const options = { apiKey, baseURL: baseUrl }
  switch (id) {
    case 'openai':
      return (modelId: string) => createOpenAI(options)(modelId)
    case 'anthropic':
      return (modelId: string) => createAnthropic(options)(modelId)
    case 'deepseek':
      return (modelId: string) => createDeepSeek(options)(modelId)
    case 'moonshotai':
      return (modelId: string) => createMoonshotAI(options)(modelId)
    case 'alibaba':
      return (modelId: string) => createAlibaba(options)(modelId)
    case 'xai':
      return (modelId: string) => createXai(options)(modelId)
  }
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

    const factory = createProviderFactory(
      instance.id,
      instance.apiKey,
      instance.baseUrl || config.defaultBaseUrl,
    )
    const model = factory(config.defaultModels[0])

    await generateText({
      model,
      prompt: 'Say hello',
    })

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
    const models = data.data?.map((m) => m.id).filter(Boolean) || []
    return models.length > 0 ? models : config.defaultModels
  } catch {
    return config.defaultModels
  }
}
