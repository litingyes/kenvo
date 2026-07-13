import * as React from 'react'

import { addHistory } from '@/lib/db/terminal-repo'
import { ShellAdapter } from '@/lib/terminal/shell-adapter'
import type { OutputLine } from '@/lib/terminal/types'

interface TerminalViewProps {
  sessionId: string
  initialCwd: string
  initialHistory?: string[]
  onCwdChange?: (cwd: string) => void
  onHomeDirChange?: (homeDir: string) => void
  insertCommandRef?: React.MutableRefObject<((cmd: string) => void) | null>
}

export function TerminalView({
  sessionId,
  initialCwd,
  initialHistory,
  onCwdChange,
  onHomeDirChange,
  insertCommandRef,
}: TerminalViewProps) {
  const [outputLines, setOutputLines] = React.useState<OutputLine[]>([])
  const [input, setInput] = React.useState('')
  const [cursor, setCursor] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [cwd, setCwd] = React.useState(initialCwd)
  const [homeDir, setHomeDir] = React.useState('')
  const [ready, setReady] = React.useState(false)

  const adapterRef = React.useRef<ShellAdapter | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (insertCommandRef) {
      insertCommandRef.current = (cmd: string) => adapterRef.current?.insertCommand(cmd)
      return () => {
        insertCommandRef.current = null
      }
    }
  }, [insertCommandRef])

  React.useEffect(() => {
    setOutputLines([])
    setInput('')
    setCursor(0)
    setBusy(false)
    setCwd(initialCwd)
    setReady(false)

    const adapter = new ShellAdapter({
      cwd: initialCwd,
      sessionId,
      initialHistory,
      callbacks: {
        onOutput: (line) => setOutputLines((prev) => [...prev, line]),
        onOutputClear: () => setOutputLines([]),
        onInputChange: (newInput, newCursor) => {
          setInput(newInput)
          setCursor(newCursor)
        },
        onBusyChange: setBusy,
        onCwdChange: (newCwd) => {
          setCwd(newCwd)
          onCwdChange?.(newCwd)
        },
        onHistoryChange: (entry) => {
          void addHistory(entry)
        },
        onReady: (hd) => {
          setHomeDir(hd)
          onHomeDirChange?.(hd)
          setReady(true)
        },
      },
    })
    adapterRef.current = adapter
    void adapter.init()

    return () => adapter.destroy()
  }, [sessionId, initialCwd, initialHistory])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [outputLines])

  React.useEffect(() => {
    if (ready) containerRef.current?.focus()
  }, [ready])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    adapterRef.current?.handleKeyDown(e.nativeEvent)
  }

  const handleClick = () => containerRef.current?.focus()

  if (!ready) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <p className="text-xs">Initializing terminal...</p>
      </div>
    )
  }

  const cursorChar = cursor < input.length ? input[cursor] : '\u00a0'
  const beforeCursor = input.slice(0, cursor)
  const afterCursor = input.slice(cursor + 1)

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex h-full flex-col bg-background font-mono text-sm leading-relaxed outline-none"
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {outputLines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            Type a command and press Enter...
          </div>
        ) : (
          outputLines.map((line) => <OutputLineView key={line.id} line={line} homeDir={homeDir} />)
        )}
      </div>
      <div className="flex items-center border-t border-border px-3 py-2">
        <PromptView cwd={cwd} homeDir={homeDir} />
        <span className="whitespace-pre text-foreground">{beforeCursor}</span>
        <span
          className="animate-pulse text-background"
          style={{ background: 'var(--term-cursor-bg)' }}
        >
          {cursorChar}
        </span>
        <span className="whitespace-pre text-foreground">{afterCursor}</span>
        {busy && (
          <span className="ml-2 flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 animate-spin rounded-full border border-current border-t-transparent" />
          </span>
        )}
      </div>
    </div>
  )
}

function PromptView({ cwd, homeDir }: { cwd: string; homeDir: string }) {
  const display = homeDir && cwd.startsWith(homeDir) ? '~' + cwd.slice(homeDir.length) : cwd
  return (
    <span className="whitespace-pre">
      <span style={{ color: 'var(--term-prompt-user)' }}>user@lume</span>
      <span className="text-foreground">:</span>
      <span style={{ color: 'var(--term-prompt-path)' }}>{display}</span>
      <span className="text-foreground">$ </span>
    </span>
  )
}

function OutputLineView({ line, homeDir }: { line: OutputLine; homeDir: string }) {
  switch (line.type) {
    case 'command':
      return (
        <div className="flex flex-wrap">
          <PromptView cwd={line.cwd ?? ''} homeDir={homeDir} />
          <span className="whitespace-pre-wrap text-foreground">{line.text}</span>
        </div>
      )
    case 'output':
      return <div className="whitespace-pre-wrap text-foreground">{line.text}</div>
    case 'error':
      return (
        <div className="whitespace-pre-wrap" style={{ color: 'var(--term-error)' }}>
          {line.text}
        </div>
      )
    case 'system':
      return (
        <div className="whitespace-pre-wrap" style={{ color: 'var(--term-system)' }}>
          {line.text}
        </div>
      )
  }
}
