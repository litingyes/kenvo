#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Starts the agent server before Vite during `pnpm tauri dev`.
 *
 * The agent server is spawned with the default port (32420). Once its
 * `/health` endpoint responds, Vite is started. Both processes are cleaned
 * up when the script receives SIGINT/SIGTERM or when Vite exits.
 */
import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'
import { fileURLToPath } from 'url'

const DEFAULT_AGENT_PORT = 32420
const HEALTH_TIMEOUT_MS = 30000
const HEALTH_POLL_INTERVAL_MS = 100

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function getAppIdentifier(): string {
  const confPath = join(repoRoot, 'src-tauri', 'tauri.conf.json')
  const conf = JSON.parse(readFileSync(confPath, 'utf-8')) as { identifier?: string }
  if (!conf.identifier) {
    throw new Error('Could not resolve app identifier from tauri.conf.json')
  }
  return conf.identifier
}

function getAppLogDir(identifier: string): string {
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Logs', identifier)
    case 'win32':
      return join(
        process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
        identifier,
        'logs',
      )
    default:
      return join(
        process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
        identifier,
        'logs',
      )
  }
}

const logDir = getAppLogDir(getAppIdentifier())

function waitForAgentServer(port: number): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    function check() {
      fetch(`http://localhost:${port}/health`)
        .then((response) => {
          if (response.ok) {
            resolve()
            return
          }
          scheduleNextCheck()
        })
        .catch(() => scheduleNextCheck())
    }

    function scheduleNextCheck() {
      if (Date.now() >= deadline) {
        reject(new Error(`Agent server did not become ready on port ${port}`))
        return
      }
      setTimeout(check, HEALTH_POLL_INTERVAL_MS)
    }

    check()
  })
}

function spawnInherit(command: string, args: string[], extraEnv?: Record<string, string>) {
  return spawn(command, args, {
    stdio: 'inherit',
    detached: true,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  })
}

let cleaned = false

function cleanup() {
  if (cleaned) return
  cleaned = true

  if (agent.pid) {
    try {
      process.kill(-agent.pid, 'SIGTERM')
    } catch {
      // Process may have already exited.
    }
  }

  if (vite.pid) {
    try {
      process.kill(-vite.pid, 'SIGTERM')
    } catch {
      // Process may have already exited.
    }
  }

  process.exit(0)
}

const agent = spawnInherit(
  'pnpm',
  ['--filter', '@kenvo/agent-server', 'dev', '--', '--port', String(DEFAULT_AGENT_PORT)],
  { KENVO_LOG_DIR: logDir },
)

await waitForAgentServer(DEFAULT_AGENT_PORT)
console.log(`Agent server ready on port ${DEFAULT_AGENT_PORT}`)

const vite = spawnInherit('pnpm', ['vite'])

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

vite.on('exit', cleanup)
agent.on('exit', cleanup)
