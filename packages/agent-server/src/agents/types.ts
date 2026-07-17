import type { LanguageModel } from 'ai'
import type { z } from 'zod'

export interface TaskDefinition<Input = unknown, Output = unknown> {
  inputSchema: z.ZodType<Input>
  run: (model: LanguageModel, input: Input) => Promise<Output>
}

export function defineTask<Input, Output>(
  task: TaskDefinition<Input, Output>,
): TaskDefinition<unknown, unknown> {
  return task as TaskDefinition<unknown, unknown>
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  tasks: Record<string, TaskDefinition>
}

export interface AgentMetadata {
  id: string
  name: string
  description: string
  tasks: string[]
}
