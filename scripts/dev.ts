#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Starts the agent server before the Electron desktop app during `pnpm dev`.
 *
 * The agent server is spawned with the default port (32420). Once its
 * `/health` endpoint responds, the Electron dev server is started. Both
 * processes are cleaned up when the script receives SIGINT/SIGTERM or when
 * either process exits.
 */
import { spawn } from 'child_process'
import { homedir, platform } from 'os'
import { join } from 'path'

const APP_IDENTIFIER = 'app.vercel.kenvo'
const DEFAULT_AGENT_PORT = 32420
const HEALTH_TIMEOUT_MS = 30000
const HEALTH_POLL_INTERVAL_MS = 100

function getAppLogDir(): string {
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Logs', APP_IDENTIFIER)
    case 'win32':
      return join(
        process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
        APP_IDENTIFIER,
        'logs',
      )
    default:
      return join(
        process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
        APP_IDENTIFIER,
        'logs',
      )
  }
}

function getAppDataDir(): string {
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', APP_IDENTIFIER)
    case 'win32':
      return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), APP_IDENTIFIER)
    default:
      return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), APP_IDENTIFIER)
  }
}

const logDir = getAppLogDir()
const dataDir = getAppDataDir()

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
  const env = extraEnv ? { ...process.env, ...extraEnv } : { ...process.env }
  // Electron must not run in Node mode; some local shell configs set this.
  delete env.ELECTRON_RUN_AS_NODE
  return spawn(command, args, {
    stdio: 'inherit',
    detached: true,
    env,
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

  if (desktop.pid) {
    try {
      process.kill(-desktop.pid, 'SIGTERM')
    } catch {
      // Process may have already exited.
    }
  }

  process.exit(0)
}

const agent = spawnInherit(
  'pnpm',
  ['--filter', '@kenvo/agent-server', 'dev', '--', '--port', String(DEFAULT_AGENT_PORT)],
  { KENVO_LOG_DIR: logDir, KENVO_DATA_DIR: dataDir },
)

await waitForAgentServer(DEFAULT_AGENT_PORT)
console.log(`Agent server ready on port ${DEFAULT_AGENT_PORT}`)

const desktop = spawnInherit('pnpm', ['--filter', '@kenvo/desktop', 'dev'])

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

desktop.on('exit', cleanup)
agent.on('exit', cleanup)
