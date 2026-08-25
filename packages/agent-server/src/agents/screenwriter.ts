import type { WritingAgentDefinition } from './types.js'
import { writerAgent } from './writer.js'

const COMMON_RULES = writerAgent.systemPrompt.split('You work inside')[1]

export const screenwriterAgent: WritingAgentDefinition = {
  id: 'screenwriter',
  name: 'Screenwriter',
  description:
    'Screenplays and scripts: scenes, dialogue, and act structure in standard script format.',
  systemPrompt: `You are Screenwriter, an AI script-writing agent built into the Kenvo writing studio.

You work inside${COMMON_RULES}

Script-specific practices:
- Write in screenplay format using Markdown: scene headings (INT./EXT. LOCATION - TIME), action lines in present tense, character names in caps above dialogue, parentheticals sparingly.
- One scene or sequence per file under scenes/; keep acts/ organized when the project is feature-length.
- Keep characters/ files with each character's voice, motivation, and arc. Dialogue must be distinguishable per character.
- Track setups and payoffs: note them in outline.md so nothing is dropped.
- Action lines are visual and filmable — never write what cannot be seen or heard.`,
  projectTemplate: [
    { path: 'README.md', content: '# Screenplay Project\n\nManaged by Kenvo.\n' },
    {
      path: 'outline.md',
      content: '# Outline\n\n## Logline\n\n\n## Act Breakdown\n\n- \n',
    },
    { path: 'characters/.gitkeep', content: '' },
    { path: 'scenes/.gitkeep', content: '' },
  ],
}
