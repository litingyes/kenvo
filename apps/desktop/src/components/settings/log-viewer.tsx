import { format, parseISO } from 'date-fns'
import { DownloadIcon, FolderOpenIcon, RotateCcwIcon, SearchIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLogViewer, type ActiveLogSource } from '@/hooks/use-log-viewer'
import { openAppFolder } from '@/lib/app-paths'
import { api } from '@/lib/electron/api'
import { exportLog, type LogLevel, type LogLine, type LogSource } from '@/lib/log-viewer'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const SOURCE_OPTIONS: { value: ActiveLogSource; key: string }[] = [
  { value: 'all', key: 'all' },
  { value: 'app', key: 'app' },
  { value: 'agentServer', key: 'agentServer' },
  { value: 'aiConversations', key: 'aiConversations' },
]

const LEVEL_OPTIONS: { value: LogLevel | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'allLevels' },
  { value: 'TRACE', labelKey: 'trace' },
  { value: 'DEBUG', labelKey: 'debug' },
  { value: 'INFO', labelKey: 'info' },
  { value: 'WARN', labelKey: 'warn' },
  { value: 'ERROR', labelKey: 'error' },
]

function levelBadgeProps(level: LogLevel): {
  variant: React.ComponentProps<typeof Badge>['variant']
  className: string
} {
  switch (level) {
    case 'ERROR':
      return { variant: 'destructive', className: '' }
    case 'WARN':
      return {
        variant: 'outline',
        className: 'text-orange-600 dark:text-orange-400 border-orange-600/20 bg-orange-600/10',
      }
    case 'INFO':
      return { variant: 'default', className: '' }
    case 'DEBUG':
      return { variant: 'secondary', className: '' }
    case 'TRACE':
      return { variant: 'outline', className: 'text-muted-foreground' }
    default:
      return { variant: 'secondary', className: '' }
  }
}

function sourceBadgeClass(source: LogSource): string {
  switch (source) {
    case 'app':
      return 'text-blue-600 dark:text-blue-400 border-blue-600/20 bg-blue-600/10'
    case 'agentServer':
      return 'text-purple-600 dark:text-purple-400 border-purple-600/20 bg-purple-600/10'
    case 'aiConversations':
      return 'text-emerald-600 dark:text-emerald-400 border-emerald-600/20 bg-emerald-600/10'
    default:
      return ''
  }
}

function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), 'yyyy-MM-dd HH:mm:ss.SSS')
  } catch {
    return iso
  }
}

interface LogTableRowProps {
  line: LogLine
  showSourceColumn: boolean
  sourceLabel: string
  wrapLines: boolean
  showRaw: boolean
}

