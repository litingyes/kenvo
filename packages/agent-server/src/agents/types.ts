/** A file to materialize when a project is created from an agent template. */
export interface TemplateFile {
  /** Path relative to the project root, POSIX separators. */
  path: string
  content: string
}

export interface WritingAgentDefinition {
  id: string
  name: string
  description: string
  /** System prompt given to the pi Agent for this writing role. */
  systemPrompt: string
  /** Initial project structure created on project creation. */
  projectTemplate: TemplateFile[]
}

export interface AgentMetadata {
  id: string
  name: string
  description: string
}
