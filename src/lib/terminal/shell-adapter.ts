import { homeDir } from '@tauri-apps/api/path'
import { Bash, InMemoryFs, MountableFs } from 'just-bash'

import { updateCwd } from '@/lib/db/terminal-repo'
import { BUILTIN_COMMANDS, isBuiltinOnly } from '@/lib/terminal/builtins'
import { runExternal } from '@/lib/terminal/external-runner'
import { TauriFs } from '@/lib/terminal/tauri-fs'
import type { HistoryEntry, OutputLine } from '@/lib/terminal/types'

export interface ShellAdapterCallbacks {
  onOutput: (line: OutputLine) => void
  onOutputClear: () => void
  onInputChange: (input: string, cursor: number) => void
  onBusyChange: (busy: boolean) => void
  onCwdChange: (cwd: string) => void
  onHistoryChange: (entry: Omit<HistoryEntry, 'id'>) => void
  onReady: (homeDir: string) => void
}

let lineCounter = 0
function nextLineId(): string {
  return `line-${++lineCounter}`
}

export class ShellAdapter {
  private bash: Bash | null = null
  private tauriFs: TauriFs
  private cwd: string
  private prevCwd: string | null = null
  private homeDir = ''
  private sessionId: string
  private callbacks: ShellAdapterCallbacks

  private input = ''
  private cursor = 0
  private history: string[] = []
  private historyPos = -1
  private busy = false
  private buffer = ''
  private destroyed = false

  constructor(opts: {
    cwd: string
    sessionId: string
    initialHistory?: string[]
    callbacks: ShellAdapterCallbacks
  }) {
    this.cwd = opts.cwd
    this.sessionId = opts.sessionId
    this.callbacks = opts.callbacks
    this.history = opts.initialHistory ? [...opts.initialHistory] : []
    this.tauriFs = new TauriFs()
  }

  async init(): Promise<void> {
    this.homeDir = await homeDir().catch(() => '/')

    const baseFs = new InMemoryFs()
    const tauriFs = new TauriFs(this.homeDir)
    const mountable = new MountableFs({ base: baseFs })
    mountable.mount(this.homeDir, tauriFs)

    this.bash = new Bash({
      fs: mountable,
      cwd: this.cwd,
      env: { TERM: 'xterm-256color', HOME: this.homeDir },
    })

    this.emitSystem(`Kenvo Terminal — cwd: ${this.cwd}`)
    this.callbacks.onInputChange('', 0)
    this.callbacks.onReady(this.homeDir)
  }

  destroy(): void {
    this.destroyed = true
    this.bash = null
  }

  private get isDestroyed(): boolean {
    return this.destroyed
  }

  get currentCwd(): string {
    return this.cwd
  }

  get homeDirectory(): string {
    return this.homeDir
  }

  insertCommand(cmd: string): void {
    if (this.busy || this.isDestroyed) return
    this.updateInput(cmd, cmd.length)
  }

