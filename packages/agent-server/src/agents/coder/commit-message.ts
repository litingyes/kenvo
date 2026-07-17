import { Output, generateText } from 'ai'
import { z } from 'zod'

import { defineTask } from '../types.js'

export const commitMessageInputSchema = z.object({
  diffStat: z.string(),
  diff: z.string(),
  untrackedFiles: z.array(z.string()),
  recentCommits: z.array(z.string()),
})

export type CommitMessageInput = z.infer<typeof commitMessageInputSchema>

export interface CommitMessageOutput {
  message: string
}

const commitMessageObjectSchema = z.object({
  type: z
    .enum([
      'feat',
      'fix',
      'docs',
      'style',
      'refactor',
      'perf',
      'test',
      'build',
      'ci',
      'chore',
      'revert',
    ])
    .describe('Commit type per Conventional Commits'),
  scope: z
    .string()
    .optional()
    .describe(
      'Noun describing the section of the codebase, e.g. "parser". Empty or omitted if unclear.',
    ),
  description: z
    .string()
    .describe(
      'Short summary in imperative mood, e.g. "add ability to parse arrays". No trailing period.',
    ),
  body: z
    .string()
    .optional()
    .describe('Longer explanation of what and why. Empty or omitted for trivial changes.'),
  breakingChange: z
    .string()
    .optional()
    .describe('Description of the breaking change. Empty or omitted if not breaking.'),
})

type CommitMessageObject = z.infer<typeof commitMessageObjectSchema>

const SYSTEM_PROMPT = `You write git commit messages that strictly follow the Conventional Commits 1.0.0 specification.

Structure:
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

Rules:
- type MUST be one of: feat (new feature), fix (bug fix), docs, style, refactor, perf, test, build, ci, chore, revert.
- scope is a noun describing the section of the codebase in parentheses, e.g. fix(parser). Leave empty when no clear scope.
- description is a short summary of the code changes: imperative mood ("add" not "added"), no trailing period. The full first line (type + scope + description) MUST be at most 72 characters.
- body gives additional context about what and why. Leave empty for small, self-explanatory changes.
- If the change alters existing public API or behavior in a non-backward-compatible way, describe it in breakingChange; otherwise leave it empty.
- Base the message on the actual diff content, not just file names.
- Write in English.

Respond only with a JSON object of exactly this shape:
{
  "type": "feat" | "fix" | "docs" | "style" | "refactor" | "perf" | "test" | "build" | "ci" | "chore" | "revert",
  "scope": "<noun describing the codebase section, or empty string>",
  "description": "<short imperative summary>",
  "body": "<longer explanation, or empty string>",
  "breakingChange": "<breaking change description, or empty string>"
}
Always include all five fields. Use empty strings for fields that do not apply. No markdown fences, no extra keys, no commentary.`

function buildUserPrompt(input: CommitMessageInput): string {
  const sections = [
    '## Changed files (git diff --stat)',
    input.diffStat || '(none)',
    '',
    '## Untracked files',
    input.untrackedFiles.length > 0 ? input.untrackedFiles.join('\n') : '(none)',
    '',
    '## Diff',
    input.diff || '(no tracked-file diff)',
    '',
    '## Recent commit subjects (style reference only)',
    input.recentCommits.length > 0 ? input.recentCommits.join('\n') : '(none)',
  ]
  return sections.join('\n')
}

export function formatConventionalCommit(object: CommitMessageObject): string {
  const scope = object.scope?.trim() ?? ''
  const breaking = object.breakingChange?.trim() ?? ''
  const header = `${object.type}${scope ? `(${scope})` : ''}${breaking ? '!' : ''}: ${object.description.trim()}`

  const parts = [header]
  const body = object.body?.trim() ?? ''
  if (body) {
    parts.push(body)
  }
  if (breaking) {
    parts.push(`BREAKING CHANGE: ${breaking}`)
  }
  return parts.join('\n\n')
}

export const commitMessageTask = defineTask<CommitMessageInput, CommitMessageOutput>({
  inputSchema: commitMessageInputSchema,
  async run(model, input) {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: commitMessageObjectSchema }),
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(input),
    })

    return { message: formatConventionalCommit(output) }
  },
})
