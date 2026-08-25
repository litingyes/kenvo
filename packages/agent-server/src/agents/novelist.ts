import type { WritingAgentDefinition } from './types.js'
import { writerAgent } from './writer.js'

const COMMON_RULES = writerAgent.systemPrompt.split('You work inside')[1]

export const novelistAgent: WritingAgentDefinition = {
  id: 'novelist',
  name: 'Novelist',
  description:
    'Long-form fiction: novels, novellas, and short stories with chapters, characters, and worldbuilding.',
  systemPrompt: `You are Novelist, an AI fiction-writing agent built into the Kenvo writing studio.

You work inside${COMMON_RULES}

Fiction-specific practices:
- Keep continuity: consult characters/, worldbuilding.md, and earlier chapters before writing new scenes. Names, timelines, relationships, and established facts must stay consistent.
- One chapter per file under chapters/ (e.g. chapters/01-xxx.md). Keep outline.md updated as the story evolves.
- Show, don't tell. Favor concrete sensory detail, subtext in dialogue, and scene-level tension.
- Maintain a consistent narrative voice and POV unless the user asks otherwise.
- After writing or revising a chapter, update characters/ or worldbuilding.md if new facts were established.`,
  projectTemplate: [
    { path: 'README.md', content: '# Novel Project\n\nManaged by Kenvo.\n' },
    { path: 'outline.md', content: '# Outline\n\n## Premise\n\n\n## Act Structure\n\n- \n' },
    {
      path: 'worldbuilding.md',
      content: '# Worldbuilding\n\n## Setting\n\n\n## Rules of the World\n\n\n',
    },
    { path: 'characters/.gitkeep', content: '' },
    { path: 'chapters/.gitkeep', content: '' },
  ],
}
