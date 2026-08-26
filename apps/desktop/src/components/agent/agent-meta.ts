import { BookOpenIcon, ClapperboardIcon, PenLineIcon, Wand2Icon } from 'lucide-react'
import type * as React from 'react'

/** Shared metadata for the built-in writing agents (icon + display name). */

export const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  writer: PenLineIcon,
  novelist: BookOpenIcon,
  screenwriter: ClapperboardIcon,
  'prompt-engineer': Wand2Icon,
}

export const AGENT_NAMES: Record<string, string> = {
  writer: 'Writer',
  novelist: 'Novelist',
  screenwriter: 'Screenwriter',
  'prompt-engineer': 'Prompt Engineer',
}

export function agentIcon(agentId: string): React.ComponentType<{ className?: string }> {
  return AGENT_ICONS[agentId] ?? PenLineIcon
}

export function agentName(agentId: string): string {
  return AGENT_NAMES[agentId] ?? agentId
}
