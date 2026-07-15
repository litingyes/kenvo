#!/usr/bin/env tsx
/**
 * Removes stale tauri-pilot Unix sockets and occupied dev ports before
 * starting a local Tauri dev session.
 *
 * tauri-pilot uses a fixed socket path based on the app identifier:
 *   $XDG_RUNTIME_DIR/tauri-pilot-<identifier>.sock
 *   /tmp/tauri-pilot-<identifier>.sock
 *
 * If the previous Tauri process did not shut down cleanly (e.g. SIGKILL),
 * the socket file is left behind and the next dev launch fails with
 * "socket already in use". This script deletes stale sockets so the
 * SocketGuard in tauri-pilot can bind fresh.
 *
 * It also frees the Vite dev/HMR ports in case a previous dev server is
 * still holding them, sending SIGTERM first and SIGKILL only as a fallback.
 */
import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

interface TauriConf {
  identifier: string
}

async function getIdentifier(): Promise<string> {
  const confPath = join(repoRoot, 'src-tauri', 'tauri.conf.json')
  const conf = JSON.parse(await readFile(confPath, 'utf-8')) as TauriConf
  const identifier = conf.identifier
  if (typeof identifier !== 'string' || identifier.length === 0) {
    throw new Error('Could not resolve app identifier from tauri.conf.json')
  }
  return identifier
}

function getSocketPaths(identifier: string): string[] {
  const runtimeDir = process.env.XDG_RUNTIME_DIR
  const paths = new Set<string>()

  if (runtimeDir) {
    paths.add(join(runtimeDir, `tauri-pilot-${identifier}.sock`))
  }
  paths.add(join('/tmp', `tauri-pilot-${identifier}.sock`))
  paths.add(join(tmpdir(), `tauri-pilot-${identifier}.sock`))

  return Array.from(paths)
}

function cleanSockets(identifier: string): number {
  let cleaned = 0
  for (const socket of getSocketPaths(identifier)) {
    if (existsSync(socket)) {
      rmSync(socket, { force: true })
      console.log(`Removed stale tauri-pilot socket: ${socket}`)
      cleaned++
    }
  }
  return cleaned
}

function getPidsOnPort(port: number): number[] {
  try {
    const output = execSync(`lsof -ti:${port}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    return output
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map(Number)
      .filter((pid: number) => pid > 0)
  } catch {
    return []
  }
}

function sendSignal(pid: number, signal: 'SIGTERM' | 'SIGKILL'): void {
  try {
    process.kill(pid, signal)
    console.log(`Sent ${signal} to process ${pid}`)
  } catch {
    // Process may have already exited.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function cleanPort(port: number): Promise<void> {
  const pids = getPidsOnPort(port)
  if (pids.length === 0) return

  console.log(`Port ${port} is occupied by PID(s): ${pids.join(', ')}`)

  for (const pid of pids) {
    sendSignal(pid, 'SIGTERM')
  }

  const start = Date.now()
  const timeout = 3000
  while (Date.now() - start < timeout) {
    const remaining = pids.filter((pid) => getPidsOnPort(port).includes(pid))
    if (remaining.length === 0) {
      console.log(`Port ${port} freed after graceful shutdown`)
      return
    }
    await sleep(100)
  }

  const remaining = pids.filter((pid) => getPidsOnPort(port).includes(pid))
  for (const pid of remaining) {
    sendSignal(pid, 'SIGKILL')
  }
  console.log(`Port ${port} cleaned (force-killed ${remaining.length} process(es))`)
}

async function main(): Promise<void> {
  const identifier = await getIdentifier()
  const socketCount = cleanSockets(identifier)

  await cleanPort(31420)
  await cleanPort(31421)

  if (socketCount === 0) {
    console.log('No stale tauri-pilot sockets found')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
