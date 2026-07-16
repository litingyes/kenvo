import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface AiProviderSettings {
  id: string
  apiKey?: string
  baseUrl?: string
  enabled: boolean
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
  return invoke<AiSettings>('get_ai_settings_command')
}

export async function setAiSettings(settings: AiSettings): Promise<void> {
  return invoke('set_ai_settings_command', { settings })
}

export async function startAgentServer(): Promise<number> {
  return invoke<number>('agent_server_start')
}

export async function stopAgentServer(): Promise<void> {
  return invoke('agent_server_stop')
}

export async function getAgentServerStatus(): Promise<AgentServerStatus> {
  return invoke<AgentServerStatus>('agent_server_status')
}

export function onAgentServerPort(callback: (port: number) => void): Promise<UnlistenFn> {
  return listen<number>('agent-server-port', (event) => {
    callback(event.payload)
  })
}

export function onAgentServerStopped(callback: () => void): Promise<UnlistenFn> {
  return listen('agent-server-stopped', () => {
    callback()
  })
}

export function onAiSettingsChanged(callback: (settings: AiSettings) => void): Promise<UnlistenFn> {
  return listen<AiSettings>('ai-settings-changed', (event) => {
    callback(event.payload)
  })
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