const LogTableRow = React.memo(function LogTableRow({
  line,
  showSourceColumn,
  sourceLabel,
  wrapLines,
  showRaw,
}: LogTableRowProps) {
  const { variant, className } = levelBadgeProps(line.level)
  return (
    <TableRow className="font-mono text-xs">
      <TableCell className="text-muted-foreground tabular-nums">
        {formatTimestamp(line.timestamp)}
      </TableCell>
      <TableCell>
        <Badge variant={variant} className={className}>
          {line.level}
        </Badge>
      </TableCell>
      {showSourceColumn && (
        <TableCell>
          <Badge variant="outline" className={sourceBadgeClass(line.source)}>
            {sourceLabel}
          </Badge>
        </TableCell>
      )}
      <TableCell className="max-w-32 truncate text-muted-foreground">
        {line.target ?? '-'}
      </TableCell>
      <TableCell
        className={cn('w-full', wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')}
      >
        {showRaw ? line.raw : line.message}
      </TableCell>
    </TableRow>
  )
})

export function LogViewer() {
  const { t } = useTranslation()
  const {
    lines,
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
  } = useLogViewer()

  const scrollAreaRef = React.useRef<HTMLDivElement>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return
    const viewport = root.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLDivElement | null
    viewportRef.current = viewport
    if (!viewport) return

    const onScroll = () => {
      const threshold = 48
      const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      if (distance > threshold && autoScroll) {
        setAutoScroll(false)
      }
    }

    viewport.addEventListener('scroll', onScroll)
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [autoScroll, setAutoScroll])

  React.useEffect(() => {
    if (!autoScroll) return
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [lines, autoScroll])

  const handleOpenFolder = async () => {
    const kind: 'log' | 'data' = activeSource === 'aiConversations' ? 'data' : 'log'
    try {
      await openAppFolder(kind)
    } catch (err) {
      void logger.error(
        `[logs] ${t('settings.logs.openFolderFailed')}: ${err instanceof Error ? err.message : String(err)}`,
      )
      toast.error(t('settings.logs.openFolderFailed'))
    }
  }

  const handleExport = async () => {
    const source: LogSource = activeSource === 'all' ? 'app' : activeSource
    const defaultName = source === 'aiConversations' ? 'ai-conversations.jsonl' : `${source}.log`
    try {
      const result = await api.dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [
          { name: 'Log files', extensions: ['log', 'jsonl'] },
          { name: 'All files', extensions: ['*'] },
        ],
      })
      if (result.canceled || !result.filePath) return
      await exportLog(source, result.filePath)
      toast.success(t('settings.logs.exportSuccess'))
    } catch (err) {
      void logger.error(
        `[logs] ${t('settings.logs.exportFailed')}: ${err instanceof Error ? err.message : String(err)}`,
      )
      toast.error(t('settings.logs.exportFailed'))
    }
  }

  const handleResumeTail = () => {
    setAutoScroll(true)
    const viewport = viewportRef.current
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }

  const showSourceColumn = activeSource === 'all'

  return (
    <div className="flex h-full flex-col gap-4" data-testid="log-viewer">
      <Tabs
        value={activeSource}
        onValueChange={(value) => setActiveSource(value as ActiveLogSource)}
      >
        <TabsList variant="line">
          {SOURCE_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {t(`settings.logs.${option.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 basis-48">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('settings.logs.search')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="h-8 pl-8"
          />
        </div>

        <Select value={level} onValueChange={(value) => setLevel(value as LogLevel | 'all')}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder={t('settings.logs.level')}>
              {level === 'all' ? t('settings.logs.allLevels') : level}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`settings.logs.${option.labelKey}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="auto-scroll" checked={autoScroll} onCheckedChange={setAutoScroll} size="sm" />
          <Label htmlFor="auto-scroll" className="text-xs font-normal">
            {t('settings.logs.autoScroll')}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="wrap-lines" checked={wrapLines} onCheckedChange={setWrapLines} size="sm" />
          <Label htmlFor="wrap-lines" className="text-xs font-normal">
            {t('settings.logs.wrapLines')}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="show-raw" checked={showRaw} onCheckedChange={setShowRaw} size="sm" />
          <Label htmlFor="show-raw" className="text-xs font-normal">
            {t('settings.logs.showRaw')}
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleOpenFolder()}>
            <FolderOpenIcon className="size-3.5" />
            {t('settings.logs.openFolder')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleExport()}>
            <DownloadIcon className="size-3.5" />
            {t('settings.logs.export')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void clearLogs()}>
            <RotateCcwIcon className="size-3.5" />
            {t('settings.logs.clear')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t('settings.logs.error', { error })}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden rounded-lg border">
        <ScrollArea className="h-full" orientation="both" ref={scrollAreaRef}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-44">{t('settings.logs.timestamp')}</TableHead>
                <TableHead className="w-20">{t('settings.logs.level')}</TableHead>
                {showSourceColumn && (
                  <TableHead className="w-28">{t('settings.logs.source')}</TableHead>
                )}
                <TableHead className="w-32">{t('settings.logs.target')}</TableHead>
                <TableHead>{t('settings.logs.message')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && lines.length === 0 && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-14" />
                      </TableCell>
                      {showSourceColumn && (
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      )}
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {!loading && lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showSourceColumn ? 5 : 4} className="h-64">
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>{t('settings.logs.empty')}</EmptyTitle>
                        <EmptyDescription>{t('settings.logs.emptyHint')}</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}

              {lines.map((line) => (
                <LogTableRow
                  key={line.id}
                  line={line}
                  showSourceColumn={showSourceColumn}
                  sourceLabel={t(
                    `settings.logs.${line.source === 'agentServer' ? 'agentServer' : line.source === 'aiConversations' ? 'aiConversations' : 'app'}`,
                  )}
                  wrapLines={wrapLines}
                  showRaw={showRaw}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {!autoScroll && (
          <Button
            size="sm"
            className="absolute right-4 bottom-4 shadow-sm"
            onClick={handleResumeTail}
          >
            {t('settings.logs.resumeTail')}
          </Button>
        )}
      </div>
    </div>
  )
}
