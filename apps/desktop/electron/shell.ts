import { spawn } from 'child_process'

import { shell } from 'electron'

interface SpawnOptions {
  cwd?: string
  env?: Record<string, string>
}

interface SpawnedProcess {
  pid: number
}

const processes = new Map<number, ReturnType<typeof spawn>>()
let nextPid = 1

export function spawnProcess(
  webContents: Electron.WebContents,
  command: string,
  args: string[],
  options: SpawnOptions = {},
): SpawnedProcess {
  const pid = nextPid++
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    shell: false,
  })

  processes.set(pid, child)

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      webContents.send('shell:spawn:event', { pid, event: 'stdout', data: line })
    }
  })

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      webContents.send('shell:spawn:event', { pid, event: 'stderr', data: line })
    }
  })

  child.on('error', (error) => {
    webContents.send('shell:spawn:event', { pid, event: 'error', data: error.message })
    processes.delete(pid)
  })

  child.on('close', (code) => {
    webContents.send('shell:spawn:event', { pid, event: 'close', data: { code } })
    processes.delete(pid)
  })

  return { pid }
}

export async function executeProcess(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', reject)

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr })
    })
  })
}

export async function killProcess(pid: number): Promise<void> {
  const child = processes.get(pid)
  if (child) {
    child.kill()
    processes.delete(pid)
  }
}

export async function openExternal(url: string): Promise<void> {
  await shell.openExternal(url)
}

export async function openPath(filePath: string): Promise<void> {
  await shell.openPath(filePath)
}
