import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadSkills, type Skill } from '@earendil-works/pi-agent-core'
import { NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'

import { serverLog } from './logging.js'

export interface SkillMetadata {
  id: string
  name: string
  description: string
}

/**
 * Shared base prompt for every writing session. The selected skill's
 * instructions are appended on top of this (see {@link buildSystemPrompt}).
 */
const BASE_SYSTEM_PROMPT = `You are Kenvo, an AI writing agent built into the Kenvo writing studio.

You work inside a writing project directory using your file tools:
- list_files to explore the project structure
- read_file to read existing content
- write_file to create or fully rewrite files
- edit_file to make targeted edits to existing files (preferred for small changes)
- delete_file to remove files (only when asked)
- search_files to find text across the project

Working principles:
- Write files in Markdown. One chapter/scene/unit per file.
- Keep a clear, navigable project structure. Update index/outline files when you add content.
- Match the user's language. If the user writes in Chinese, write in Chinese; if in English, write in English.
- When revising, preserve the user's voice and prior choices unless asked to change them.
- Before large rewrites, re-read the relevant files to stay consistent with established facts.
- When you finish a step, briefly summarize what you created or changed and where.`

/**
 * Locate the bundled skills directory. In dev (tsx) the code runs from src/,
 * in the packaged app it runs from the bundled dist/ next to index.mjs.
 */
function resolveSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, 'skills'), // bundled: dist/skills
    path.join(here, '..', 'skills'), // dev: packages/agent-server/skills
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  return candidates[0]
}

const skillMap = new Map<string, Skill>()

/** Load the built-in SKILL.md files. Must be called once before serving. */
export async function initSkills(): Promise<void> {
  const dir = resolveSkillsDir()
  const env = new NodeExecutionEnv({ cwd: dir })
  const { skills, diagnostics } = await loadSkills(env, dir)
  skillMap.clear()
  for (const skill of skills) {
    skillMap.set(skill.name, skill)
  }
  for (const diagnostic of diagnostics) {
    serverLog('warn', 'skill load diagnostic', {
      code: diagnostic.code,
      path: diagnostic.path,
      message: diagnostic.message,
    })
  }
  serverLog('info', 'skills loaded', { dir, skills: skills.map((s) => s.name) })
}

export function getSkill(id: string): Skill | undefined {
  return skillMap.get(id)
}

export function listSkills(): SkillMetadata[] {
  return Array.from(skillMap.values()).map((skill) => ({
    id: skill.name,
    name: skill.name,
    description: skill.description,
  }))
}

/** Compose the session system prompt: shared base + the selected skill. */
export function buildSystemPrompt(skill: Skill): string {
  return `${BASE_SYSTEM_PROMPT}\n\nYou are currently writing with the "${skill.name}" skill. Follow these skill instructions:\n\n${skill.content}`
}
