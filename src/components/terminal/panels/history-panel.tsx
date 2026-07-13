import { ClockIcon, CornerUpLeftIcon } from 'lucide-react'
import * as React from 'react'

import { getHistory } from '@/lib/db/terminal-repo'
import type { HistoryEntry } from '@/lib/terminal/types'
import { cn } from '@/lib/utils'

interface HistoryPanelProps {
  sessionId: string
  onInsertCommand: (cmd: string) => void
}

export function HistoryPanel({ sessionId, onInsertCommand }: HistoryPanelProps) {
  const [entries, setEntries] = React.useState<HistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    getHistory(sessionId, 200)
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const filtered = React.useMemo(() => {
    if (!filter.trim()) return entries
    const f = filter.toLowerCase()
    return entries.filter((e) => e.command.toLowerCase().includes(f))
  }, [entries, filter])

  return (
    <div className="flex flex-col gap-3 text-sm">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter commands..."
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
      />
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No commands yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((entry, i) => {
            const num = filtered.length - i
            return (
              <div
                key={entry.id ?? i}
                className="group flex items-start gap-2 rounded-md px-2 py-1 hover:bg-muted"
              >
                <span className="mt-0.5 shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                  {num}
                </span>
                <button
                  onClick={() => onInsertCommand(entry.command)}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                >
                  <span className="truncate font-mono text-xs text-foreground">
                    {entry.command}
                  </span>
                  <span className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <span className="flex items-center gap-0.5">
                      <ClockIcon className="size-2.5" />
                      {formatTime(entry.executed_at)}
                    </span>
                    {entry.exit_code !== null && (
                      <span
                        className={cn(
                          entry.exit_code === 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-500',
                        )}
                      >
                        exit={entry.exit_code}
                      </span>
                    )}
                    <span className="truncate">{getCwdShort(entry.cwd)}</span>
                  </span>
                </button>
                <button
                  onClick={() => onInsertCommand(entry.command)}
                  className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Insert to input"
                >
                  <CornerUpLeftIcon className="size-3 text-muted-foreground" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function getCwdShort(cwd: string): string {
  const parts = cwd.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || cwd
}
