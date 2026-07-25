import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { app, type WebContents } from 'electron'
import { spawn, type IPty } from 'node-pty'

export interface PtyOptions {
  sessionId: string
  cwd: string
  cols?: number
  rows?: number
  env?: Record<string, string>
}

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 30

const sessions = new Map<string, { pty: IPty; sender: WebContents }>()

let cachedLoginEnv: Record<string, string> | null = null
let integrationDirPromise: Promise<string> | null = null

const ZSH_RC = `# Kenvo shell integration for zsh
if [[ -n "$KENVO_ORIGINAL_ZDOTDIR" ]]; then
  ZDOTDIR="$KENVO_ORIGINAL_ZDOTDIR"
else
  ZDOTDIR="$HOME"
fi

if [[ -f "\${ZDOTDIR}/.zshrc" ]]; then
  source "\${ZDOTDIR}/.zshrc"
fi

__kenvo_b64() {
  base64 | tr -d '\\n\\r'
}

__kenvo_preexec() {
  local b64
  b64=$(printf '%s' "$1" | __kenvo_b64)
  printf '\\e]1337;KenvoCmd;%s\\a' "$b64"
}

__kenvo_precmd() {
  local -i last_exit=$?
  local cwd_b64
  cwd_b64=$(printf '%s' "$PWD" | __kenvo_b64)
  printf '\\e]1337;KenvoCwd;%s\\a' "$cwd_b64"
  printf '\\e]1337;KenvoExit;%d\\a' "$last_exit"
}

preexec_functions+=(__kenvo_preexec)
precmd_functions+=(__kenvo_precmd)
`

const BASH_RC = `# Kenvo shell integration for bash
if [[ -f "$HOME/.bashrc" ]]; then
  source "$HOME/.bashrc"
fi

__kenvo_b64() {
  base64 | tr -d '\\n\\r'
}

__kenvo_preexec() {
  local cmd="$BASH_COMMAND"
  if [[ "$cmd" == "$PROMPT_COMMAND" ]] || [[ "$cmd" == __kenvo* ]]; then
    return
  fi
  local b64
  b64=$(printf '%s' "$cmd" | __kenvo_b64)
  printf '\\e]1337;KenvoCmd;%s\\a' "$b64"
}

trap '__kenvo_preexec' DEBUG

__kenvo_precmd() {
  local last_exit=$?
  local cwd_b64
  cwd_b64=$(printf '%s' "$PWD" | __kenvo_b64)
  printf '\\e]1337;KenvoCwd;%s\\a' "$cwd_b64"
  printf '\\e]1337;KenvoExit;%d\\a' "$last_exit"
}

PROMPT_COMMAND='__kenvo_precmd'
`

function captureLoginEnv(): Record<string, string> {
  if (cachedLoginEnv) return cachedLoginEnv

  const shell = process.env.SHELL || '/bin/zsh'
  try {
    const result = spawnSync(shell, ['-ilc', 'env -0'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (result.status !== 0 || !result.stdout) {
      throw new Error(`shell env capture failed: ${result.stderr || 'unknown'}`)
    }

    const env: Record<string, string> = {}
    const parts = result.stdout.split('\0')
    for (const part of parts) {
      const idx = part.indexOf('=')
      if (idx > 0) {
        env[part.slice(0, idx)] = part.slice(idx + 1)
      }
    }

    cachedLoginEnv = env
    return env
  } catch {
    cachedLoginEnv = { ...process.env } as Record<string, string>
    return cachedLoginEnv
  }
}

async function ensureShellIntegrationDir(): Promise<string> {
  if (integrationDirPromise) return integrationDirPromise

  integrationDirPromise = (async () => {
    const dir = path.join(app.getPath('userData'), 'shell-integration')
    await fs.mkdir(dir, { recursive: true })
    await Promise.all([
      fs.writeFile(path.join(dir, '.zshrc'), ZSH_RC, 'utf8'),
      fs.writeFile(path.join(dir, 'kenvo.bash'), BASH_RC, 'utf8'),
    ])
    return dir
  })()

  return integrationDirPromise
}

function resolveShell(): { shell: string; args: string[]; env: Record<string, string> } {
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash'].filter(Boolean) as string[]
  const shell = candidates.find((s) => s && s.startsWith('/')) || '/bin/bash'

  if (shell.endsWith('/zsh')) {
    return {
      shell,
      args: ['-i'],
      env: {
        ZDOTDIR: '',
        KENVO_ORIGINAL_ZDOTDIR: process.env.ZDOTDIR || '',
      },
    }
  }

  return {
    shell,
    args: ['--rcfile', path.join('__INTEGRATION_DIR__', 'kenvo.bash'), '-i'],
    env: {},
  }
}

async function createPty(sender: WebContents, options: PtyOptions): Promise<string> {
  if (sessions.has(options.sessionId)) {
    killPty(options.sessionId)
  }

  const integrationDir = await ensureShellIntegrationDir()
  const loginEnv = captureLoginEnv()
  const resolved = resolveShell()
  const args = resolved.args.map((a) =>
    a === path.join('__INTEGRATION_DIR__', 'kenvo.bash')
      ? path.join(integrationDir, 'kenvo.bash')
      : a,
  )

  const env: Record<string, string> = {
    ...loginEnv,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'Kenvo',
    ...resolved.env,
    ...options.env,
  }

  if (resolved.shell.endsWith('/zsh')) {
    env.ZDOTDIR = integrationDir
  }

  const pty = spawn(resolved.shell, args, {
    name: 'xterm-256color',
    cwd: options.cwd,
    cols: options.cols ?? DEFAULT_COLS,
    rows: options.rows ?? DEFAULT_ROWS,
    env,
  })

  sessions.set(options.sessionId, { pty, sender })

  pty.onData((data) => {
    const session = sessions.get(options.sessionId)
    if (!session || session.sender.isDestroyed()) return
    session.sender.send('pty:event', { id: options.sessionId, event: 'data', data })
  })

  pty.onExit(({ exitCode, signal }) => {
    const session = sessions.get(options.sessionId)
    if (session && !session.sender.isDestroyed()) {
      session.sender.send('pty:event', { id: options.sessionId, event: 'exit', exitCode, signal })
    }
    sessions.delete(options.sessionId)
  })

  return options.sessionId
}

function writePty(sessionId: string, data: string): void {
  const session = sessions.get(sessionId)
  if (session) session.pty.write(data)
}

function resizePty(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId)
  if (session) session.pty.resize(cols, rows)
}

function killPty(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  try {
    session.pty.kill()
  } catch {
    // ignore
  }
  sessions.delete(sessionId)
}

function killAllPtys(): void {
  for (const sessionId of Array.from(sessions.keys())) {
    killPty(sessionId)
  }
}

export { createPty, writePty, resizePty, killPty, killAllPtys }
