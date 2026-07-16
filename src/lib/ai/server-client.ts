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

export interface TestProviderResult {
  success: boolean
  error?: string
}

export interface ModelsResponse {
  models: string[]
}

export class AgentServerClient {
  constructor(private baseUrl: string) {}

  private async request(path: string, options?: RequestInit): Promise<Response> {
    const headers = new Headers(options?.headers)
    headers.set('Content-Type', 'application/json')

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    })
    return response
  }

  async health(): Promise<{ status: string }> {
    const response = await this.request('/health')
    return response.json()
  }

  async getProviders(): Promise<ProviderMetadata[]> {
    const response = await this.request('/providers')
    const data = await response.json()
    return data.providers
  }

  async configureProvider(
    id: string,
    config: { apiKey?: string; baseUrl?: string; enabled?: boolean },
  ): Promise<void> {
    await this.request(`/providers/${id}/config`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async testProvider(
    id: string,
    config?: { apiKey?: string; baseUrl?: string },
  ): Promise<TestProviderResult> {
    const response = await this.request(`/providers/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(config ?? {}),
    })
    return response.json()
  }

  async getModels(id: string): Promise<string[]> {
    const response = await this.request(`/providers/${id}/models`)
    const data = await response.json()
    return data.models
  }
}

export function createAgentServerClient(port: number): AgentServerClient {
  return new AgentServerClient(`http://localhost:${port}`)
}

export async function isAgentServerRunning(port: number): Promise<boolean> {
  try {
    const client = createAgentServerClient(port)
    await client.health()
    return true
  } catch {
    return false
  }
}
