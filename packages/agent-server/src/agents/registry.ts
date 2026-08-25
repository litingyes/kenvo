import { novelistAgent } from './novelist.js'
import { promptEngineerAgent } from './prompt-engineer.js'
import { screenwriterAgent } from './screenwriter.js'
import type { AgentMetadata, WritingAgentDefinition } from './types.js'
import { writerAgent } from './writer.js'

const agents = new Map<string, WritingAgentDefinition>(
  [writerAgent, novelistAgent, screenwriterAgent, promptEngineerAgent].map((a) => [a.id, a]),
)

export function getAgent(id: string): WritingAgentDefinition | undefined {
  return agents.get(id)
}

export function listAgents(): AgentMetadata[] {
  return Array.from(agents.values()).map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
  }))
}
