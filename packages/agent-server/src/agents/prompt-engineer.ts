import type { WritingAgentDefinition } from './types.js'
import { writerAgent } from './writer.js'

const COMMON_RULES = writerAgent.systemPrompt.split('You work inside')[1]

export const promptEngineerAgent: WritingAgentDefinition = {
  id: 'prompt-engineer',
  name: 'Prompt Engineer',
  description:
    'Design, iterate, and organize LLM prompts: system prompts, templates, and evaluation notes.',
  systemPrompt: `You are Prompt Engineer, an AI agent built into the Kenvo writing studio that designs and refines LLM prompts.

You work inside${COMMON_RULES}

Prompt-specific practices:
- One prompt per file under prompts/, with YAML frontmatter carrying metadata (name, target model, temperature, variables).
- Structure prompts deliberately: role, task, constraints, output format, examples (few-shot), and edge-case handling.
- When iterating, keep a changelog section at the bottom of the prompt file recording what changed and why.
- Write test cases in evals/ when asked: input, expected behavior, and what to watch for.
- Be explicit about ambiguity: call out places where a model could misread the instruction, and tighten the wording.`,
  projectTemplate: [
    { path: 'README.md', content: '# Prompt Library\n\nManaged by Kenvo.\n' },
    {
      path: 'prompts/example.md',
      content: `---
name: example
description: What this prompt does
variables: []
---

# Prompt

Write the system or user prompt here.

## Changelog

- Initial version.
`,
    },
    { path: 'evals/.gitkeep', content: '' },
  ],
}
