import { IPC_CHANNELS, invoke, listen } from '@/lib/electron/api'

export interface AiProviderSettings {
  id: string
  apiKey?: string
  baseUrl?: string
  enabled: boolean
}

export interface ModelRef {
  providerId: string
  modelId: string
}

export interface AiSettings {
  serverPort: number
  serverAutoStart: boolean
  providers: AiProviderSettings[]
  enabledModels: Record<string, string[]>
}

export interface AgentServerStatus {
  running: boolean
  port: number | null
}

export async function getAiSettings(): Promise<AiSettings> {
  return invoke<AiSettings>(IPC_CHANNELS.GET_AI_SETTINGS)
}

export async function setAiSettings(settings: AiSettings): Promise<void> {
  return invoke(IPC_CHANNELS.SET_AI_SETTINGS, settings)
}

export async function startAgentServer(): Promise<number> {
  return invoke<number>(IPC_CHANNELS.AGENT_SERVER_START)
}

export async function stopAgentServer(): Promise<void> {
  return invoke(IPC_CHANNELS.AGENT_SERVER_STOP)
}

export async function getAgentServerStatus(): Promise<AgentServerStatus> {
  return invoke<AgentServerStatus>(IPC_CHANNELS.AGENT_SERVER_STATUS)
}

export function onAgentServerPort(callback: (port: number) => void): () => void {
  return listen<number>(IPC_CHANNELS.AGENT_SERVER_PORT, callback)
}

export function onAgentServerStopped(callback: () => void): () => void {
  return listen(IPC_CHANNELS.AGENT_SERVER_STOPPED, callback)
}

export function onAiSettingsChanged(callback: (settings: AiSettings) => void): () => void {
  return listen<AiSettings>(IPC_CHANNELS.AI_SETTINGS_CHANGED, callback)
}

export function getProviderSettings(
  settings: AiSettings,
  providerId: string,
): AiProviderSettings | undefined {
  return settings.providers.find((p) => p.id === providerId)
}

export function updateProviderSettings(
  settings: AiSettings,
  provider: AiProviderSettings,
): AiSettings {
  const providers = settings.providers.filter((p) => p.id !== provider.id)
  providers.push(provider)
  return { ...settings, providers }
}

export function removeProviderSettings(settings: AiSettings, providerId: string): AiSettings {
  return {
    ...settings,
    providers: settings.providers.filter((p) => p.id !== providerId),
  }
}

export function isModelEnabled(settings: AiSettings, providerId: string, modelId: string): boolean {
  return settings.enabledModels[providerId]?.includes(modelId) ?? false
}

export function toggleModelEnabled(
  settings: AiSettings,
  providerId: string,
  modelId: string,
): AiSettings {
  const enabled = new Set(settings.enabledModels[providerId] ?? [])
  if (enabled.has(modelId)) {
    enabled.delete(modelId)
  } else {
    enabled.add(modelId)
  }
  return {
    ...settings,
    enabledModels: {
      ...settings.enabledModels,
      [providerId]: Array.from(enabled),
    },
  }
}

/**
 * Default model for new sessions: the first enabled model whose provider has
 * an API key. Sessions override this with their own stored model.
 */
export function resolveDefaultModel(settings: AiSettings): ModelRef | undefined {
  return listUsableModels(settings)[0]
}

/** True when the model is usable: provider configured + model still enabled. */
export function isModelUsable(settings: AiSettings, ref: ModelRef): boolean {
  const hasApiKey = Boolean(settings.providers.find((p) => p.id === ref.providerId)?.apiKey)
  return hasApiKey && (settings.enabledModels[ref.providerId]?.includes(ref.modelId) ?? false)
}

/** Every enabled model whose provider has an API key, in settings order. */
export function listUsableModels(settings: AiSettings): ModelRef[] {
  const hasApiKey = (providerId: string) =>
    Boolean(settings.providers.find((p) => p.id === providerId)?.apiKey)

  const result: ModelRef[] = []
  for (const [providerId, models] of Object.entries(settings.enabledModels)) {
    if (!hasApiKey(providerId)) continue
    for (const modelId of models) {
      result.push({ providerId, modelId })
    }
  }
  return result
}
