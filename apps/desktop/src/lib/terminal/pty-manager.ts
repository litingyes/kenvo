import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'

import { addHistory, updateCwd } from '@/lib/db/terminal-repo'
import { api } from '@/lib/electron/api'
import { useWorkspaceStore } from '@/lib/store/workspace-store'

const sessions = new Map<
  string,
  {
    term: Terminal
    fitAddon: FitAddon
    container: HTMLElement | null
    cwd: string
    pendingCommand: string
    lastExitCode: number | null
    cols: number
    rows: number
    resizeObserver: ResizeObserver
    detachFragment: DocumentFragment | null
  }
>()

let eventUnsubscribe: (() => void) | null = null
let themeUnsubscribe: (() => void) | null = null

function b64ToUtf8(value: string): string {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function getCssVariable(name: string, fallback = '#000000'): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!value) return fallback
  // oklch() etc. are not valid for xterm, so fall back if the value does not look like hex/rgb
  if (!value.startsWith('#') && !value.startsWith('rgb')) return fallback
  return value
}

function getTerminalTheme(): Record<string, string> {
  const fg = getCssVariable('--foreground', '#ededef')
  const bg = getCssVariable('--background', '#050506')
  const cursor = getCssVariable('--term-cursor-bg', fg)
  const selection = getCssVariable('--primary', '#3b3b3b')
  const error = getCssVariable('--term-error', '#ef4444')

  return {
    foreground: fg,
    background: bg,
    cursor: cursor,
    cursorAccent: bg,
    selectionBackground: selection,
    selectionForeground: fg,
    black: bg,
    red: error,
    green: fg,
    yellow: fg,
    blue: fg,
    magenta: fg,
    cyan: fg,
    white: fg,
    brightBlack: '#6b7280',
    brightRed: error,
    brightGreen: fg,
    brightYellow: fg,
    brightBlue: fg,
    brightMagenta: fg,
    brightCyan: fg,
    brightWhite: fg,
  }
}

function applyTheme() {
  const theme = getTerminalTheme()
  for (const session of sessions.values()) {
    session.term.options.theme = theme
  }
}

function ensureThemeWatcher() {
  if (themeUnsubscribe) return

  const observer = new MutationObserver(() => applyTheme())
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  themeUnsubscribe = () => observer.disconnect()
}

function ensureIpcListener() {
  if (eventUnsubscribe) return

  eventUnsubscribe = api.pty.onEvent((payload) => {
    const session = sessions.get(payload.id)
    if (!session) return

    if (payload.event === 'data' && typeof payload.data === 'string') {
      session.term.write(payload.data)
    } else if (payload.event === 'exit') {
      session.term.writeln('')
      session.term.writeln(
        `[Process exited${payload.exitCode != null ? ` with code ${String(payload.exitCode)}` : ''}]`,
      )
      disposeSession(payload.id)
    }
  })
}

function updateSessionCwd(sessionId: string, cwd: string) {
  const session = sessions.get(sessionId)
  if (!session || session.cwd === cwd) return
  session.cwd = cwd
  void updateCwd(sessionId, cwd)
  void useWorkspaceStore.getState().updateSessionCwd(sessionId, cwd)
}

function recordCommand(sessionId: string, command: string) {
  const session = sessions.get(sessionId)
  if (!session) return
  session.pendingCommand = command
}

function recordExit(sessionId: string, exitCode: number) {
  const session = sessions.get(sessionId)
  if (!session) return
  session.lastExitCode = exitCode

  if (session.pendingCommand) {
    void addHistory({
      session_id: sessionId,
      command: session.pendingCommand,
      cwd: session.cwd,
      exit_code: exitCode,
      executed_at: Date.now(),
    })
    useWorkspaceStore.getState().bumpHistory()
    session.pendingCommand = ''
  }
}

