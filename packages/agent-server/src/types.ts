import type { ProviderInstance } from './providers.js'

export interface ServerConfig {
  port: number
}

export interface ConfigureProviderRequest {
  id: string
  apiKey?: string
  baseUrl?: string
  enabled?: boolean
}

export interface ProviderMetadata {
  id: string
  name: string
  iconKey: string
  description: string
  recommended?: boolean
  defaultBaseUrl: string
  configured: boolean
  enabled: boolean
}

export interface ModelInfo {
  id: string
  providerId: string
}

export type { ProviderInstance }
