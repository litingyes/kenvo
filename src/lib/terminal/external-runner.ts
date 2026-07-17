import { Command } from '@tauri-apps/plugin-shell'

export interface ExternalRunResult {
  exitCode: number
}

export async function runExternal(
  cmd: string,
  cwd: string,
  onLine: (line: string, stream: 'stdout' | 'stderr') => void,
): Promise<ExternalRunResult> {
  const command = Command.create('run-zsh', ['-c', cmd], { cwd })

  command.stdout.on('data', (line) => {
    onLine(line, 'stdout')
  })
  command.stderr.on('data', (line) => {
    onLine(line, 'stderr')
  })

  const child = await command.spawn()

  return new Promise((resolve) => {
    command.on('error', () => resolve({ exitCode: 1 }))
    command.on('close', (data) => {
      resolve({ exitCode: data.code ?? 0 })
    })
    void child
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