function registerOscHandlers(sessionId: string, term: Terminal) {
  term.parser.registerOscHandler(7, (data) => {
    const match = data.match(/^file:\/\/[^/]+(.*)$/)
    if (match && match[1]) {
      updateSessionCwd(sessionId, decodeURIComponent(match[1]))
    }
    return true
  })

  term.parser.registerOscHandler(1337, (data) => {
    const idx = data.indexOf(';')
    const kind = idx >= 0 ? data.slice(0, idx) : data
    const value = idx >= 0 ? data.slice(idx + 1) : ''

    if (kind === 'KenvoCwd') {
      updateSessionCwd(sessionId, b64ToUtf8(value))
    } else if (kind === 'KenvoCmd') {
      recordCommand(sessionId, b64ToUtf8(value))
    } else if (kind === 'KenvoExit') {
      const code = Number(value)
      if (!Number.isNaN(code)) recordExit(sessionId, code)
    }

    return true
  })
}

async function createSession(sessionId: string, cwd: string, container: HTMLElement) {
  ensureIpcListener()
  ensureThemeWatcher()

  const term = new Terminal({
    fontFamily:
      'Geist Mono Variable, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 14,
    cursorStyle: 'block',
    cursorBlink: true,
    allowTransparency: false,
    theme: getTerminalTheme(),
    scrollback: 10000,
    rightClickSelectsWord: false,
  })

  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())

  registerOscHandlers(sessionId, term)

  term.onData((data) => void api.pty.write(sessionId, data))
  term.onBinary((data) => void api.pty.write(sessionId, data))

  term.open(container)

  const session = {
    term,
    fitAddon,
    container,
    cwd,
    pendingCommand: '',
    lastExitCode: null,
    cols: 0,
    rows: 0,
    resizeObserver: new ResizeObserver(() => fitAndResize(sessionId)),
    detachFragment: null,
  }
  sessions.set(sessionId, session)

  session.resizeObserver.observe(container)

  try {
    await api.pty.create({ sessionId, cwd })
  } catch (err) {
    term.writeln(`Failed to start shell: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }

  fitAndResize(sessionId)
  term.focus()
}

function fitAndResize(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session || !session.container) return

  const dims = session.fitAddon.proposeDimensions()
  if (!dims) return

  const cols = Math.max(2, Math.floor(dims.cols))
  const rows = Math.max(1, Math.floor(dims.rows))
  if (session.cols === cols && session.rows === rows) return

  session.cols = cols
  session.rows = rows
  session.fitAddon.fit()
  void api.pty.resize(sessionId, cols, rows)
}

export async function attachPty(sessionId: string, cwd: string, container: HTMLElement) {
  let session = sessions.get(sessionId)

  if (!session) {
    await createSession(sessionId, cwd, container)
    return
  }

  session.container = container
  if (session.detachFragment && session.term.element) {
    container.appendChild(session.term.element)
    session.detachFragment = null
  } else if (!session.term.element) {
    session.term.open(container)
  }

  session.resizeObserver.disconnect()
  session.resizeObserver = new ResizeObserver(() => fitAndResize(sessionId))
  session.resizeObserver.observe(container)

  fitAndResize(sessionId)
  session.term.focus()
}

export function detachPty(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session || !session.term.element) return

  session.resizeObserver.disconnect()

  if (session.container && session.term.element.parentElement === session.container) {
    const fragment = document.createDocumentFragment()
    fragment.appendChild(session.term.element)
    session.detachFragment = fragment
  }

  session.container = null
}

export function writeToPty(sessionId: string, data: string) {
  const session = sessions.get(sessionId)
  if (session) {
    session.term.paste(data)
  } else {
    void api.pty.write(sessionId, data)
  }
}

export function focusPty(sessionId: string) {
  sessions.get(sessionId)?.term.focus()
}

export function disposeSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) return

  session.resizeObserver.disconnect()
  session.term.dispose()
  sessions.delete(sessionId)

  void api.pty.kill(sessionId)
}

export function getPtyCwd(sessionId: string): string | undefined {
  return sessions.get(sessionId)?.cwd
}