  abbreviatePath(path: string): string {
    if (this.homeDir && path.startsWith(this.homeDir)) {
      return '~' + path.slice(this.homeDir.length)
    }
    return path
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (this.busy || this.isDestroyed) return

    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault()
          this.cursorToStart()
          return
        case 'e':
          e.preventDefault()
          this.cursorToEnd()
          return
        case 'u':
          e.preventDefault()
          this.clearLine()
          return
        case 'c':
          e.preventDefault()
          this.cancelInput()
          return
        case 'l':
          e.preventDefault()
          this.clearScreen()
          return
        case 'w':
          e.preventDefault()
          this.deleteWordBackward()
          return
      }
      return
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        void this.submit()
        return
      case 'Backspace':
        e.preventDefault()
        this.deleteBackward()
        return
      case 'Delete':
        e.preventDefault()
        this.deleteForward()
        return
      case 'ArrowUp':
        e.preventDefault()
        this.historyPrev()
        return
      case 'ArrowDown':
        e.preventDefault()
        this.historyNext()
        return
      case 'ArrowLeft':
        e.preventDefault()
        this.cursorLeft()
        return
      case 'ArrowRight':
        e.preventDefault()
        this.cursorRight()
        return
      case 'Tab':
        e.preventDefault()
        void this.tabComplete()
        return
      case 'Home':
        e.preventDefault()
        this.cursorToStart()
        return
      case 'End':
        e.preventDefault()
        this.cursorToEnd()
        return
    }

    if (e.key.length === 1 && !e.metaKey && !e.altKey) {
      e.preventDefault()
      this.insertChar(e.key)
    }
  }

  private emitOutput(type: OutputLine['type'], text: string, cwd?: string): void {
    if (this.isDestroyed) return
    this.callbacks.onOutput({ id: nextLineId(), type, text, cwd })
  }

  private emitSystem(text: string): void {
    this.emitOutput('system', text)
  }

  private updateInput(input: string, cursor: number): void {
    this.input = input
    this.cursor = cursor
    this.callbacks.onInputChange(input, cursor)
  }

  private insertChar(ch: string): void {
    const before = this.input.slice(0, this.cursor)
    const after = this.input.slice(this.cursor)
    this.updateInput(before + ch + after, this.cursor + 1)
  }

  private deleteBackward(): void {
    if (this.cursor <= 0) return
    const before = this.input.slice(0, this.cursor - 1)
    const after = this.input.slice(this.cursor)
    this.updateInput(before + after, this.cursor - 1)
  }

  private deleteForward(): void {
    if (this.cursor >= this.input.length) return
    const before = this.input.slice(0, this.cursor)
    const after = this.input.slice(this.cursor + 1)
    this.updateInput(before + after, this.cursor)
  }

  private deleteWordBackward(): void {
    if (this.cursor <= 0) return
    let pos = this.cursor
    while (pos > 0 && this.input[pos - 1] === ' ') pos--
    while (pos > 0 && this.input[pos - 1] !== ' ') pos--
    this.updateInput(this.input.slice(0, pos) + this.input.slice(this.cursor), pos)
  }

  private cursorLeft(): void {
    if (this.cursor > 0) this.updateInput(this.input, this.cursor - 1)
  }

  private cursorRight(): void {
    if (this.cursor < this.input.length) this.updateInput(this.input, this.cursor + 1)
  }

  private cursorToStart(): void {
    this.updateInput(this.input, 0)
  }

  private cursorToEnd(): void {
    this.updateInput(this.input, this.input.length)
  }

  private clearLine(): void {
    this.updateInput('', 0)
  }

  private cancelInput(): void {
    this.updateInput('', 0)
    this.buffer = ''
    this.emitOutput('system', '^C')
  }

  private clearScreen(): void {
    this.callbacks.onOutputClear()
    this.buffer = ''
  }

  private historyPrev(): void {
    if (this.history.length === 0) return
    if (this.historyPos < 0) this.historyPos = this.history.length
    if (this.historyPos > 0) {
      this.historyPos--
      const entry = this.history[this.historyPos]!
      this.updateInput(entry, entry.length)
    }
  }

  private historyNext(): void {
    if (this.historyPos < 0) return
    this.historyPos++
    if (this.historyPos >= this.history.length) {
      this.historyPos = -1
      this.updateInput('', 0)
    } else {
      const entry = this.history[this.historyPos]!
      this.updateInput(entry, entry.length)
    }
  }

  private async submit(): Promise<void> {
    const cmd = this.input
    this.updateInput('', 0)

    this.emitOutput('command', cmd, this.cwd)

    if (cmd.trim() === '') return

    if (cmd.endsWith('\\')) {
      this.buffer += cmd + '\n'
      this.emitOutput('system', '> ')
      return
    }

    const fullCmd = this.buffer + cmd
    this.buffer = ''

    this.history.push(fullCmd)
    this.historyPos = -1

    this.busy = true
    this.callbacks.onBusyChange(true)

    try {
      await this.execute(fullCmd)
    } catch (err) {
      this.emitOutput('error', err instanceof Error ? err.message : String(err))
    } finally {
      if (this.isDestroyed) return
      this.busy = false
      this.callbacks.onBusyChange(false)
    }
  }

  private async execute(cmd: string): Promise<void> {
    const builtin = isBuiltinOnly(cmd)
    let exitCode = 0

    if (builtin && this.bash) {
      try {
        const result = await this.bash.exec(cmd, { cwd: this.cwd })
        if (result.stdout) {
          this.emitOutput('output', result.stdout)
        }
        if (result.stderr) {
          this.emitOutput('error', result.stderr)
        }
        exitCode = result.exitCode
      } catch (err) {
        this.emitOutput('error', err instanceof Error ? err.message : String(err))
        exitCode = 1
      }
    } else {
      const result = await runExternal(cmd, this.cwd, (line, stream) => {
        this.emitOutput(stream === 'stderr' ? 'error' : 'output', line)
      })
      exitCode = result.exitCode
    }

    await this.trackCwd(cmd)

    this.callbacks.onHistoryChange({
      session_id: this.sessionId,
      command: cmd,
      cwd: this.cwd,
      exit_code: exitCode,
      executed_at: Date.now(),
    })

    void updateCwd(this.sessionId, this.cwd)
  }

  private async trackCwd(cmd: string): Promise<void> {
    const bareCd = /\bcd\s*(?:&&|;|\||$|\n)/.test(cmd)
    const cdMatch = cmd.match(/\bcd\s+(['"]?)([^'";&|\n]+)\1/)

    if (!cdMatch && !bareCd) return

    if (bareCd && !cdMatch) {
      this.setCwd(this.homeDir)
      return
    }

    if (!cdMatch) return

    let target = cdMatch[2]!.trim()

    if (target === '-') {
      if (this.prevCwd) this.setCwd(this.prevCwd)
      return
    }
    if (target === '~') {
      this.setCwd(this.homeDir)
      return
    }
    if (target.startsWith('~/')) {
      target = this.homeDir + target.slice(1)
    }

    const resolved = this.resolvePath(this.cwd, target)

    try {
      const info = await this.tauriFs.stat(resolved)
      if (info.isDirectory) {
        this.setCwd(resolved)
      } else {
        this.emitOutput('error', `cd: not a directory: ${target}`)
      }
    } catch {
      this.emitOutput('error', `cd: no such file or directory: ${target}`)
    }
  }

  private setCwd(cwd: string): void {
    this.prevCwd = this.cwd
    this.cwd = cwd
    this.callbacks.onCwdChange(cwd)
  }

  private resolvePath(base: string, path: string): string {
    if (path.startsWith('/')) return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
    const full = base + '/' + path
    return full.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  }

  private async tabComplete(): Promise<void> {
    const line = this.input
    const parts = line.split(/\s+/)
    const word = parts[parts.length - 1] ?? ''
    const isFirst = parts.length <= 1

    let dir: string
    let prefix: string

    if (word.includes('/')) {
      const lastSlash = word.lastIndexOf('/')
      const rawDir = word.slice(0, lastSlash + 1)
      prefix = word.slice(lastSlash + 1)
      if (rawDir.startsWith('/')) {
        dir = rawDir
      } else if (rawDir.startsWith('~/')) {
        dir = this.homeDir + rawDir.slice(1)
      } else {
        dir = this.resolvePath(this.cwd, rawDir)
      }
    } else {
      dir = this.cwd
      prefix = word
    }

    const candidates: string[] = []

    try {
      const entries = await this.tauriFs.readdir(dir)
      for (const name of entries) {
        if (name === '.' || name === '..') continue
        if (name.startsWith(prefix)) candidates.push(name)
      }
    } catch {
      // directory doesn't exist or not readable
    }

    if (isFirst && !word.includes('/')) {
      for (const cmd of BUILTIN_COMMANDS) {
        if (cmd.startsWith(prefix) && !candidates.includes(cmd)) {
          candidates.push(cmd)
        }
      }
    }

    if (candidates.length === 0) return

    if (candidates.length === 1) {
      const completion = candidates[0]!.slice(prefix.length)
      if (completion) {
        const newInput = this.input + completion
        let newCursor = this.cursor + completion.length

        let finalInput = newInput
        try {
          const fullPath = this.resolvePath(dir, candidates[0]!)
          const info = await this.tauriFs.stat(fullPath)
          if (info.isDirectory && !finalInput.endsWith('/')) {
            finalInput = finalInput + '/'
            newCursor++
          }
        } catch {
          // not a directory or doesn't exist
        }

        this.updateInput(finalInput, newCursor)

        this.updateInput(newInput, newCursor)
      }
    } else {
      let common = candidates[0]!
      for (let i = 1; i < candidates.length; i++) {
        while (!candidates[i]!.startsWith(common)) {
          common = common.slice(0, -1)
        }
      }
      const partial = common.slice(prefix.length)
      if (partial) {
        this.updateInput(this.input + partial, this.cursor + partial.length)
      } else {
        this.emitOutput('output', candidates.join('  '))
      }
    }
  }
}
