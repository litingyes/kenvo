import { coderAgent } from './coder/index.js'
import type { AgentDefinition, AgentMetadata } from './types.js'

const agents = new Map<string, AgentDefinition>([[coderAgent.id, coderAgent]])

export function getAgent(id: string): AgentDefinition | undefined {
  return agents.get(id)
}

export function listAgents(): AgentMetadata[] {
  return Array.from(agents.values()).map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tasks: Object.keys(agent.tasks),
  }))
}
