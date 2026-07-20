import { fork } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

import { app } from 'electron'

import { IPC_CHANNELS } from './ipc-channels'

let child: ReturnType<typeof fork> | null = null
let currentPort: number | null = null
let sendStopped: (() => void) | null = null

function setStoppedCallback(cb: (() => void) | null): void {
  sendStopped = cb
}

function notifyStopped(): void {
  currentPort = null
  child = null
  if (sendStopped) {
    sendStopped()
    sendStopped = null
  }
}

function getAgentServerEntry(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'agent-server', 'index.cjs')
  }
  return path.join(__dirname, '../../../packages/agent-server/dist/index.cjs')
}

async function isAgentServerRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function startAgentServer(): Promise<{ port: number } | null> {
  if (child) {
    return currentPort ? { port: currentPort } : null
  }

  const defaultPort = 32420
  if (await isAgentServerRunning(defaultPort)) {
    currentPort = defaultPort
    return { port: defaultPort }
  }

  const entry = getAgentServerEntry()
  await fs.access(entry).catch(() => {
    throw new Error(`agent-server entry not found: ${entry}`)
  })

  const logDir = app.getPath('logs')
  await fs.mkdir(logDir, { recursive: true })

  const newChild = fork(entry, ['--port', String(defaultPort)], {
    env: {
      ...process.env,
      AGENT_SERVER_LOG_DIR: logDir,
    },
    silent: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })

  child = newChild

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      stopAgentServer().catch(() => {
        // ignore
      })
      reject(new Error('agent-server failed to start within 30 seconds'))
    }, 30_000)

    function onData(data: Buffer) {
      const line = data.toString()
      const match = line.match(/SERVER_READY port=(\d+)/)
      if (match) {
        currentPort = Number(match[1])
        clearTimeout(timeout)
        resolve({ port: currentPort })
      }
    }

    newChild.stdout?.on('data', onData)
    newChild.stderr?.on('data', onData)

    newChild.on('error', (err) => {
      clearTimeout(timeout)
      notifyStopped()
      reject(err)
    })

    newChild.on('exit', () => {
      clearTimeout(timeout)
      notifyStopped()
    })
  })
}

export async function stopAgentServer(): Promise<void> {
  if (!child) return
  child.kill()
  child = null
  currentPort = null
}

export function getAgentServerStatus(): { running: boolean; port: number | null } {
  return { running: child !== null, port: currentPort }
}

export function getAgentServerPort(): number | null {
  return currentPort
}

export function setupAgentServerStopped(callback: () => void): void {
  setStoppedCallback(callback)
}

export function broadcastAgentServerStopped(webContents: Electron.WebContents): void {
  webContents.send(IPC_CHANNELS.AGENT_SERVER_STOPPED)
}
