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

export interface ModelMetadata {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  reasoning: boolean
  input: ('text' | 'image')[]
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
}

export interface SkillMetadata {
  id: string
  name: string
  description: string
}

export interface ChatAttachmentPayload {
  name: string
  kind: 'text' | 'image'
  mimeType: string
  size: number
  text?: string
  data?: string
}

export interface CreateSessionRequest {
  sessionId: string
  skillId: string
  projectRoot: string
  providerId: string
  modelId: string
  history?: unknown[]
  writePolicy?: 'direct' | 'proposal'
}

export interface AgentProposalChange {
  path: string
  fromPath?: string
  operation: 'create' | 'update' | 'delete' | 'move'
  beforeHash: string | null
  beforeText?: string
  afterText?: string
  summary: string
}

export interface AgentProposal {
  id: string
  title: string
  changes: AgentProposalChange[]
}

/** One server-sent agent event (pi-agent-core event + sequence number). */
export interface AgentStreamEvent {
  seq: number
  type: string
  [key: string]: unknown
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
    config: { apiKey?: string | null; baseUrl?: string | null; enabled?: boolean | null },
  ): Promise<void> {
    const response = await this.request(`/providers/${id}/config`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
    if (!response.ok) {
      throw new Error(`Failed to configure provider ${id} (${response.status})`)
    }
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

  async getModels(id: string): Promise<ModelMetadata[]> {
    const response = await this.request(`/providers/${id}/models`)
    const data = await response.json()
    return data.models
  }

  async getSkills(): Promise<SkillMetadata[]> {
    const response = await this.request('/skills')
    const data = await response.json()
    return data.skills
  }

  async createSession(body: CreateSessionRequest): Promise<void> {
    const response = await this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : `Session create failed (${response.status})`,
      )
    }
  }

  async getProposals(sessionId: string): Promise<AgentProposal[]> {
    const response = await this.request(`/sessions/${sessionId}/proposals`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load proposals')
    }
    return data.proposals
  }

  async applyProposal(sessionId: string, proposalId: string): Promise<AgentProposal> {
    const response = await this.request(`/sessions/${sessionId}/proposals/${proposalId}/apply`, {
      method: 'POST',
    })
    const data = await response.json()
    if (!response.ok) {
      const conflicts = Array.isArray(data.conflicts) ? `: ${data.conflicts.join(', ')}` : ''
      throw new Error(
        (typeof data.error === 'string' ? data.error : 'Failed to apply proposal') + conflicts,
      )
    }
    return data.proposal
  }

  async discardProposal(sessionId: string, proposalId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}/proposals/${proposalId}`, { method: 'DELETE' })
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}`, { method: 'DELETE' })
  }

  async steerSession(
    sessionId: string,
    input: string,
    attachments: ChatAttachmentPayload[] = [],
  ): Promise<void> {
    const response = await this.request(`/sessions/${sessionId}/steer`, {
      method: 'POST',
      body: JSON.stringify({ input, attachments }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Steer failed')
    }
  }

  async abortSession(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}/abort`, { method: 'POST' })
  }

  /**
   * Send a message and stream agent events. `onEvent` receives each parsed
   * SSE event. Resolves when the stream ends; throws on transport or
   * server-reported errors.
   */
  async sendMessage(
    sessionId: string,
    input: string,
    attachments: ChatAttachmentPayload[],
    onEvent: (event: AgentStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ input, attachments }),
      signal,
    })

    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try {
        const data = await response.json()
        if (typeof data.error === 'string') message = data.error
      } catch {
        // ignore
      }
      throw new Error(message)
    }

    if (!response.body) {
      throw new Error('Empty response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = 'message'
    let currentData: string[] = []

    const dispatch = () => {
      const raw = currentData.join('\n')
      currentData = []
      if (!raw) return
      if (currentEvent === 'done') return
      if (currentEvent === 'error') {
        try {
          const parsed = JSON.parse(raw)
          throw new Error(parsed.error ?? 'Agent run failed')
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(raw)
          throw e
        }
      }
      try {
        onEvent(JSON.parse(raw) as AgentStreamEvent)
      } catch {
        // skip malformed events
      }
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let idx: number
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        if (line === '' || line === '\r') {
          dispatch()
          currentEvent = 'message'
          continue
        }
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          currentData.push(line.slice(5).replace(/^ /, ''))
        }
      }
    }
    dispatch()
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
