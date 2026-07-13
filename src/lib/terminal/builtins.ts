import { getCommandNames } from 'just-bash'

const SHELL_BUILTINS = new Set([
  'cd',
  'export',
  'set',
  'unset',
  'source',
  '.',
  'alias',
  'unalias',
  'declare',
  'typeset',
  'local',
  'readonly',
  'return',
  'break',
  'continue',
  'exit',
  'trap',
  'type',
  'hash',
  'builtin',
  'enable',
  'mapfile',
  'readarray',
  'read',
  'getopts',
  'shift',
  'umask',
  'logout',
  'fc',
])

export const BUILTIN_COMMANDS: Set<string> = new Set([
  ...(getCommandNames() as string[]),
  ...SHELL_BUILTINS,
])

export function getBuiltinCommands(): Set<string> {
  return BUILTIN_COMMANDS
}

const CONTROL_KEYWORDS = new Set([
  'if',
  'while',
  'for',
  'until',
  'case',
  'function',
  'time',
  'not',
  'eval',
  'source',
  '.',
  'exec',
  'command',
  'coproc',
  'select',
])

export function isBuiltinOnly(cmd: string): boolean {
  const builtins = BUILTIN_COMMANDS
  const trimmed = cmd.trim()
  if (!trimmed) return true

  if (
    trimmed.startsWith('(') ||
    trimmed.startsWith('$(') ||
    trimmed.startsWith('<(') ||
    trimmed.startsWith('>(')
  ) {
    return false
  }

  const segments = trimmed.split(/(?:&&|\|\||\||;|\n)/)
  for (const seg of segments) {
    const s = seg.trim()
    if (!s) continue

    if (s.startsWith('(') || s.startsWith('$(') || s.startsWith('<(') || s.startsWith('>)')) {
      return false
    }

    const match = s.match(/^([a-zA-Z_][\w-]*)/)
    if (!match) continue
    const name = match[1]!

    if (CONTROL_KEYWORDS.has(name)) return false
    if (!builtins.has(name)) return false
  }
  return true
}
