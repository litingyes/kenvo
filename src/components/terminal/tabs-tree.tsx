import { useNavigate } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { XIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { TerminalSession } from '@/lib/terminal/types'
import { cn } from '@/lib/utils'

import {
  SessionActionDialogs,
  SessionContextMenuItems,
  useSessionActions,
} from './session-action-menu'

interface TabsTreeProps {
  sessions: TerminalSession[]
  activeSessionId: string
  onClose: (e: React.MouseEvent, id: string) => void
}

export function TabsTree({ sessions, activeSessionId, onClose }: TabsTreeProps) {
  const navigate = useNavigate()

  const handleClick = (session: TerminalSession) => {
    void navigate({ to: '/terminal/$sessionId', params: { sessionId: session.id } })
  }

  return (
    <div className="flex flex-col gap-0.5">
      {sessions.map((session) => (
        <SessionTreeNode
          key={session.id}
          session={session}
          active={session.id === activeSessionId}
          onClick={() => handleClick(session)}
          onClose={(e) => onClose(e, session.id)}
        />
      ))}
    </div>
  )
}

function SessionTreeNode({
  session,
  active,
  onClick,
  onClose,
}: {
  session: TerminalSession
  active: boolean
  onClick: () => void
  onClose: (e: React.MouseEvent) => void
}) {
  const { t } = useTranslation()
  const title = session.title ?? getCwdDisplay(session.cwd)
  const subtitle = session.title
    ? getCwdDisplay(session.cwd)
    : formatRelativeTime(session.last_active_at, t)
  const actions = useSessionActions(session)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              onClick={onClick}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            />
          }
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-xs font-medium">{title}</span>
            <span className="truncate text-[11px] text-muted-foreground/70">{subtitle}</span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
            aria-label={t('terminal.closeSession')}
          >
            <XIcon className="size-3" />
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <SessionContextMenuItems session={session} actions={actions} />
        </ContextMenuContent>
      </ContextMenu>
      <SessionActionDialogs session={session} actions={actions} />
    </>
  )
}

function getCwdDisplay(cwd: string): string {
  if (cwd === '/' || cwd === '') return '/'
  const parts = cwd.replace(/\/+$/, '').split('/')
  const last = parts[parts.length - 1]
  return last || cwd
}

function formatRelativeTime(ts: number, t: TFunction): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return t('terminal.relativeTime.justNow')
  if (diff < 3600000)
    return t('terminal.relativeTime.minutesAgo', { count: Math.floor(diff / 60000) })
  if (diff < 86400000)
    return t('terminal.relativeTime.hoursAgo', { count: Math.floor(diff / 3600000) })
  return t('terminal.relativeTime.daysAgo', { count: Math.floor(diff / 86400000) })
}
