import { BookOpenIcon, ClapperboardIcon, PenLineIcon, Wand2Icon } from 'lucide-react'
import type * as React from 'react'

/** Display metadata (icon + name) for the built-in writing skills. */

export const SKILL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  writer: PenLineIcon,
  novelist: BookOpenIcon,
  screenwriter: ClapperboardIcon,
  'prompt-engineer': Wand2Icon,
}

export const SKILL_NAMES: Record<string, string> = {
  writer: 'Writer',
  novelist: 'Novelist',
  screenwriter: 'Screenwriter',
  'prompt-engineer': 'Prompt Engineer',
}

export function skillIcon(skillId: string): React.ComponentType<{ className?: string }> {
  return SKILL_ICONS[skillId] ?? PenLineIcon
}

export function skillName(skillId: string): string {
  return SKILL_NAMES[skillId] ?? skillId
}
