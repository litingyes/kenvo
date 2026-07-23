import Store from 'electron-store'

interface AiProviderSettings {
  id: string
  apiKey?: string
  baseUrl?: string
  enabled: boolean
}

interface AgentModelAssignment {
  providerId: string
  modelId: string
}

export interface AiSettings {
  serverPort: number
  serverAutoStart: boolean
  providers: AiProviderSettings[]
  enabledModels: Record<string, string[]>
  agentModels: Record<string, AgentModelAssignment>
}

export interface ThemeSettings {
  mode: string
}

let store: Store | null = null

function getStore(): Store {
  if (!store) {
    store = new Store({ name: 'settings' })
  }
  return store
}

const DEFAULT_THEME: ThemeSettings = { mode: 'dark' }
const DEFAULT_AI_SETTINGS: AiSettings = {
  serverPort: 32420,
  serverAutoStart: true,
  providers: [],
  enabledModels: {},
  agentModels: {},
}

export function getTheme(): ThemeSettings {
  const s = getStore()
  const mode = s.get('theme.mode', DEFAULT_THEME.mode) as string
  return { mode }
}

export function setTheme(settings: ThemeSettings): void {
  const s = getStore()
  s.set('theme.mode', settings.mode)
}

export function getLanguage(): string {
  const s = getStore()
  const language = s.get('language', 'en-US') as string
  return ['en-US', 'zh-CN'].includes(language) ? language : 'en-US'
}

export function setLanguage(language: string): void {
  const s = getStore()
  s.set('language', language)
}

export function getAiSettings(): AiSettings {
  const s = getStore()
  const raw = s.get('ai', DEFAULT_AI_SETTINGS) as Partial<AiSettings>
  return {
    serverPort: raw.serverPort ?? DEFAULT_AI_SETTINGS.serverPort,
    serverAutoStart: raw.serverAutoStart ?? DEFAULT_AI_SETTINGS.serverAutoStart,
    providers: raw.providers ?? DEFAULT_AI_SETTINGS.providers,
    enabledModels: raw.enabledModels ?? DEFAULT_AI_SETTINGS.enabledModels,
    agentModels: raw.agentModels ?? DEFAULT_AI_SETTINGS.agentModels,
  }
}

export function setAiSettings(settings: AiSettings): void {
  const s = getStore()
  s.set('ai', settings)
}

export function getServerPort(): number {
  const s = getStore()
  return s.get('ai.serverPort', DEFAULT_AI_SETTINGS.serverPort) as number
}
