import '@xterm/xterm/css/xterm.css'
import * as React from 'react'

import { attachPty, detachPty, disposeSession, focusPty } from '@/lib/terminal/pty-manager'

interface TerminalViewProps {
  sessionId: string
  initialCwd: string
  active?: boolean
}

export function TerminalView({ sessionId, initialCwd, active = true }: TerminalViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    void attachPty(sessionId, initialCwd, container)

    return () => {
      detachPty(sessionId)
    }
  }, [sessionId, initialCwd])

  React.useEffect(() => {
    if (active) {
      focusPty(sessionId)
    }
  }, [active, sessionId])

  return <div ref={containerRef} className="h-full w-full" aria-label="Terminal" />
}

export function destroyTerminalView(sessionId: string): void {
  disposeSession(sessionId)
}
