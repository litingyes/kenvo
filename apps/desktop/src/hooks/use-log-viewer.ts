import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import {
  ALL_SOURCES,
  clearStoredLogs,
  isHigherOrEqualLevel,
  stopLogStream,
  streamLog,
  type LogLevel,
  type LogLine,
  type LogSource,
  type LogStreamEvent,
} from '@/lib/log-viewer'

const MAX_RETAINED_PER_SOURCE = 2000

let globalIdCounter = 0

function generateId(): string {
  globalIdCounter += 1
  return `log-${globalIdCounter}-${Date.now().toString(36)}`
}

function withIds(lines: Omit<LogLine, 'id'>[]): LogLine[] {
  return lines.map((line) => ({ ...line, id: generateId() }))
}

export type ActiveLogSource = 'all' | LogSource

export function useLogViewer() {
  const [linesBySource, setLinesBySource] = useState<Record<LogSource, LogLine[]>>({
    app: [],
    agentServer: [],
    aiConversations: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<ActiveLogSource>('all')
  const [keyword, setKeyword] = useState('')
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [wrapLines, setWrapLines] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const streamRef = useRef<{ streamId: string; requestId: number; unsubscribe: () => void } | null>(
    null,
  )
  const requestIdRef = useRef(0)

  const activeSources = useMemo<LogSource[]>(
    () => (activeSource === 'all' ? ALL_SOURCES : [activeSource]),
    [activeSource],
  )

  const handleEvent = useCallback(
    (requestId: number) => (event: LogStreamEvent) => {
      if (requestId !== requestIdRef.current) return

      setLoading(false)

      if (event.event === 'error') {
        setError(event.data.message)
        return
      }

      const { source, lines } = event.data
      setLinesBySource((prev) => {
        const next = { ...prev }
        if (event.event === 'initial' || event.event === 'reset') {
          next[source] = withIds(lines)
        } else {
          next[source] = [...(next[source] ?? []), ...withIds(lines)].slice(
            -MAX_RETAINED_PER_SOURCE,
          )
        }
        return next
      })
    },
    [],
  )

  const startStream = useCallback(() => {
    setLoading(true)
    setError(null)

    const requestId = (requestIdRef.current += 1)

    const prev = streamRef.current
    streamRef.current = null
    if (prev) {
      prev.unsubscribe()
      stopLogStream(prev.streamId).catch(() => {})
    }

    setLinesBySource((prev) => {
      const next = { ...prev }
      activeSources.forEach((source) => (next[source] = []))
      return next
    })

    streamLog(activeSources, { tail: true }, handleEvent(requestId))
      .then((stream) => {
        if (requestId === requestIdRef.current) {
          streamRef.current = { ...stream, requestId }
        } else {
          stream.unsubscribe()
          stopLogStream(stream.streamId).catch(() => {})
        }
      })
      .catch((err) => {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setError(String(err))
        }
      })
  }, [activeSources, handleEvent])

  useEffect(() => {
    startStream()
    return () => {
      requestIdRef.current += 1
      const prev = streamRef.current
      streamRef.current = null
      if (prev) {
        prev.unsubscribe()
        stopLogStream(prev.streamId).catch(() => {})
      }
    }
  }, [startStream])

  const allLines = useMemo(() => {
    const sources = activeSource === 'all' ? ALL_SOURCES : [activeSource]
    return sources.flatMap((source) => linesBySource[source] ?? [])
  }, [linesBySource, activeSource])

  const deferredKeyword = useDeferredValue(keyword)

  const filteredLines = useMemo(() => {
    const kw = deferredKeyword.trim().toLowerCase()
    let result = allLines

    if (level !== 'all') {
      result = result.filter((line) => isHigherOrEqualLevel(line.level, level))
    }

    if (kw) {
      result = result.filter((line) => {
        const hay = `${line.message}\t${line.target ?? ''}\t${line.raw}`.toLowerCase()
        return hay.includes(kw)
      })
    }

    return result.slice().sort((a, b) => a.timestampMs - b.timestampMs)
  }, [allLines, deferredKeyword, level])

  const clearLogs = useCallback(async () => {
    try {
      await clearStoredLogs(activeSources)
      setLinesBySource((prev) => {
        const next = { ...prev }
        activeSources.forEach((source) => (next[source] = []))
        return next
      })
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }, [activeSources])

  return {
    lines: filteredLines,
    loading,
    error,
    activeSource,
    setActiveSource,
    keyword,
    setKeyword,
    level,
    setLevel,
    autoScroll,
    setAutoScroll,
    wrapLines,
    setWrapLines,
    showRaw,
    setShowRaw,
    clearLogs,
  }
}
