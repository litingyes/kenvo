import type { AgentDefinition } from '../types.js'
import { commitMessageTask } from './commit-message.js'

export const coderAgent: AgentDefinition = {
  id: 'coder',
  name: 'Coder',
  description: 'Handles code-focused tasks such as summarizing file changes into commit messages.',
  tasks: {
    'commit-message': commitMessageTask,
  },
}
