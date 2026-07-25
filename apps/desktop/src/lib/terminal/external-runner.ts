import { api } from '@/lib/electron/api'

export interface ExternalRunResult {
  exitCode: number
}

export async function runExternal(
  cmd: string,
  cwd: string,
  onLine: (line: string, stream: 'stdout' | 'stderr') => void,
  onPid?: (pid: number) => void,
): Promise<ExternalRunResult> {
  const { pid } = await api.shell.spawn('/bin/sh', ['-c', cmd], { cwd })
  if (onPid && typeof pid === 'number') onPid(pid)

  const unsubscribe = api.shell.onSpawnEvent((payload) => {
    if (payload.pid !== pid) return
    if (payload.event === 'stdout' && typeof payload.data === 'string') {
      onLine(payload.data, 'stdout')
    } else if (payload.event === 'stderr' && typeof payload.data === 'string') {
      onLine(payload.data, 'stderr')
    }
  })

  return new Promise((resolve) => {
    const inner = api.shell.onSpawnEvent((payload) => {
      if (payload.pid !== pid) return
      if (payload.event === 'close') {
        unsubscribe()
        inner()
        const data = payload.data as { code?: number } | undefined
        resolve({ exitCode: data?.code ?? 0 })
      } else if (payload.event === 'error') {
        unsubscribe()
        inner()
        resolve({ exitCode: 1 })
      }
    })
  })
}

export async function runExternalQuiet(cmd: string, cwd: string): Promise<string> {
  let output = ''
  await runExternal(cmd, cwd, (line) => {
    output += line + '\n'
  })
  return output.trim()
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
